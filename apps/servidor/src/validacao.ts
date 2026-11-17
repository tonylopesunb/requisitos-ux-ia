import type { z } from 'zod';
import { EntradaInvalidaError } from './erros';

export function validar<T>(esquema: z.ZodType<T>, valor: unknown): T {
  const resultado = esquema.safeParse(valor);
  if (!resultado.success) {
    const resumo = resultado.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
    throw new EntradaInvalidaError(`Dados inválidos. ${resumo}`, resultado.error.issues);
  }
  return resultado.data;
}
