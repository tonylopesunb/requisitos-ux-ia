import type { IdentificacaoMotor, MotorDeIA, PedidoAoMotor, RespostaDoMotor } from '../porta';

/**
 * Adaptador determinístico, sem rede. Serve para demonstração, testes e
 * desenvolvimento sem modelo instalado. Responde com a função simular() da tarefa.
 */
export class MotorSimulado implements MotorDeIA {
  readonly identificacao: IdentificacaoMotor = {
    provedor: 'simulado',
    modelo: 'simulado',
    versaoModelo: '1',
    local: true,
  };

  async gerar<E>(pedido: PedidoAoMotor<E>): Promise<RespostaDoMotor> {
    return { saidaBruta: JSON.stringify(pedido.tarefa.simular(pedido.entrada)) };
  }
}
