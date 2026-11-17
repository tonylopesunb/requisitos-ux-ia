import { eq } from 'drizzle-orm';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarBanco } from '../src/banco/conexao';
import { chamadasIa, historias, necessidades, projetos, sugestoes as sugestoes_ } from '../src/banco/esquema';
import { PROJETO_DEMO, semear } from '../src/banco/semear';
import { CapturaServico } from '../src/captura/captura.servico';
import { EntradaInvalidaError, RegraDeNegocioError } from '../src/erros';
import { MotorSimulado } from '../src/motor-ia/adaptadores/simulado';
import type { MotorDeIA } from '../src/motor-ia/porta';
import { ClassificacaoPendenteError, MotorNaoPermitidoError, RoteadorDeMotor } from '../src/motor-ia/roteador';
import { SugestoesServico } from '../src/sugestoes/sugestoes.servico';

/**
 * Testes de integração contra PostgreSQL. Rodam quando DATABASE_URL_TESTE está
 * definida (o banco é apagado e recarregado com os dados fictícios a cada teste).
 */
const url = process.env.DATABASE_URL_TESTE;

const motorQueresponde = (saidaBruta: string, local = true): MotorDeIA => ({
  identificacao: { provedor: 'teste', modelo: 'teste', versaoModelo: '0', local },
  gerar: async () => ({ saidaBruta }),
});

