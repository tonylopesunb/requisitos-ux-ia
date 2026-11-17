import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';
import { lerConfiguracao } from '../config';
import { BANCO, criarBanco } from './conexao';

const POOL = Symbol('POOL');

@Global()
@Module({
  providers: [
    { provide: 'CONEXAO', useFactory: () => criarBanco(lerConfiguracao().databaseUrl) },
    { provide: BANCO, inject: ['CONEXAO'], useFactory: (c: ReturnType<typeof criarBanco>) => c.banco },
    { provide: POOL, inject: ['CONEXAO'], useFactory: (c: ReturnType<typeof criarBanco>) => c.pool },
  ],
  exports: [BANCO],
})
export class BancoModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
