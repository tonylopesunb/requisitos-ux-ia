import { describe, expect, it } from 'vitest';
import { separarHistoria } from '../src/banco/semear';

describe('separarHistoria', () => {
  it('separa papel, ação e benefício', () => {
    expect(separarHistoria('Como pessoa idosa, quero renovar o passe, para não ir ao balcão.')).toEqual({
      papel: 'pessoa idosa',
      acao: 'renovar o passe',
      beneficio: 'não ir ao balcão',
    });
  });

  it('devolve campos vazios quando a frase foge do formato', () => {
    expect(separarHistoria('Renovar o passe.')).toEqual({ papel: null, acao: null, beneficio: null });
  });
});
