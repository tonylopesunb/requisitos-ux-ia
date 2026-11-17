import { z } from 'zod';
import type { IdentificacaoMotor, MotorDeIA, PedidoAoMotor, RespostaDoMotor } from '../porta';

export interface OpcoesOllama {
  url: string;
  modelo: string;
  /** Permite injetar outro fetch nos testes. */
  fetch?: typeof fetch;
  tempoLimiteMs?: number;
}

/**
 * Adaptador para modelo de pesos abertos servido localmente pelo Ollama.
 * É o único caminho admitido para projetos com dados reais.
 */
export class MotorOllama implements MotorDeIA {
  readonly identificacao: IdentificacaoMotor;
  private readonly fetch: typeof fetch;

  constructor(private readonly opcoes: OpcoesOllama) {
    this.fetch = opcoes.fetch ?? globalThis.fetch;
    const [, tag = 'latest'] = opcoes.modelo.split(':');
    this.identificacao = { provedor: 'ollama', modelo: opcoes.modelo, versaoModelo: tag, local: true };
  }

  async gerar<E>(pedido: PedidoAoMotor<E>): Promise<RespostaDoMotor> {
    const resposta = await this.fetch(`${this.opcoes.url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(this.opcoes.tempoLimiteMs ?? 120_000),
      body: JSON.stringify({
        model: this.opcoes.modelo,
        stream: false,
        // O Ollama aceita um JSON Schema em "format" e restringe a geração a ele.
        format: z.toJSONSchema(pedido.tarefa.esquemaSaida),
        options: { temperature: 0.2 },
        messages: [{ role: 'user', content: pedido.prompt }],
      }),
    });
    if (!resposta.ok) {
      throw new Error(`Ollama respondeu ${resposta.status}: ${await resposta.text()}`);
    }
    const corpo = (await resposta.json()) as { message?: { content?: string } };
    const conteudo = corpo.message?.content;
    if (typeof conteudo !== 'string') {
      throw new Error('Resposta do Ollama sem message.content');
    }
    return { saidaBruta: conteudo };
  }
}
