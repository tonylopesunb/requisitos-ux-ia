export type Classificacao = 'publico' | 'interno' | 'restrito' | 'sigiloso';
export type Papel = 'product_owner' | 'ux' | 'governanca';
export const ROTULO_PAPEL: Record<Papel, string> = { product_owner: 'Product Owner', ux: 'Responsável por UX', governanca: 'Governança' };

export interface Necessidade {
  id: string;
  textoOriginal: string;
  canal: string | null;
  tipoOrigem: string;
  classificacao: Classificacao | null;
  anonimizacaoConfirmada: boolean;
  estado: string;
  perfisAfetados: string[];
  dataRegistro: string;
}

export interface Perfil {
  id: string;
  nome: string;
  resumo: string;
}

export interface PropostaHistoria {
  titulo: string;
  perfilId: string | null;
  papel: string;
  acao: string;
  beneficio: string;
  criteriosAceite: string[];
  fontes: string[];
}

export interface LinhaRegistro {
  id: string;
  codigo: string;
  tarefa: string;
  alvoTipo: string;
  alvoId: string;
  situacao: 'pendente' | 'aceita' | 'editada' | 'recusada' | 'invalida';
  provedor: string;
  modelo: string;
  versaoModelo: string;
  versaoPrompt: string;
  local: boolean;
  classificacaoEntrada: Classificacao | null;
  fontes: string[] | null;
  papel: Papel | null;
  executadaEm: string;
  saidaBruta: string | null;
  erro: string | null;
  conteudo: unknown;
  conteudoFinal: unknown;
  decisao: string | null;
  decididoPor: string | null;
  decididoEm: string | null;
  observacao: string | null;
  resultadoId: string | null;
}

export class ErroDaApi extends Error {}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api${caminho}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ErroDaApi(corpo?.mensagem ?? `Erro ${resposta.status}`);
  return corpo as T;
}

export const api = {
  saude: () => chamar<{ motores: { nome: string; local: boolean }[] }>('/saude'),
  projetos: () => chamar<{ id: string; nome: string; dadosReais: boolean; motorPreferido: string | null }[]>('/projetos'),
  necessidades: (projeto: string) => chamar<Necessidade[]>(`/projetos/${projeto}/necessidades`),
  perfis: (projeto: string) => chamar<Perfil[]>(`/projetos/${projeto}/perfis`),
  proporHistoria: (necessidade: string, motor: string) =>
    chamar<LinhaRegistro>(`/necessidades/${necessidade}/proposta-historia`, { method: 'POST', body: JSON.stringify({ motor }) }),
  sugestao: (id: string) => chamar<LinhaRegistro>(`/sugestoes/${id}`),
  classificar: (necessidade: string, corpo: { classificacao: Classificacao; anonimizacaoConfirmada: boolean }) =>
    chamar<Necessidade>(`/necessidades/${necessidade}/classificacao`, { method: 'PUT', body: JSON.stringify(corpo) }),
  decidir: (id: string, corpo: { decisao: string; pessoa: string; papel: Papel; conteudoEditado?: unknown; observacao?: string }) =>
    chamar<LinhaRegistro>(`/sugestoes/${id}/decisao`, { method: 'POST', body: JSON.stringify(corpo) }),
  registro: (consulta: URLSearchParams) => chamar<LinhaRegistro[]>(`/registro-ia?${consulta}`),
};
