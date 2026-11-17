import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Banco } from '../banco/conexao';
import { CLASSIFICACOES, historias, necessidades, perfis, projetos, TIPOS_ORIGEM } from '../banco/esquema';
import { NaoEncontradoError } from '../erros';
import {
  comporHistoria,
  esquemaPropostaHistoria,
  historiaIncompleta,
  tarefaPropostaHistoria,
  type EntradaPropostaHistoria,
} from '../motor-ia/tarefas';
import type { SugestoesServico } from '../sugestoes/sugestoes.servico';
import { validar } from '../validacao';

export const esquemaNovaNecessidade = z.object({
  textoOriginal: z.string().trim().min(10, 'Descreva a necessidade com pelo menos 10 caracteres.'),
  tipoOrigem: z.enum(TIPOS_ORIGEM, {
    message: 'Informe o tipo de origem: entrevista, ata, chamado, retorno_homologacao ou documento.',
  }),
  classificacao: z.enum(CLASSIFICACOES).optional(),
  anonimizacaoConfirmada: z.boolean().default(false),
  canal: z.string().trim().optional(),
  servicoId: z.string().trim().optional(),
  perfisAfetados: z.array(z.string()).default([]),
});

export const esquemaClassificacao = z.object({
  classificacao: z.enum(CLASSIFICACOES, { message: 'Classificação deve ser publico, interno, restrito ou sigiloso.' }),
  anonimizacaoConfirmada: z.boolean().default(false),
});

/** Módulo de captura: necessidades em linguagem natural e histórias derivadas delas. */
export class CapturaServico {
  constructor(
    private readonly banco: Banco,
    private readonly sugestoes: SugestoesServico,
  ) {
    sugestoes.registrarAplicador(tarefaPropostaHistoria.id, async (tx, conteudoFinal, sugestao, decisao) => {
      const proposta = esquemaPropostaHistoria.parse(conteudoFinal);
      const [{ maximo }] = await tx
        .select({ maximo: sql<number>`coalesce(max(substring(${historias.id} from 5)::int), 0)` })
        .from(historias);
      const id = `HIS-${String(Number(maximo) + 1).padStart(2, '0')}`;
      await tx.insert(historias).values({
        id,
        projetoId: sugestao.projetoId,
        necessidadeId: sugestao.alvoId,
        perfilId: proposta.perfilId,
        titulo: proposta.titulo,
        papel: proposta.papel || null,
        acao: proposta.acao || null,
        beneficio: proposta.beneficio || null,
        historia: comporHistoria(proposta),
        criteriosAceite: proposta.criteriosAceite,
        situacao: historiaIncompleta(proposta) ? 'incompleta' : 'em_especificacao',
        origem: decisao === 'aceitar' ? 'proposta_ia_aceita' : 'proposta_ia_editada',
        sugestaoId: sugestao.id,
      });
      return { tipo: 'historia', id };
    });
  }

  async projetos() {
    return this.banco.select().from(projetos).orderBy(asc(projetos.id));
  }

  async perfis(projetoId: string) {
    return this.banco.select().from(perfis).where(eq(perfis.projetoId, projetoId)).orderBy(asc(perfis.id));
  }

  async necessidades(projetoId: string) {
    return this.banco.select().from(necessidades).where(eq(necessidades.projetoId, projetoId)).orderBy(asc(necessidades.id));
  }

  async historias(projetoId: string) {
    return this.banco.select().from(historias).where(eq(historias.projetoId, projetoId)).orderBy(asc(historias.id));
  }

  async registrarNecessidade(projetoId: string, dados: unknown) {
    const nova = validar(esquemaNovaNecessidade, dados);
    return this.banco.transaction(async (tx) => {
      const [projeto] = await tx.select().from(projetos).where(eq(projetos.id, projetoId));
      if (!projeto) throw new NaoEncontradoError(`Projeto ${projetoId} não encontrado.`);
      const [{ maximo }] = await tx
        .select({ maximo: sql<number>`coalesce(max(substring(${necessidades.id} from 5)::int), 0)` })
        .from(necessidades);
      const id = `NEC-${String(Number(maximo) + 1).padStart(2, '0')}`;
      const [criada] = await tx.insert(necessidades).values({ id, projetoId, ...nova }).returning();
      return criada;
    });
  }

  /** Classifica o insumo (RF-02); sem isso nenhuma chamada à IA sai. */
  async classificar(necessidadeId: string, dados: unknown) {
    const { classificacao, anonimizacaoConfirmada } = validar(esquemaClassificacao, dados);
    const [atualizada] = await this.banco
      .update(necessidades)
      .set({ classificacao, anonimizacaoConfirmada })
      .where(eq(necessidades.id, necessidadeId))
      .returning();
    if (!atualizada) throw new NaoEncontradoError(`Necessidade ${necessidadeId} não encontrada.`);
    return atualizada;
  }

  /** Pede à IA uma proposta de história; o resultado fica pendente até a decisão humana. */
  async proporHistoria(necessidadeId: string, motor?: string) {
    const [necessidade] = await this.banco.select().from(necessidades).where(eq(necessidades.id, necessidadeId));
    if (!necessidade) throw new NaoEncontradoError(`Necessidade ${necessidadeId} não encontrada.`);
    const perfisDoProjeto = await this.perfis(necessidade.projetoId);
    const entrada: EntradaPropostaHistoria = {
      necessidade: { id: necessidade.id, textoOriginal: necessidade.textoOriginal, perfisAfetados: necessidade.perfisAfetados },
      perfis: perfisDoProjeto.map((p) => ({ id: p.id, nome: p.nome, resumo: p.resumo })),
    };
    return this.sugestoes.solicitar({
      projetoId: necessidade.projetoId,
      tarefa: tarefaPropostaHistoria.id,
      alvoTipo: 'necessidade',
      alvoId: necessidade.id,
      entrada,
      insumo: { classificacao: necessidade.classificacao, anonimizacaoConfirmada: necessidade.anonimizacaoConfirmada },
      motor,
    });
  }
}
