import type { MotorDeIA } from './porta';

export class MotorNaoPermitidoError extends Error {}
export class MotorDesconhecidoError extends Error {}
/** A chamada não pode sair enquanto a entrada não estiver classificada e, se preciso, anonimizada (RF-02). */
export class ClassificacaoPendenteError extends Error {}

export interface ProjetoParaRoteamento {
  id: string;
  dadosReais: boolean;
  motorPreferido: string | null;
}

export interface InsumoParaRoteamento {
  classificacao: 'publico' | 'interno' | 'restrito' | 'sigiloso' | null;
  anonimizacaoConfirmada: boolean;
}

/**
 * Guarda de roteamento. Escolhe o adaptador do motor de IA e garante, no
 * servidor, que insumo restrito ou sigiloso e projeto com dados reais só
 * cheguem a um motor local (RF-30). Quando o motor pedido não é local, a
 * chamada é desviada para o motor local configurado; sem motor local, é bloqueada.
 */
export class RoteadorDeMotor {
  constructor(
    private readonly motores: Record<string, MotorDeIA>,
    private readonly padrao: string,
    private readonly localPadrao?: string,
  ) {}

  disponiveis(): { nome: string; local: boolean }[] {
    return Object.entries(this.motores).map(([nome, m]) => ({ nome, local: m.identificacao.local }));
  }

  escolher(projeto: ProjetoParaRoteamento, insumo: InsumoParaRoteamento, pedido?: string): MotorDeIA {
    if (!insumo.classificacao) {
      throw new ClassificacaoPendenteError('Classifique a necessidade (público, interno, restrito ou sigiloso) antes de pedir sugestão à IA.');
    }
    const sensivel = insumo.classificacao === 'restrito' || insumo.classificacao === 'sigiloso';
    if (sensivel && !insumo.anonimizacaoConfirmada) {
      throw new ClassificacaoPendenteError('Insumo restrito ou sigiloso: confirme a anonimização antes de pedir sugestão à IA.');
    }

    const nome = pedido ?? projeto.motorPreferido ?? this.padrao;
    const motor = this.motores[nome];
    if (!motor) {
      throw new MotorDesconhecidoError(`Motor de IA "${nome}" não está configurado.`);
    }
    if (motor.identificacao.local || !(sensivel || projeto.dadosReais)) {
      return motor;
    }
    const local = this.localPadrao ? this.motores[this.localPadrao] : undefined;
    if (local?.identificacao.local) {
      return local;
    }
    throw new MotorNaoPermitidoError(
      projeto.dadosReais
        ? `O projeto ${projeto.id} contém dados reais e não há motor local configurado; use a lista de verificação manual.`
        : `Insumo ${insumo.classificacao} só pode ir a motor local, e nenhum está configurado; use a lista de verificação manual.`,
    );
  }
}
