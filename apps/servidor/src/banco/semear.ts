import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { lerConfiguracao } from '../config';
import { criarBanco, type Banco } from './conexao';
import { chamadasIa, historias, necessidades, perfis, projetos, sugestoes, type Decisao, type Papel, type SituacaoSugestao, type TipoOrigem } from './esquema';

/**
 * Carrega o cenário fictício da FUNCEP (município inventado de Pedra Clara).
 * Apaga tudo antes de carregar: serve só para demonstração e testes.
 */
const PASTA_PADRAO = path.resolve(__dirname, '../../../../dados-ficticios');
export const PROJETO_DEMO = 'PRJ-FUNCEP';

function ler<T>(pasta: string, arquivo: string): T {
  return JSON.parse(readFileSync(path.join(pasta, arquivo), 'utf8')) as T;
}

interface OrgaoJson { id: string; nome: string; sigla: string }
interface PerfilJson { id: string; nome: string; idade: number; ocupacao: string; contexto: string; [k: string]: unknown }
interface NecessidadeJson { id: string; data_registro: string; canal: string; servico_id: string; perfis_afetados: string[]; texto_original: string }
interface HistoriaJson { id: string; necessidade_id: string | null; perfil_id: string | null; origem: string; sugestao_ia_id: string | null; titulo: string; historia: string; criterios_aceite: string[]; situacao: string }
interface RegistroJson {
  id: string; data_hora: string; funcao: string; provedor: string; modelo: string; versao_modelo: string; versao_prompt: string;
  entrada: Record<string, unknown>; saida: string; decisao: Decisao | 'pendente'; decidido_por: string | null; data_decisao: string | null;
  resultado_final: string | string[] | null; observacao: string | null;
}

const SITUACAO: Record<RegistroJson['decisao'], SituacaoSugestao> = {
  aceitar: 'aceita', editar: 'editada', recusar: 'recusada', pendente: 'pendente',
};

/** Os relatos chegaram por canais de atendimento (chamado), exceto o registrado em ata de reunião. */
const tipoOrigem = (canal: string): TipoOrigem => (/reuni/i.test(canal) ? 'ata' : 'chamado');

/** Papel exercido nas decisões históricas, conforme a equipe de orgao.json. */
const PAPEL_POR_PESSOA: Record<string, Papel> = { 'EQP-01': 'product_owner', 'EQP-02': 'ux' };

/** Separa "Como X, quero Y, para Z." nos três campos do RF-04. */
export function separarHistoria(frase: string): { papel: string | null; acao: string | null; beneficio: string | null } {
  const m = /^Como (.+?), quero (.+?), para (.+?)\.?$/s.exec(frase.trim());
  return m ? { papel: m[1], acao: m[2], beneficio: m[3] } : { papel: null, acao: null, beneficio: null };
}

function alvo(entrada: Record<string, unknown>): { tipo: string; id: string } {
  for (const [chave, valor] of Object.entries(entrada)) {
    if (chave.endsWith('_id') && typeof valor === 'string') return { tipo: chave.replace(/_id$/, ''), id: valor };
  }
  return { tipo: 'lote', id: String(entrada.tipo ?? 'lote') };
}

export async function semear(banco: Banco, pasta = PASTA_PADRAO): Promise<void> {
  const orgao = ler<OrgaoJson>(pasta, 'orgao.json');
  const listaPerfis = ler<PerfilJson[]>(pasta, 'perfis.json');
  const listaNecessidades = ler<NecessidadeJson[]>(pasta, 'necessidades.json');
  const listaHistorias = ler<HistoriaJson[]>(pasta, 'historias.json');
  const registro = ler<RegistroJson[]>(pasta, 'registro_ia.json');

  await banco.transaction(async (tx) => {
    await tx.execute(sql`truncate chamadas_ia, sugestoes, historias, necessidades, perfis, projetos restart identity cascade`);

    await tx.insert(projetos).values({
      id: PROJETO_DEMO,
      nome: `Portal de serviços da ${orgao.sigla}`,
      orgao: orgao.nome,
      dadosReais: false,
      motorPreferido: 'simulado',
    });

    await tx.insert(perfis).values(
      listaPerfis.map(({ id, nome, idade, ocupacao, contexto, ...detalhes }) => ({
        id,
        projetoId: PROJETO_DEMO,
        nome,
        resumo: `${ocupacao}, ${idade} anos. ${contexto}`,
        detalhes,
      })),
    );

    await tx.insert(necessidades).values(
      listaNecessidades.map((n) => ({
        id: n.id,
        projetoId: PROJETO_DEMO,
        textoOriginal: n.texto_original,
        tipoOrigem: tipoOrigem(n.canal),
        // Todo o cenário é fictício; "interno" permite demonstrar o fluxo com qualquer motor.
        classificacao: 'interno' as const,
        canal: n.canal,
        servicoId: n.servico_id,
        perfisAfetados: n.perfis_afetados,
        dataRegistro: n.data_registro,
      })),
    );

    const idPorCodigo = new Map<string, string>();
    for (const r of registro) {
      const { tipo, id } = alvo(r.entrada);
      const decidida = r.decisao !== 'pendente';
      const resultado = Array.isArray(r.resultado_final) ? r.resultado_final.join(',') : r.resultado_final;
      const [sugestao] = await tx
        .insert(sugestoes)
        .values({
          codigo: r.id,
          projetoId: PROJETO_DEMO,
          tarefa: r.funcao,
          alvoTipo: tipo,
          alvoId: id,
          conteudo: { texto: r.saida },
          situacao: SITUACAO[r.decisao],
          decisao: decidida ? (r.decisao as Decisao) : null,
          conteudoFinal: decidida && r.decisao !== 'recusar' ? { referencia: resultado } : null,
          decididoPor: r.decidido_por,
          papel: r.decidido_por ? PAPEL_POR_PESSOA[r.decidido_por] ?? null : null,
          decididoEm: r.data_decisao ? new Date(`${r.data_decisao}T12:00:00-03:00`) : null,
          observacao: r.observacao,
          resultadoTipo: resultado ? resultado.split('-')[0] : null,
          resultadoId: resultado,
          criadoEm: new Date(r.data_hora),
        })
        .returning({ id: sugestoes.id });
      idPorCodigo.set(r.id, sugestao.id);
      await tx.insert(chamadasIa).values({
        sugestaoId: sugestao.id,
        tarefa: r.funcao,
        provedor: r.provedor,
        modelo: r.modelo,
        versaoModelo: r.versao_modelo,
        versaoPrompt: r.versao_prompt,
        classificacaoEntrada: 'interno',
        local: r.provedor.startsWith('ollama'),
        entrada: r.entrada,
        prompt: null,
        saidaBruta: r.saida,
        saidaValida: true,
        executadaEm: new Date(r.data_hora),
      });
    }

    await tx.insert(historias).values(
      listaHistorias.map((h) => ({
        id: h.id,
        projetoId: PROJETO_DEMO,
        necessidadeId: h.necessidade_id,
        perfilId: h.perfil_id,
        titulo: h.titulo,
        ...separarHistoria(h.historia),
        historia: h.historia,
        criteriosAceite: h.criterios_aceite,
        origem: h.origem,
        sugestaoId: h.sugestao_ia_id ? idPorCodigo.get(h.sugestao_ia_id) ?? null : null,
        situacao: h.situacao,
      })),
    );
  });
}

if (require.main === module) {
  const { banco, pool } = criarBanco(lerConfiguracao().databaseUrl);
  semear(banco)
    .then(() => console.log('Dados fictícios da FUNCEP carregados.'))
    .catch((erro) => {
      console.error(erro);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