describe.skipIf(!url)('sugestões e registro de IA (PostgreSQL)', () => {
  const { banco, pool } = criarBanco(url ?? '');
  const roteador = new RoteadorDeMotor(
    {
      simulado: new MotorSimulado(),
      quebrado: motorQueresponde('isto não é json'),
      fora: motorQueresponde('{"titulo":"x"}'),
      nuvem: motorQueresponde('{}', false),
    },
    'simulado',
    'simulado',
  );
  const PO = { pessoa: 'EQP-01', papel: 'product_owner' as const };
  const PO_ACEITA = { decisao: 'aceitar' as const, ...PO };
  const sugestoes = new SugestoesServico(banco, roteador);
  const captura = new CapturaServico(banco, sugestoes);

  beforeAll(async () => {
    await migrate(banco, { migrationsFolder: path.resolve(__dirname, '../drizzle') });
  });
  beforeEach(async () => {
    await semear(banco);
  });
  afterAll(async () => {
    await pool.end();
  });

  it('carrega o registro histórico da FUNCEP com as quatro situações', async () => {
    const registro = await sugestoes.registro({ projetoId: PROJETO_DEMO });
    expect(registro).toHaveLength(26);
    expect(new Set(registro.map((r) => r.situacao))).toEqual(new Set(['aceita', 'editada', 'recusada', 'pendente']));
    expect(registro.find((r) => r.codigo === 'IA-0008')?.local).toBe(true);
    expect(registro.every((r) => r.classificacaoEntrada === 'interno')).toBe(true);
  });

  it('proposta da IA fica pendente e não cria história antes da decisão', async () => {
    const antes = await banco.select().from(historias);
    const sugestao = await captura.proporHistoria('NEC-02');

    expect(sugestao.codigo).toBe('IA-0027');
    expect(sugestao.situacao).toBe('pendente');
    expect(sugestao.chamada).toMatchObject({ provedor: 'simulado', versaoPrompt: 'historia-v1.0', saidaValida: true, classificacaoEntrada: 'interno' });
    expect(sugestao.chamada.fontes).toHaveLength(1);
    expect(await banco.select().from(historias)).toHaveLength(antes.length);
  });

  it('aceitar cria a história ligada à sugestão e registra quem decidiu', async () => {
    const { id } = await captura.proporHistoria('NEC-02');
    const decidida = await sugestoes.decidir(id, PO_ACEITA);

    expect(decidida).toMatchObject({ situacao: 'aceita', decididoPor: 'EQP-01', papel: 'product_owner', resultadoTipo: 'historia', resultadoId: 'HIS-09' });
    const [historia] = await banco.select().from(historias).where(eq(historias.id, 'HIS-09'));
    expect(historia).toMatchObject({ necessidadeId: 'NEC-02', origem: 'proposta_ia_aceita', sugestaoId: id, perfilId: 'PER-02', situacao: 'em_especificacao' });
    expect(historia.historia).toMatch(/^Como pessoa com o perfil PER-02 .*, quero .*, para .*\.$/);
  });

  it('editar valida o conteúdo editado pelo esquema e grava a versão final', async () => {
    const { id } = await captura.proporHistoria('NEC-01');
    await expect(
      sugestoes.decidir(id, { decisao: 'editar', ...PO, conteudoEditado: { titulo: 'curto' } }),
    ).rejects.toThrow(EntradaInvalidaError);

    const editado = {
      titulo: 'Renovar passe sem reenviar documento',
      perfilId: 'PER-01',
      papel: 'pessoa idosa',
      acao: 'renovar o passe confirmando meus dados',
      beneficio: '',
      criteriosAceite: ['Dado um passe perto do vencimento, quando confirmo os dados, então a renovação conclui.'],
      fontes: [],
    };
    const decidida = await sugestoes.decidir(id, { decisao: 'editar', ...PO, conteudoEditado: editado, observacao: 'Tirei o envio de foto.' });
    // RF-07: o rascunho original e a versão editada ficam guardados lado a lado.
    expect(decidida).toMatchObject({ situacao: 'editada', conteudoFinal: editado, observacao: 'Tirei o envio de foto.' });
    expect(decidida.conteudo).not.toEqual(editado);
    const [historia] = await banco.select().from(historias).where(eq(historias.id, decidida.resultadoId!));
    // RF-04: benefício vazio deixa a história incompleta; RF-29: proveniência editada.
    expect(historia).toMatchObject({ titulo: editado.titulo, origem: 'proposta_ia_editada', situacao: 'incompleta', beneficio: null });
  });

  it('recusar não cria nada no domínio e impede segunda decisão', async () => {
    const { id } = await captura.proporHistoria('NEC-03');
    const antes = await banco.select().from(historias);
    await sugestoes.decidir(id, { decisao: 'recusar', ...PO, observacao: 'Fora do problema relatado.' });

    expect(await banco.select().from(historias)).toHaveLength(antes.length);
    await expect(sugestoes.decidir(id, PO_ACEITA)).rejects.toThrow(RegraDeNegocioError);
  });

  it('exige a pessoa que decidiu e o papel exercido (RF-21)', async () => {
    const { id } = await captura.proporHistoria('NEC-03');
    await expect(sugestoes.decidir(id, { ...PO_ACEITA, pessoa: ' ' })).rejects.toThrow(EntradaInvalidaError);
    await expect(sugestoes.decidir(id, { decisao: 'aceitar', pessoa: 'EQP-01' })).rejects.toThrow(EntradaInvalidaError);
    await expect(sugestoes.decidir(id, { ...PO_ACEITA, papel: 'scrum_master' })).rejects.toThrow(EntradaInvalidaError);
  });

  it('saída que não é JSON ou foge do esquema vira sugestão inválida, registrada e impossível de aceitar', async () => {
    const naoJson = await captura.proporHistoria('NEC-04', 'quebrado');
    expect(naoJson.situacao).toBe('invalida');
    expect(naoJson.chamada).toMatchObject({ saidaValida: false, saidaBruta: 'isto não é json' });
    expect(naoJson.chamada.erro).toMatch(/não é JSON/);

    const foraDoEsquema = await captura.proporHistoria('NEC-04', 'fora');
    expect(foraDoEsquema.chamada.erro).toMatch(/fora do esquema/);
    await expect(sugestoes.decidir(foraDoEsquema.id, PO_ACEITA)).rejects.toThrow(/não passou na validação/);
  });

  it('projeto com dados reais é desviado para o motor local, e o registro anota o local', async () => {
    await banco.update(projetos).set({ dadosReais: true }).where(eq(projetos.id, PROJETO_DEMO));
    const sugestao = await captura.proporHistoria('NEC-02', 'nuvem');
    expect(sugestao.chamada).toMatchObject({ provedor: 'simulado', local: true });
  });

  it('sem motor local, projeto com dados reais não chega a chamar a nuvem', async () => {
    const soNuvem = new CapturaServico(banco, new SugestoesServico(banco, new RoteadorDeMotor({ nuvem: motorQueresponde('{}', false) }, 'nuvem')));
    await banco.update(projetos).set({ dadosReais: true }).where(eq(projetos.id, PROJETO_DEMO));
    await expect(soNuvem.proporHistoria('NEC-02', 'nuvem')).rejects.toThrow(MotorNaoPermitidoError);
    expect(await sugestoes.registro({ projetoId: PROJETO_DEMO })).toHaveLength(26);
  });

  it('necessidade sem classificação, ou restrita sem anonimização, não aciona a IA (RF-02)', async () => {
    const nova = await captura.registrarNecessidade(PROJETO_DEMO, { textoOriginal: 'Quero ver a agenda de eventos em letra maior.', tipoOrigem: 'entrevista' });
    expect(nova).toMatchObject({ classificacao: null, estado: 'nova' });
    await expect(captura.proporHistoria(nova.id)).rejects.toThrow(ClassificacaoPendenteError);

    await captura.classificar(nova.id, { classificacao: 'restrito' });
    await expect(captura.proporHistoria(nova.id)).rejects.toThrow(/anonimização/);

    await captura.classificar(nova.id, { classificacao: 'restrito', anonimizacaoConfirmada: true });
    const sugestao = await captura.proporHistoria(nova.id);
    expect(sugestao.chamada.classificacaoEntrada).toBe('restrito');
  });

  it('filtra o registro por decisão, período, provedor e item (RF-28)', async () => {
    expect(await sugestoes.registro({ situacao: 'recusada' })).toHaveLength(2);
    expect(await sugestoes.registro({ situacao: 'recusada', de: '2026-11-01', ate: '2026-11-30' })).toHaveLength(0);
    expect(await sugestoes.registro({ provedor: 'ollama_local' })).toHaveLength(1);
    expect((await sugestoes.registro({ alvoId: 'NEC-01' })).map((r) => r.codigo)).toContain('IA-0001');
    await expect(sugestoes.registro({ de: '17/11/2026' })).rejects.toThrow(EntradaInvalidaError);
  });

  it('o registro é somente de inclusão no banco (RNF-04)', async () => {
    const { id } = await captura.proporHistoria('NEC-02');
    await sugestoes.decidir(id, PO_ACEITA);
    const causa = (p: Promise<unknown>) => p.then(() => '', (e) => String(e.cause?.message ?? e.message));
    expect(await causa(banco.update(chamadasIa).set({ modelo: 'outro' }))).toMatch(/somente de inclusão/);
    expect(await causa(banco.update(sugestoes_).set({ observacao: 'mudei' }).where(eq(sugestoes_.id, id)))).toMatch(/já foi decidida/);
    expect(await causa(banco.delete(sugestoes_).where(eq(sugestoes_.id, id)))).toMatch(/somente de inclusão/);
  });

  it('registra nova necessidade com identificador sequencial', async () => {
    await expect(captura.registrarNecessidade(PROJETO_DEMO, { textoOriginal: 'Quero ver a agenda em letra maior.' })).rejects.toThrow(/tipo de origem/);
    const criada = await captura.registrarNecessidade(PROJETO_DEMO, {
      textoOriginal: 'Quero ver a agenda de eventos em letra maior.',
      tipoOrigem: 'entrevista',
      classificacao: 'publico',
      perfisAfetados: ['PER-01'],
    });
    expect(criada).toMatchObject({ id: 'NEC-09', estado: 'nova', tipoOrigem: 'entrevista' });
    expect(await banco.select().from(necessidades)).toHaveLength(9);
  });
});
