import { Module } from '@nestjs/common';
import { lerConfiguracao } from '../config';
import { MotorOllama } from './adaptadores/ollama';
import { MotorSimulado } from './adaptadores/simulado';
import { RoteadorDeMotor } from './roteador';

export const ROTEADOR_DE_MOTOR = Symbol('ROTEADOR_DE_MOTOR');

export function criarRoteadorPadrao(): RoteadorDeMotor {
  const config = lerConfiguracao();
  return new RoteadorDeMotor(
    {
      simulado: new MotorSimulado(),
      ollama: new MotorOllama({ url: config.ollamaUrl, modelo: config.ollamaModelo }),
      // O adaptador de nuvem entra numa fase seguinte, sempre restrito a dados fictícios.
    },
    config.motorPadrao,
    'ollama',
  );
}

@Module({
  providers: [{ provide: ROTEADOR_DE_MOTOR, useFactory: criarRoteadorPadrao }],
  exports: [ROTEADOR_DE_MOTOR],
})
export class MotorIaModule {}
