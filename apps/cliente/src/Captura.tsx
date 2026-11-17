import { useEffect, useRef, useState } from 'react';
import { api, type Classificacao, type LinhaRegistro, type Necessidade, type Papel, type Perfil, type PropostaHistoria } from './api';

const CLASSIFICACOES: Classificacao[] = ['publico', 'interno', 'restrito', 'sigiloso'];

interface Props {
  projetoId: string;
  motor: string;
  pessoa: string;
  papel: Papel;
}

export function Captura({ projetoId, motor, pessoa, papel }: Props) {
  const [necessidades, setNecessidades] = useState<Necessidade[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [selecionada, setSelecionada] = useState<Necessidade | null>(null);
  const [sugestao, setSugestao] = useState<LinhaRegistro | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'danger' | 'info'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const tituloSugestao = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    Promise.all([api.necessidades(projetoId), api.perfis(projetoId)]).then(([n, p]) => {
      setNecessidades(n);
      setPerfis(p);
    });
  }, [projetoId]);

  useEffect(() => {
    if (sugestao) tituloSugestao.current?.focus();
  }, [sugestao?.id]);

  const nomePerfil = (id: string | null) => perfis.find((p) => p.id === id)?.nome ?? id ?? 'sem perfil';

  async function classificar(classificacao: Classificacao, anonimizacaoConfirmada: boolean) {
    if (!selecionada) return;
    try {
      const atualizada = await api.classificar(selecionada.id, { classificacao, anonimizacaoConfirmada });
      setSelecionada(atualizada);
      setNecessidades((lista) => lista.map((n) => (n.id === atualizada.id ? atualizada : n)));
    } catch (e) {
      setAviso({ tipo: 'danger', texto: (e as Error).message });
    }
  }

  async function pedirProposta() {
    if (!selecionada) return;
    setOcupado(true);
    setAviso({ tipo: 'info', texto: 'Pedindo proposta à IA...' });
    try {
      const nova = await api.proporHistoria(selecionada.id, motor);
      setSugestao(await api.sugestao(nova.id));
      setAviso(null);
    } catch (e) {
      setAviso({ tipo: 'danger', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function decidir(decisao: 'aceitar' | 'editar' | 'recusar', extra: { conteudoEditado?: PropostaHistoria; observacao?: string } = {}) {
    if (!sugestao) return;
    if (!pessoa.trim()) {
      setAviso({ tipo: 'danger', texto: 'Preencha "Quem decide" antes de registrar a decisão.' });
      document.getElementById('pessoa')?.focus();
      return;
    }
    setOcupado(true);
    try {
      const decidida = await api.decidir(sugestao.id, { decisao, pessoa, papel, ...extra });
      setSugestao(await api.sugestao(decidida.id));
      setAviso({
        tipo: 'success',
        texto: decidida.resultadoId
          ? `Decisão registrada em ${decidida.codigo}. História ${decidida.resultadoId} criada.`
          : `Decisão registrada em ${decidida.codigo}. Nada entrou no projeto.`,
      });
    } catch (e) {
      setAviso({ tipo: 'danger', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="grade">
      <section aria-labelledby="titulo-necessidades">
        <h2 id="titulo-necessidades" className="h4">
          Necessidades ({necessidades.length})
        </h2>
        <ul className="lista">
          {necessidades.map((n) => (
            <li key={n.id} aria-current={selecionada?.id === n.id}>
              <button
                type="button"
                className="item"
                onClick={() => {
                  setSelecionada(n);
                  setSugestao(null);
                  setAviso(null);
                }}
              >
                <strong>{n.id}</strong> · {n.canal ?? 'canal não informado'}
                <br />
                <span className="text-down-01">{n.textoOriginal.slice(0, 140)}{n.textoOriginal.length > 140 ? '...' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-detalhe">
        <h2 id="titulo-detalhe" className="h4">
          {selecionada ? `Necessidade ${selecionada.id}` : 'Escolha uma necessidade'}
        </h2>
        {selecionada && (
          <div className="painel">
            <p>{selecionada.textoOriginal}</p>
            <p className="text-down-01">
              Origem: {selecionada.tipoOrigem.replace('_', ' ')} · Perfis afetados: {selecionada.perfisAfetados.map(nomePerfil).join(', ') || 'nenhum'}
            </p>
            <fieldset className="mb-3">
              <legend className="text-weight-semi-bold">Classificação do insumo</legend>
              <div className="acoes mt-0">
                <div className="br-input">
                  <label htmlFor="classificacao">Nível</label>
                  <select
                    id="classificacao"
                    className="campo"
                    value={selecionada.classificacao ?? ''}
                    onChange={(e) => classificar(e.target.value as Classificacao, selecionada.anonimizacaoConfirmada)}
                  >
                    {!selecionada.classificacao && <option value="">Não classificada</option>}
                    {CLASSIFICACOES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {(selecionada.classificacao === 'restrito' || selecionada.classificacao === 'sigiloso') && (
                  <div className="br-checkbox">
                    <input
                      id="anonimizacao"
                      type="checkbox"
                      checked={selecionada.anonimizacaoConfirmada}
                      onChange={(e) => classificar(selecionada.classificacao!, e.target.checked)}
                    />
                    <label htmlFor="anonimizacao">Confirmo que o texto foi anonimizado</label>
                  </div>
                )}
              </div>
              {(selecionada.classificacao === 'restrito' || selecionada.classificacao === 'sigiloso') && (
                <p className="text-down-01 mb-0">Insumo restrito ou sigiloso só vai a motor local.</p>
              )}
            </fieldset>
            <button type="button" className="br-button primary" onClick={pedirProposta} disabled={ocupado}>
              Pedir proposta de história à IA
            </button>
          </div>
        )}

        <div aria-live="polite">
          {aviso && (
            <div className={`br-message ${aviso.tipo} mt-3`}>
              <div className="content">{aviso.texto}</div>
            </div>
          )}
        </div>

        {sugestao && (
          <div className="painel mt-3">
            <h3 className="h5" tabIndex={-1} ref={tituloSugestao}>
              Sugestão {sugestao.codigo} <span className={`selo ${sugestao.situacao}`}>{sugestao.situacao}</span>
            </h3>
            <p className="text-down-01">
              {sugestao.provedor} · {sugestao.modelo} ({sugestao.versaoModelo}) · prompt {sugestao.versaoPrompt} ·{' '}
              {sugestao.local ? 'execução local' : 'execução em nuvem'}
            </p>
            {sugestao.situacao === 'invalida' ? (
              <p>
                A saída da IA não passou na validação ou o motor falhou e foi registrada sem entrar no projeto. Motivo: {sugestao.erro}
              </p>
            ) : (
              <Proposta
                proposta={(sugestao.conteudoFinal ?? sugestao.conteudo) as PropostaHistoria}
                perfis={perfis}
                pendente={sugestao.situacao === 'pendente'}
                ocupado={ocupado}
                onDecidir={decidir}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

interface PropsProposta {
  proposta: PropostaHistoria;
  perfis: Perfil[];
  pendente: boolean;
  ocupado: boolean;
  onDecidir: (decisao: 'aceitar' | 'editar' | 'recusar', extra?: { conteudoEditado?: PropostaHistoria; observacao?: string }) => void;
}

function Proposta({ proposta, perfis, pendente, ocupado, onDecidir }: PropsProposta) {
  const [modo, setModo] = useState<'ver' | 'editar' | 'recusar'>('ver');
  const [rascunho, setRascunho] = useState<PropostaHistoria>({ ...proposta, fontes: proposta.fontes ?? [] });
  const [criterios, setCriterios] = useState(proposta.criteriosAceite.join('\n'));
  const [observacao, setObservacao] = useState('');

  if (modo === 'editar') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onDecidir('editar', {
            conteudoEditado: { ...rascunho, criteriosAceite: criterios.split('\n').map((c) => c.trim()).filter(Boolean) },
            observacao: observacao || undefined,
          });
        }}
      >
        <div className="br-input mb-2">
          <label htmlFor="ed-titulo">Título</label>
          <input id="ed-titulo" className="campo" value={rascunho.titulo} onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })} />
        </div>
        <div className="br-input mb-2">
          <label htmlFor="ed-perfil">Perfil</label>
          <select id="ed-perfil" className="campo" value={rascunho.perfilId ?? ''} onChange={(e) => setRascunho({ ...rascunho, perfilId: e.target.value || null })}>
            <option value="">Sem perfil</option>
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.nome}
              </option>
            ))}
          </select>
        </div>
        {(
          [
            ['papel', 'Como (papel)'],
            ['acao', 'Quero (ação)'],
            ['beneficio', 'Para (benefício)'],
          ] as const
        ).map(([campo, rotulo]) => (
          <div className="br-input mb-2" key={campo}>
            <label htmlFor={`ed-${campo}`}>{rotulo}</label>
            <input id={`ed-${campo}`} className="campo" value={rascunho[campo]} onChange={(e) => setRascunho({ ...rascunho, [campo]: e.target.value })} />
          </div>
        ))}
        <div className="br-textarea mb-2">
          <label htmlFor="ed-criterios">Critérios de aceite (um por linha)</label>
          <textarea id="ed-criterios" className="campo" rows={5} value={criterios} onChange={(e) => setCriterios(e.target.value)} />
        </div>
        <div className="br-textarea mb-2">
          <label htmlFor="ed-obs">Por que editou (opcional)</label>
          <textarea id="ed-obs" className="campo" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
        <div className="acoes">
          <button type="submit" className="br-button primary" disabled={ocupado}>Salvar versão editada</button>
          <button type="button" className="br-button secondary" onClick={() => setModo('ver')}>Cancelar</button>
        </div>
      </form>
    );
  }

  return (
    <>
      <h4 className="h6">{proposta.titulo}</h4>
      <p>
        Como {proposta.papel || <em>(papel ausente)</em>}, quero {proposta.acao || <em>(ação ausente)</em>}, para{' '}
        {proposta.beneficio || <em>(benefício ausente)</em>}.
      </p>
      {(!proposta.papel || !proposta.acao || !proposta.beneficio) && (
        <p className="text-down-01">A história ficará marcada como incompleta.</p>
      )}
      <p className="text-down-01">Perfil: {perfis.find((p) => p.id === proposta.perfilId)?.nome ?? 'sem perfil'}</p>
      <p className="text-weight-semi-bold mb-1">Critérios de aceite</p>
      <ol>
        {proposta.criteriosAceite.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      {proposta.fontes?.length > 0 && (
        <>
          <p className="text-weight-semi-bold mb-1">Fontes citadas</p>
          <ul>
            {proposta.fontes.map((f) => (
              <li key={f}>
                <q>{f}</q>
              </li>
            ))}
          </ul>
        </>
      )}
      {pendente && modo === 'recusar' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onDecidir('recusar', { observacao: observacao || undefined });
          }}
        >
          <div className="br-textarea mb-2">
            <label htmlFor="rec-obs">Por que recusou</label>
            <textarea id="rec-obs" className="campo" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <div className="acoes">
            <button type="submit" className="br-button primary" disabled={ocupado}>Confirmar recusa</button>
            <button type="button" className="br-button secondary" onClick={() => setModo('ver')}>Cancelar</button>
          </div>
        </form>
      )}
      {pendente && modo === 'ver' && (
        <div className="acoes">
          <button type="button" className="br-button primary" disabled={ocupado} onClick={() => onDecidir('aceitar')}>Aceitar</button>
          <button type="button" className="br-button secondary" disabled={ocupado} onClick={() => setModo('editar')}>Editar</button>
          <button type="button" className="br-button secondary" disabled={ocupado} onClick={() => setModo('recusar')}>Recusar</button>
        </div>
      )}
    </>
  );
}
