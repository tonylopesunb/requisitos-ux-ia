import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, date } from 'drizzle-orm/pg-core';

/**
 * Projeto de requisitos. O campo dadosReais aciona a guarda de roteamento:
 * quando verdadeiro, só adaptadores locais do motor de IA podem ser usados.
 */
export const projetos = pgTable('projetos', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  orgao: text('orgao').notNull(),
  dadosReais: boolean('dados_reais').notNull().default(false),
  motorPreferido: text('motor_preferido'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const perfis = pgTable('perfis', {
  id: text('id').primaryKey(),
  projetoId: text('projeto_id').notNull().references(() => projetos.id),
  nome: text('nome').notNull(),
  resumo: text('resumo').notNull(),
  detalhes: jsonb('detalhes').$type<Record<string, unknown>>().notNull().default({}),
});

export const TIPOS_ORIGEM = ['entrevista', 'ata', 'chamado', 'retorno_homologacao', 'documento'] as const;
export type TipoOrigem = (typeof TIPOS_ORIGEM)[number];
/** Classificação da informação em quatro níveis (RF-02); decide para onde a chamada à IA pode ir. */
export const CLASSIFICACOES = ['publico', 'interno', 'restrito', 'sigiloso'] as const;
export type Classificacao = (typeof CLASSIFICACOES)[number];
export const PAPEIS = ['product_owner', 'ux', 'governanca'] as const;
export type Papel = (typeof PAPEIS)[number];

export const necessidades = pgTable('necessidades', {
  id: text('id').primaryKey(),
  projetoId: text('projeto_id').notNull().references(() => projetos.id),
  textoOriginal: text('texto_original').notNull(),
  tipoOrigem: text('tipo_origem').$type<TipoOrigem>().notNull(),
  classificacao: text('classificacao').$type<Classificacao>(),
  anonimizacaoConfirmada: boolean('anonimizacao_confirmada').notNull().default(false),
  estado: text('estado').notNull().default('nova'),
  canal: text('canal'),
  servicoId: text('servico_id'),
  perfisAfetados: text('perfis_afetados').array().notNull().default([]),
  dataRegistro: date('data_registro').notNull().defaultNow(),
});

export const historias = pgTable('historias', {
  id: text('id').primaryKey(),
  projetoId: text('projeto_id').notNull().references(() => projetos.id),
  necessidadeId: text('necessidade_id').references(() => necessidades.id),
  perfilId: text('perfil_id').references(() => perfis.id),
  titulo: text('titulo').notNull(),
  /** Papel, ação e benefício em campos separados (RF-04); historia guarda a frase composta. */
  papel: text('papel'),
  acao: text('acao'),
  beneficio: text('beneficio'),
  historia: text('historia').notNull(),
  criteriosAceite: jsonb('criterios_aceite').$type<string[]>().notNull(),
  /** Proveniência do texto final (RF-29): proposta_ia_aceita, proposta_ia_editada ou manual. */
  origem: text('origem').notNull(),
  sugestaoId: uuid('sugestao_id'),
  situacao: text('situacao').notNull().default('em_especificacao'),
});

export type SituacaoSugestao = 'pendente' | 'aceita' | 'editada' | 'recusada' | 'invalida';
export type Decisao = 'aceitar' | 'editar' | 'recusar';

/**
 * Sugestão da IA. Nada do que a IA produz entra no domínio sem passar por aqui
 * e sem uma decisão humana (aceitar, editar ou recusar).
 */
export const sugestoes = pgTable('sugestoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  projetoId: text('projeto_id').notNull().references(() => projetos.id),
  tarefa: text('tarefa').notNull(),
  alvoTipo: text('alvo_tipo').notNull(),
  alvoId: text('alvo_id').notNull(),
  conteudo: jsonb('conteudo').$type<unknown>(),
  situacao: text('situacao').$type<SituacaoSugestao>().notNull().default('pendente'),
  decisao: text('decisao').$type<Decisao>(),
  conteudoFinal: jsonb('conteudo_final').$type<unknown>(),
  decididoPor: text('decidido_por'),
  papel: text('papel').$type<Papel>(),
  decididoEm: timestamp('decidido_em', { withTimezone: true }),
  observacao: text('observacao'),
  resultadoTipo: text('resultado_tipo'),
  resultadoId: text('resultado_id'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

/** Cada chamada feita ao motor de IA, com tudo o que é preciso para auditá-la. */
export const chamadasIa = pgTable('chamadas_ia', {
  id: uuid('id').primaryKey().defaultRandom(),
  sugestaoId: uuid('sugestao_id').notNull().references(() => sugestoes.id),
  tarefa: text('tarefa').notNull(),
  provedor: text('provedor').notNull(),
  modelo: text('modelo').notNull(),
  versaoModelo: text('versao_modelo').notNull(),
  versaoPrompt: text('versao_prompt').notNull(),
  local: boolean('local').notNull(),
  classificacaoEntrada: text('classificacao_entrada').$type<Classificacao>(),
  entrada: jsonb('entrada').$type<unknown>().notNull(),
  prompt: text('prompt'),
  saidaBruta: text('saida_bruta'),
  saidaValida: boolean('saida_valida').notNull(),
  /** Fontes que a saída cita (trechos da necessidade, heurísticas, critérios), quando a tarefa as devolve. */
  fontes: jsonb('fontes').$type<unknown[]>(),
  erro: text('erro'),
  duracaoMs: integer('duracao_ms'),
  executadaEm: timestamp('executada_em', { withTimezone: true }).notNull().defaultNow(),
});
