import { describe, expect, it, vi } from 'vitest';
import { MotorOllama } from '../src/motor-ia/adaptadores/ollama';
import { MotorSimulado } from '../src/motor-ia/adaptadores/simulado';
import type { IdentificacaoMotor, MotorDeIA } from '../src/motor-ia/porta';
import { ClassificacaoPendenteError, MotorDesconhecidoError, MotorNaoPermitidoError, RoteadorDeMotor } from '../src/motor-ia/roteador';
import { comporHistoria, esquemaPropostaHistoria, historiaIncompleta, tarefaPropostaHistoria, type EntradaPropostaHistoria } from '../src/motor-ia/tarefas';

const entrada: EntradaPropostaHistoria = {
  necessidade: {
    id: 'NEC-02',
    textoOriginal: 'O calendário de horários não funciona com meu leitor de tela. Ele lê só botão, botão.',
    perfisAfetados: ['PER-02'],
  },
  perfis: [
    { id: 'PER-01', nome: 'Celeste Amaral', resumo: 'Aposentada, 71 anos.' },
    { id: 'PER-02', nome: 'Joaquim Pires', resumo: 'Professor, usa leitor de tela.' },
  ],
};

function motorFalso(identificacao: Partial<IdentificacaoMotor>): MotorDeIA {
  return {
    identificacao: { provedor: 'x', modelo: 'x', versaoModelo: '1', local: false, ...identificacao },
    gerar: async () => ({ saidaBruta: '{}' }),
  };
}

describe('tarefa proposta_historia', () => {
  it('monta o prompt com a necessidade e os perfis', () => {
    const prompt = tarefaPropostaHistoria.montarPrompt(entrada);
    expect(prompt).toContain('Necessidade NEC-02');
    expect(prompt).toContain('PER-02: Joaquim Pires');
  });

  it('a resposta simulada obedece ao esquema e escolhe o perfil afetado', () => {
    const saida = esquemaPropostaHistoria.parse(tarefaPropostaHistoria.simular(entrada));
    expect(saida.perfilId).toBe('PER-02');
    expect(saida.criteriosAceite.length).toBeGreaterThan(0);
    expect(saida.fontes[0]).toContain('leitor de tela');
    expect(historiaIncompleta(saida)).toBe(false);
  });

  it('compõe a frase e marca incompleta quando falta papel, ação ou benefício (RF-04)', () => {
    expect(comporHistoria({ papel: 'pessoa cega', acao: 'reservar a quadra', beneficio: 'treinar' })).toBe(
      'Como pessoa cega, quero reservar a quadra, para treinar.',
    );
    expect(historiaIncompleta({ papel: 'pessoa cega', acao: '', beneficio: 'treinar' })).toBe(true);
  });
});

describe('MotorSimulado', () => {
  it('é local e devolve JSON válido', async () => {
    const motor = new MotorSimulado();
    expect(motor.identificacao.local).toBe(true);
    const { saidaBruta } = await motor.gerar({ tarefa: tarefaPropostaHistoria, entrada, prompt: '' });
    expect(esquemaPropostaHistoria.safeParse(JSON.parse(saidaBruta)).success).toBe(true);
  });
});

describe('MotorOllama', () => {
  it('chama /api/chat com o esquema da tarefa em "format" e devolve o conteúdo', async () => {
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify({ message: { content: '{"ok":true}' } })));
    const motor = new MotorOllama({ url: 'http://ollama:11434/', modelo: 'qwen2.5:7b', fetch: fetchFalso as typeof fetch });
    const resposta = await motor.gerar({ tarefa: tarefaPropostaHistoria, entrada, prompt: 'p' });

    expect(resposta.saidaBruta).toBe('{"ok":true}');
    expect(motor.identificacao).toEqual({ provedor: 'ollama', modelo: 'qwen2.5:7b', versaoModelo: '7b', local: true });
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ollama:11434/api/chat');
    const corpo = JSON.parse(String(init.body));
    expect(corpo.model).toBe('qwen2.5:7b');
    expect(corpo.stream).toBe(false);
    expect(corpo.format.required).toEqual(expect.arrayContaining(['titulo', 'papel', 'acao', 'beneficio', 'criteriosAceite']));
  });

  it('propaga erro HTTP do Ollama', async () => {
    const fetchFalso = vi.fn(async () => new Response('modelo não encontrado', { status: 404 }));
    const motor = new MotorOllama({ url: 'http://x', modelo: 'm', fetch: fetchFalso as typeof fetch });
    await expect(motor.gerar({ tarefa: tarefaPropostaHistoria, entrada, prompt: '' })).rejects.toThrow(/404/);
  });
});

describe('RoteadorDeMotor (guarda de roteamento, RF-02 e RF-30)', () => {
  const nuvem = motorFalso({ provedor: 'nuvem', local: false });
  const local = motorFalso({ provedor: 'ollama', local: true });
  const roteador = new RoteadorDeMotor({ nuvem, ollama: local }, 'nuvem', 'ollama');
  const semLocal = new RoteadorDeMotor({ nuvem }, 'nuvem', 'ollama');
  const projeto = { id: 'P', dadosReais: false, motorPreferido: null };
  const interno = { classificacao: 'interno' as const, anonimizacaoConfirmada: false };
  const restrito = { classificacao: 'restrito' as const, anonimizacaoConfirmada: true };

  it('usa o motor pedido, depois o preferido do projeto, depois o padrão', () => {
    expect(roteador.escolher({ ...projeto, motorPreferido: 'ollama' }, interno, 'nuvem')).toBe(nuvem);
    expect(roteador.escolher({ ...projeto, motorPreferido: 'ollama' }, interno)).toBe(local);
    expect(roteador.escolher(projeto, interno)).toBe(nuvem);
  });

  it('bloqueia a chamada enquanto o insumo não está classificado', () => {
    expect(() => roteador.escolher(projeto, { classificacao: null, anonimizacaoConfirmada: false })).toThrow(ClassificacaoPendenteError);
  });

  it('bloqueia insumo restrito ou sigiloso sem anonimização confirmada', () => {
    expect(() => roteador.escolher(projeto, { classificacao: 'sigiloso', anonimizacaoConfirmada: false })).toThrow(/anonimização/);
  });

  it('desvia insumo restrito para o motor local mesmo quando a nuvem foi pedida', () => {
    expect(roteador.escolher(projeto, restrito, 'nuvem')).toBe(local);
  });

  it('desvia projeto com dados reais para o motor local', () => {
    expect(roteador.escolher({ ...projeto, dadosReais: true }, interno, 'nuvem')).toBe(local);
  });

  it('sem motor local, bloqueia insumo restrito e projeto com dados reais', () => {
    expect(() => semLocal.escolher(projeto, restrito)).toThrow(MotorNaoPermitidoError);
    expect(() => semLocal.escolher({ ...projeto, dadosReais: true }, interno)).toThrow(/lista de verificação manual/);
    expect(semLocal.escolher(projeto, interno)).toBe(nuvem);
  });

  it('recusa motor desconhecido', () => {
    expect(() => roteador.escolher(projeto, interno, 'gpt')).toThrow(MotorDesconhecidoError);
  });
});
