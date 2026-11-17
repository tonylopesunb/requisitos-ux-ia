import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { lerConfiguracao } from '../config';
import { criarBanco } from './conexao';

export async function migrar(url: string): Promise<void> {
  const { banco, pool } = criarBanco(url);
  try {
    await migrate(banco, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrar(lerConfiguracao().databaseUrl)
    .then(() => console.log('Migrações aplicadas.'))
    .catch((erro) => {
      console.error(erro);
      process.exit(1);
    });
}
