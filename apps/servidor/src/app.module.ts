import { Controller, Get, Inject, Module } from '@nestjs/common';
import { BancoModule } from './banco/banco.module';
import { CapturaModule } from './captura/captura.module';
import { MotorIaModule, ROTEADOR_DE_MOTOR } from './motor-ia/motor-ia.module';
import type { RoteadorDeMotor } from './motor-ia/roteador';
import { TAREFAS } from './motor-ia/tarefas';
import { SugestoesModule } from './sugestoes/sugestoes.module';

@Controller()
class SaudeControlador {
  constructor(@Inject(ROTEADOR_DE_MOTOR) private readonly roteador: RoteadorDeMotor) {}

  @Get('saude')
  saude() {
    return { situacao: 'ok', motores: this.roteador.disponiveis(), tarefas: Object.keys(TAREFAS) };
  }
}

// Módulos previstos na arquitetura e ainda não implementados: auditoria antecipada,
// Definition of Ready e rastreabilidade (fases seguintes).
@Module({
  imports: [BancoModule, MotorIaModule, SugestoesModule, CapturaModule],
  controllers: [SaudeControlador],
})
export class AppModule {}
