import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Banco } from '../banco/conexao';
import { chamadasIa, PAPEIS, projetos, sugestoes, type Decisao, type SituacaoSugestao } from '../banco/esquema';
import { EntradaInvalidaError, NaoEncontradoError, RegraDeNegocioError } from '../erros';
import { TAREFAS } from '../motor-ia/tarefas';
import type { InsumoParaRoteamento, RoteadorDeMotor } from '../motor-ia/roteador';
import { validar } from '../validacao';

type Transacao = Parameters<Parameters<Banco['transaction']>[0]>[0];

/**
 * Aplica no domínio o conteúdo final de uma sugestão aceita ou editada.
 * Cada tarefa de IA registra o seu aplicador (a captura registra o da história).
 */
export type Aplicador = (
  tx: Transacao,
  conteudoFinal: unknown,
  sugestao: typeof sugestoes.$inferSelect,
  decisao: Decisao,
) => Promise<{ tipo: string; id: string }>;

export interface PedidoDeSugestao {
  projetoId: string;
  tarefa: string;
  alvoTipo: string;
  alvoId: string;
  entrada: unknown;
  /** Classificação do insumo; decide se a chamada pode sair e para qual motor. */
  insumo: InsumoParaRoteamento;
  motor?: string;
}

export interface FiltrosRegistro {
  projetoId?: string;
  alvoId?: string;
  tarefa?: string;
  provedor?: string;
  situacao?: string;
  /** Datas no formato AAAA-MM-DD; "ate" é inclusiva. */
  de?: string;
  ate?: string;
}

export const esquemaDecisao = z.object({
  decisao: z.enum(['aceitar', 'editar', 'recusar']),
  pessoa: z.string().trim().min(1, 'Informe quem decidiu.'),
  papel: z.enum(PAPEIS, { message: 'Informe o papel exercido: product_owner, ux ou governanca.' }),
  conteudoEditado: z.unknown().optional(),
  observacao: z.string().trim().max(2000).optional(),
});
export type DecisaoHumana = z.infer<typeof esquemaDecisao>;

const SITUACAO_POR_DECISAO: Record<Decisao, SituacaoSugestao> = {
  aceitar: 'aceita',
  editar: 'editada',
  recusar: 'recusada',
};

function extrairFontes(conteudo: unknown): unknown[] | null {
  const fontes = (conteudo as { fontes?: unknown } | null)?.fontes;
  return Array.isArray(fontes) ? fontes : null;
}

export class SugestoesServico {
  private readonly aplicadores = new Map<string, Aplicador>();

  constructor(
    private readonly banco: Banco,
    private readonly roteador: RoteadorDeMotor,
    private readonly relogio: () => Date = () => new Date(),
  ) {}

  registrarAplicador(tarefa: string, aplicador: Aplicador): void {
    this.aplicadores.set(tarefa, aplicador);
  }

  /** Chama o motor de IA e guarda a saída como sugestão pendente, junto com o registro da chamada. */
  async solicitar(pedido: PedidoDeSugestao) {
    const tarefa = TAREFAS[pedido.tarefa];
    if (!tarefa) throw new NaoEncontradoError(`Tarefa de IA "${pedido.tarefa}" não existe.`);

    const [projeto] = await this.banco.select().from(projetos).where(eq(projetos.id, pedido.projetoId));
    if (!projeto) throw new NaoEncontradoError(`Projeto ${pedido.projetoId} não encontrado.`);

    const motor = this.roteador.escolher(projeto, pedido.insumo, pedido.motor);
    const prompt = tarefa.montarPrompt(pedido.entrada);
    const inicio = Date.now();

    let saidaBruta: string | null = null;
    let conteudo: unknown = null;
    let erro: string | null = null;
    try {
      ({ saidaBruta } = await motor.gerar({ tarefa, entrada: pedido.entrada, prompt }));
      const analisada = tarefa.esquemaSaida.safeParse(JSON.parse(saidaBruta));
      if (analisada.success) conteudo = analisada.data;
      else erro = `Saída fora do esquema: ${analisada.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`;
    } catch (e) {
      erro = e instanceof SyntaxError ? `Saída não é JSON: ${e.message}` : `Falha no motor: ${(e as Error).message}`;
    }
    const duracaoMs = Date.now() - inicio;

    return this.banco.transaction(async (tx) => {
      const codigo = await this.proximoCodigo(tx);
      const [sugestao] = await tx
        .insert(sugestoes)
        .values({
          codigo,
          projetoId: projeto.id,
          tarefa: tarefa.id,
          alvoTipo: pedido.alvoTipo,
          alvoId: pedido.alvoId,
          conteudo,
          situacao: erro ? 'invalida' : 'pendente',
          criadoEm: this.relogio(),
        })
        .returning();
      const [chamada] = await tx
        .insert(chamadasIa)
        .values({
          sugestaoId: sugestao.id,
          tarefa: tarefa.id,
          ...motor.identificacao,
          versaoPrompt: tarefa.versaoPrompt,
          classificacaoEntrada: pedido.insumo.classificacao,
          entrada: pedido.entrada as object,
          prompt,
          saidaBruta,
          saidaValida: !erro,
          fontes: extrairFontes(conteudo),
          erro,
          duracaoMs,
          executadaEm: this.relogio(),
        })
        .returning();
      return { ...sugestao, chamada };
    });
  }

