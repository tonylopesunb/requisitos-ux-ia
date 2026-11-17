import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { validar } from '../validacao';
import { CapturaServico } from './captura.servico';

const esquemaPedidoProposta = z.object({ motor: z.string().optional() }).default({});

@Controller()
export class CapturaControlador {
  constructor(@Inject(CapturaServico) private readonly servico: CapturaServico) {}

  @Get('projetos')
  projetos() {
    return this.servico.projetos();
  }

  @Get('projetos/:projetoId/perfis')
  perfis(@Param('projetoId') projetoId: string) {
    return this.servico.perfis(projetoId);
  }

  @Get('projetos/:projetoId/necessidades')
  necessidades(@Param('projetoId') projetoId: string) {
    return this.servico.necessidades(projetoId);
  }

  @Post('projetos/:projetoId/necessidades')
  registrar(@Param('projetoId') projetoId: string, @Body() corpo: unknown) {
    return this.servico.registrarNecessidade(projetoId, corpo);
  }

  @Get('projetos/:projetoId/historias')
  historias(@Param('projetoId') projetoId: string) {
    return this.servico.historias(projetoId);
  }

  @Put('necessidades/:id/classificacao')
  classificar(@Param('id') id: string, @Body() corpo: unknown) {
    return this.servico.classificar(id, corpo);
  }

  @Post('necessidades/:id/proposta-historia')
  propor(@Param('id') id: string, @Body() corpo: unknown) {
    const { motor } = validar(esquemaPedidoProposta, corpo ?? {});
    return this.servico.proporHistoria(id, motor);
  }
}
