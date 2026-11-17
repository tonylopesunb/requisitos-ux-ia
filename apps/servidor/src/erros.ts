export class NaoEncontradoError extends Error {}
export class RegraDeNegocioError extends Error {}
export class EntradaInvalidaError extends Error {
  constructor(mensagem: string, readonly detalhes?: unknown) {
    super(mensagem);
  }
}
