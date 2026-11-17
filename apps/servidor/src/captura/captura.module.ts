import { Module } from '@nestjs/common';
import { BANCO, type Banco } from '../banco/conexao';
import { SugestoesModule } from '../sugestoes/sugestoes.module';
import { SugestoesServico } from '../sugestoes/sugestoes.servico';
import { CapturaControlador } from './captura.controlador';
import { CapturaServico } from './captura.servico';

@Module({
  imports: [SugestoesModule],
  controllers: [CapturaControlador],
  providers: [
    {
      provide: CapturaServico,
      inject: [BANCO, SugestoesServico],
      useFactory: (banco: Banco, sugestoes: SugestoesServico) => new CapturaServico(banco, sugestoes),
    },
  ],
})
export class CapturaModule {}
