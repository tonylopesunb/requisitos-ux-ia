type LinhaRegistro = Record<string, unknown>;

const COLUNAS = [
  'codigo', 'projetoId', 'tarefa', 'alvoTipo', 'alvoId', 'provedor', 'modelo', 'versaoModelo',
  'versaoPrompt', 'local', 'classificacaoEntrada', 'executadaEm', 'entrada', 'saidaBruta', 'saidaValida', 'erro', 'fontes',
  'decisao', 'conteudoFinal', 'decididoPor', 'papel', 'decididoEm', 'observacao', 'resultadoTipo', 'resultadoId', 'situacao',
] as const;

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto = valor instanceof Date ? valor.toISOString() : typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  return /[",;\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV com separador ponto e vírgula, que abre direto em planilhas configuradas em português. */
export function registroParaCsv(linhas: LinhaRegistro[]): string {
  const cabecalho = COLUNAS.join(';');
  const corpo = linhas.map((linha) => COLUNAS.map((c) => celula(linha[c])).join(';'));
  return `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}
