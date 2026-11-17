import { Module } from '@nestjs/common';
import { BANCO, type Banco } from '../banco/conexao';
import { BancoModule } from '../banco/banco.module';
import { MotorIaModule, ROTEADOR_DE_MOTOR } from '../motor-ia/motor-ia.module';
import type { RoteadorDeMotor } from '../motor-ia/roteador';
import { SugestoesControlador } from './sugestoes.controlador';
import { SugestoesServico } from './sugestoes.servico';

@Module({
  imports: [BancoModule, MotorIaModule],
  controllers: [SugestoesControlador],
  providers: [
    {
      provide: SugestoesServico,
      inject: [BANCO, ROTEADOR_DE_MOTOR],
      useFactory: (banco: Banco, roteador: RoteadorDeMotor) => new SugestoesServico(banco, roteador),
    },
  ],
  exports: [SugestoesServico],
})
export class SugestoesModule {}
