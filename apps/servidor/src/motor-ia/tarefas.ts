import { z } from 'zod';
import type { TarefaDeIA } from './porta';

/**
 * Papel, ação e benefício vêm em campos separados (RF-04). Um deles vazio não
 * invalida a saída: a história nasce marcada como incompleta.
 */
export const esquemaPropostaHistoria = z.object({
  titulo: z.string().trim().min(5).max(120),
  perfilId: z.string().nullable(),
  papel: z.string().trim(),
  acao: z.string().trim(),
  beneficio: z.string().trim(),
  criteriosAceite: z.array(z.string().trim().min(10)).min(1).max(8),
  fontes: z.array(z.string().trim().min(1)).default([]),
});
export type PropostaHistoria = z.infer<typeof esquemaPropostaHistoria>;

/** Compõe a frase da história a partir dos três campos. */
export function comporHistoria({ papel, acao, beneficio }: Pick<PropostaHistoria, 'papel' | 'acao' | 'beneficio'>): string {
  return `Como ${papel || '...'}, quero ${acao || '...'}, para ${beneficio || '...'}.`;
}

export function historiaIncompleta(p: Pick<PropostaHistoria, 'papel' | 'acao' | 'beneficio'>): boolean {
  return !p.papel || !p.acao || !p.beneficio;
}

export interface EntradaPropostaHistoria {
  necessidade: { id: string; textoOriginal: string; perfisAfetados: string[] };
  perfis: { id: string; nome: string; resumo: string }[];
}

function primeiraFrase(texto: string): string {
  return texto.split(/(?<=[.!?])\s+/)[0] ?? texto;
}

/** Proposta de história de usuário, critérios de aceite e perfil a partir de uma necessidade. */
export const tarefaPropostaHistoria: TarefaDeIA<EntradaPropostaHistoria, PropostaHistoria> = {
  id: 'proposta_historia',
  versaoPrompt: 'historia-v1.0',
  descricao: 'Propõe história de usuário, critérios de aceite e perfil a partir de uma necessidade em linguagem natural.',
  esquemaSaida: esquemaPropostaHistoria,
  montarPrompt({ necessidade, perfis }) {
    const listaPerfis = perfis.map((p) => `- ${p.id}: ${p.nome}. ${p.resumo}`).join('\n');
    return [
      'Você apoia uma equipe de produto de um órgão público a escrever requisitos.',
      'Leia a necessidade relatada por um usuário e proponha UMA história de usuário.',
      'Regras:',
      '- Escreva em português do Brasil, em linguagem simples.',
      '- A história segue o formato "Como <papel>, quero <ação>, para <benefício>"; devolva papel, ação e benefício em campos separados, sem as palavras "Como", "quero" e "para".',
      '- Os critérios de aceite seguem o formato "Dado <contexto>, quando <ação>, então <resultado>".',
      '- Preserve o problema relatado; não proponha solução que repita o ponto de abandono descrito.',
      '- Escolha em perfilId o perfil mais afetado entre os listados, ou null se nenhum servir.',
      '- Em fontes, copie literalmente os trechos da necessidade que sustentam a história.',
      '- Responda somente com JSON no formato {"titulo": string, "perfilId": string|null, "papel": string, "acao": string, "beneficio": string, "criteriosAceite": string[], "fontes": string[]}.',
      '',
      `Necessidade ${necessidade.id}:`,
      necessidade.textoOriginal,
      '',
      'Perfis disponíveis:',
      listaPerfis || '(nenhum)',
    ].join('\n');
  },
  simular({ necessidade, perfis }) {
    const perfil = perfis.find((p) => necessidade.perfisAfetados.includes(p.id)) ?? perfis[0];
    const rotulo = perfil ? `pessoa com o perfil ${perfil.id} (${perfil.nome})` : 'pessoa usuária do serviço';
    return {
      titulo: `Tratar o problema relatado na ${necessidade.id}`,
      perfilId: perfil?.id ?? null,
      papel: rotulo,
      acao: 'concluir o serviço sem a dificuldade relatada na necessidade',
      beneficio: 'não depender de atendimento presencial nem da ajuda de outra pessoa',
      criteriosAceite: [
        'Dado o fluxo atual do serviço, quando a pessoa chega ao ponto relatado na necessidade, então consegue avançar sem ajuda de terceiros.',
        'Dado que ocorre um erro, quando a mensagem aparece, então ela explica em linguagem simples o que fazer a seguir.',
      ],
      fontes: [primeiraFrase(necessidade.textoOriginal)],
    };
  },
};

export const TAREFAS: Record<string, TarefaDeIA<any, any>> = {
  [tarefaPropostaHistoria.id]: tarefaPropostaHistoria,
};
