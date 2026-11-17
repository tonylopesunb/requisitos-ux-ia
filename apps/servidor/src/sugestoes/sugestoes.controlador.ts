import { Body, Controller, Get, Header, Inject, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { registroParaCsv } from './exportacao';
import { SugestoesServico, type FiltrosRegistro } from './sugestoes.servico';

type Consulta = Record<string, string | undefined>;
const filtros = (q: Consulta): FiltrosRegistro => ({
  projetoId: q.projeto,
  alvoId: q.item,
  tarefa: q.tarefa,
  provedor: q.provedor,
  situacao: q.situacao,
  de: q.de,
  ate: q.ate,
});

@Controller()
export class SugestoesControlador {
  constructor(@Inject(SugestoesServico) private readonly servico: SugestoesServico) {}

  @Get('sugestoes/:id')
  obter(@Param('id', ParseUUIDPipe) id: string) {
    return this.servico.obter(id);
  }

  @Post('sugestoes/:id/decisao')
  decidir(@Param('id', ParseUUIDPipe) id: string, @Body() corpo: unknown) {
    return this.servico.decidir(id, corpo);
  }

  @Get('registro-ia')
  registro(@Query() consulta: Consulta) {
    return this.servico.registro(filtros(consulta));
  }

  @Get('registro-ia/exportar')
  @Header('cache-control', 'no-store')
  async exportar(@Res() res: Response, @Query() consulta: Consulta) {
    const formato = consulta.formato ?? 'json';
    const linhas = await this.servico.registro(filtros(consulta));
    const data = new Date().toISOString().slice(0, 10);
    if (formato === 'csv') {
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader('content-disposition', `attachment; filename="registro-ia-${data}.csv"`);
      res.send(registroParaCsv(linhas));
      return;
    }
    res.setHeader('content-disposition', `attachment; filename="registro-ia-${data}.json"`);
    res.json({ exportadoEm: new Date().toISOString(), filtros: filtros(consulta), total: linhas.length, registros: linhas });
  }
}
