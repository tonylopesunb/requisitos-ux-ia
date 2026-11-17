import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as esquema from './esquema';

export type Banco = NodePgDatabase<typeof esquema>;
export const BANCO = Symbol('BANCO');

export function criarBanco(url: string): { banco: Banco; pool: Pool } {
  const pool = new Pool({ connectionString: url });
  return { banco: drizzle(pool, { schema: esquema }), pool };
}