  /** Registra a decisão humana e, se aceita ou editada, aplica o conteúdo no domínio. */
  async decidir(id: string, dados: unknown) {
    const decisao = validar(esquemaDecisao, dados);
    return this.banco.transaction(async (tx) => {
      const [sugestao] = await tx
        .select()
        .from(sugestoes)
        .where(eq(sugestoes.id, id))
        .for('update');
      if (!sugestao) throw new NaoEncontradoError(`Sugestão ${id} não encontrada.`);
      if (sugestao.situacao !== 'pendente') {
        throw new RegraDeNegocioError(
          sugestao.situacao === 'invalida'
            ? 'A saída da IA não passou na validação e não pode ser aceita; peça uma nova sugestão.'
            : `A sugestão ${sugestao.codigo} já foi decidida (${sugestao.situacao}).`,
        );
      }

      let conteudoFinal: unknown = null;
      let resultado: { tipo: string; id: string } | null = null;
      if (decisao.decisao !== 'recusar') {
        const tarefa = TAREFAS[sugestao.tarefa];
        if (decisao.decisao === 'editar') {
          if (!tarefa) {
            throw new RegraDeNegocioError(`A tarefa "${sugestao.tarefa}" ainda não aceita edição nesta versão.`);
          }
          if (decisao.conteudoEditado === undefined) {
            throw new RegraDeNegocioError('Para editar, envie o conteúdo editado.');
          }
          conteudoFinal = validar(tarefa.esquemaSaida, decisao.conteudoEditado);
        } else {
          conteudoFinal = sugestao.conteudo;
        }
        const aplicador = this.aplicadores.get(sugestao.tarefa);
        if (aplicador) resultado = await aplicador(tx, conteudoFinal, sugestao, decisao.decisao);
      }

      const [atualizada] = await tx
        .update(sugestoes)
        .set({
          situacao: SITUACAO_POR_DECISAO[decisao.decisao],
          decisao: decisao.decisao,
          conteudoFinal,
          decididoPor: decisao.pessoa,
          papel: decisao.papel,
          decididoEm: this.relogio(),
          observacao: decisao.observacao ?? null,
          resultadoTipo: resultado?.tipo ?? null,
          resultadoId: resultado?.id ?? null,
        })
        .where(and(eq(sugestoes.id, id), eq(sugestoes.situacao, 'pendente')))
        .returning();
      return atualizada;
    });
  }

  async obter(id: string) {
    const [linha] = await this.consultaRegistro().where(eq(sugestoes.id, id));
    if (!linha) throw new NaoEncontradoError(`Sugestão ${id} não encontrada.`);
    return linha;
  }

  /** Registro de uso de IA: modelo, versão, data, entrada, saída e decisão humana. */
  async registro(filtros: FiltrosRegistro = {}) {
    const data = (valor: string, campo: string) => {
      const d = new Date(`${valor}T00:00:00-03:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(d.getTime())) {
        throw new EntradaInvalidaError(`Data inválida em "${campo}": use AAAA-MM-DD.`);
      }
      return d;
    };
    const condicoes = [
      filtros.projetoId ? eq(sugestoes.projetoId, filtros.projetoId) : undefined,
      filtros.alvoId ? eq(sugestoes.alvoId, filtros.alvoId) : undefined,
      filtros.tarefa ? eq(sugestoes.tarefa, filtros.tarefa) : undefined,
      filtros.provedor ? eq(chamadasIa.provedor, filtros.provedor) : undefined,
      filtros.situacao ? eq(sugestoes.situacao, filtros.situacao as SituacaoSugestao) : undefined,
      filtros.de ? gte(chamadasIa.executadaEm, data(filtros.de, 'de')) : undefined,
      filtros.ate ? lt(chamadasIa.executadaEm, new Date(data(filtros.ate, 'ate').getTime() + 86_400_000)) : undefined,
    ].filter(Boolean);
    return this.consultaRegistro()
      .where(and(...condicoes))
      .orderBy(desc(chamadasIa.executadaEm));
  }

  private consultaRegistro() {
    return this.banco
      .select({
        id: sugestoes.id,
        codigo: sugestoes.codigo,
        projetoId: sugestoes.projetoId,
        tarefa: sugestoes.tarefa,
        alvoTipo: sugestoes.alvoTipo,
        alvoId: sugestoes.alvoId,
        situacao: sugestoes.situacao,
        provedor: chamadasIa.provedor,
        modelo: chamadasIa.modelo,
        versaoModelo: chamadasIa.versaoModelo,
        versaoPrompt: chamadasIa.versaoPrompt,
        local: chamadasIa.local,
        classificacaoEntrada: chamadasIa.classificacaoEntrada,
        executadaEm: chamadasIa.executadaEm,
        duracaoMs: chamadasIa.duracaoMs,
        entrada: chamadasIa.entrada,
        saidaBruta: chamadasIa.saidaBruta,
        saidaValida: chamadasIa.saidaValida,
        erro: chamadasIa.erro,
        fontes: chamadasIa.fontes,
        conteudo: sugestoes.conteudo,
        decisao: sugestoes.decisao,
        conteudoFinal: sugestoes.conteudoFinal,
        decididoPor: sugestoes.decididoPor,
        papel: sugestoes.papel,
        decididoEm: sugestoes.decididoEm,
        observacao: sugestoes.observacao,
        resultadoTipo: sugestoes.resultadoTipo,
        resultadoId: sugestoes.resultadoId,
      })
      .from(sugestoes)
      .innerJoin(chamadasIa, eq(chamadasIa.sugestaoId, sugestoes.id))
      .$dynamic();
  }

  private async proximoCodigo(tx: Transacao): Promise<string> {
    // Trava curta para que duas sugestões simultâneas não recebam o mesmo código.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('codigo_sugestao'))`);
    const [{ maximo }] = await tx
      .select({ maximo: sql<number>`coalesce(max(substring(${sugestoes.codigo} from 4)::int), 0)` })
      .from(sugestoes);
    return `IA-${String(Number(maximo) + 1).padStart(4, '0')}`;
  }
}
