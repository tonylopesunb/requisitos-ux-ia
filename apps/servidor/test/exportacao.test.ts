import { describe, expect, it } from 'vitest';
import { registroParaCsv } from '../src/sugestoes/exportacao';

describe('registroParaCsv', () => {
  it('usa ponto e vírgula, BOM e escapa aspas, quebras e objetos', () => {
    const csv = registroParaCsv([
      { codigo: 'IA-0001', entrada: { a: 1 }, observacao: 'disse "não"; depois\nmudou', local: true, decididoEm: new Date('2026-09-11T15:00:00Z') },
    ]);
    expect(csv.startsWith('﻿codigo;projetoId;')).toBe(true);
    const linha = csv.split('\r\n')[1];
    expect(linha).toContain('IA-0001;');
    expect(linha).toContain('"{""a"":1}"');
    expect(linha).toContain('"disse ""não""; depois\nmudou"');
    expect(linha).toContain('2026-09-11T15:00:00.000Z');
  });
});
