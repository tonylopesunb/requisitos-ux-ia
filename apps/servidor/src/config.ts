export interface Configuracao {
  databaseUrl: string;
  porta: number;
  motorPadrao: string;
  ollamaUrl: string;
  ollamaModelo: string;
}

export function lerConfiguracao(env: NodeJS.ProcessEnv = process.env): Configuracao {
  return {
    databaseUrl: env.DATABASE_URL ?? 'postgres://requisitos:requisitos@localhost:5432/requisitos',
    porta: Number(env.PORTA ?? 3000),
    motorPadrao: env.MOTOR_IA_PADRAO ?? 'simulado',
    ollamaUrl: env.OLLAMA_URL ?? 'http://localhost:11434',
    ollamaModelo: env.OLLAMA_MODELO ?? 'llama3.1:8b',
  };
}
