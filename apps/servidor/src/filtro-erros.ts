import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { EntradaInvalidaError, NaoEncontradoError, RegraDeNegocioError } from './erros';
import { ClassificacaoPendenteError, MotorDesconhecidoError, MotorNaoPermitidoError } from './motor-ia/roteador';

/** Traduz erros do domínio em respostas HTTP com mensagem em português. */
@Catch()
export class FiltroDeErros implements ExceptionFilter {
  catch(erro: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<Response>();
    if (erro instanceof HttpException) {
      resposta.status(erro.getStatus()).json(erro.getResponse());
      return;
    }
    const [status, detalhes] =
      erro instanceof NaoEncontradoError ? [404]
      : erro instanceof MotorNaoPermitidoError ? [403]
      : erro instanceof RegraDeNegocioError || erro instanceof MotorDesconhecidoError || erro instanceof ClassificacaoPendenteError ? [409]
      : erro instanceof EntradaInvalidaError ? [400, erro.detalhes]
      : [500];
    if (status === 500) console.error(erro);
    const mensagem = status === 500 ? 'Erro interno.' : (erro as Error).message;
    resposta.status(status).json({ mensagem, ...(detalhes ? { detalhes } : {}) });
  }
}
