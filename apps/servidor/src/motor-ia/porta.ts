import type { z } from 'zod';

/** Identifica o motor que produziu uma saída; vai inteiro para o registro de IA. */
export interface IdentificacaoMotor {
  provedor: string;
  modelo: string;
  versaoModelo: string;
  /** Verdadeiro quando nenhum dado sai da máquina que roda a aplicação. */
  local: boolean;
}

export interface PedidoAoMotor<E = unknown> {
  tarefa: TarefaDeIA<E, unknown>;
  entrada: E;
  prompt: string;
}

export interface RespostaDoMotor {
  /** Texto exatamente como o modelo devolveu, antes de qualquer validação. */
  saidaBruta: string;
}

/**
 * Porta do motor de IA. A aplicação conhece apenas esta interface; cada
 * provedor (simulado, Ollama, nuvem) é um adaptador que a implementa.
 */
export interface MotorDeIA {
  readonly identificacao: IdentificacaoMotor;
  gerar<E>(pedido: PedidoAoMotor<E>): Promise<RespostaDoMotor>;
}

/**
 * Uma tarefa de IA descreve o que se pede ao modelo: como montar o prompt,
 * qual esquema a saída deve obedecer e o que o adaptador simulado responde.
 */
export interface TarefaDeIA<E, S> {
  id: string;
  versaoPrompt: string;
  descricao: string;
  esquemaSaida: z.ZodType<S>;
  montarPrompt(entrada: E): string;
  simular(entrada: E): S;
}
