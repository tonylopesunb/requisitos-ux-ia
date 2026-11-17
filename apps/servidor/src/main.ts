import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { lerConfiguracao } from './config';
import { FiltroDeErros } from './filtro-erros';

async function iniciar() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new FiltroDeErros());
  app.enableCors();
  app.enableShutdownHooks();
  const { porta } = lerConfiguracao();
  await app.listen(porta);
  console.log(`Servidor ouvindo em http://localhost:${porta}/api`);
}

iniciar();
