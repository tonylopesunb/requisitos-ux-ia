import { useEffect, useState } from 'react';
import { api, ROTULO_PAPEL, type LinhaRegistro } from './api';

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function RegistroIa({ projetoId }: { projetoId: string }) {
  const [linhas, setLinhas] = useState<LinhaRegistro[] | null>(null);
  const [filtros, setFiltros] = useState({ situacao: '', provedor: '', item: '', de: '', ate: '' });
  const [erro, setErro] = useState('');

  const consulta = new URLSearchParams({ projeto: projetoId });
  for (const [chave, valor] of Object.entries(filtros)) if (valor) consulta.set(chave, valor);
  const chave = consulta.toString();

  useEffect(() => {
    setErro('');
    api.registro(new URLSearchParams(chave)).then(setLinhas, (e) => setErro(e.message));
  }, [chave]);

  const visiveis = linhas ?? [];
  const provedores = ['simulado', 'ollama', 'nuvem_demo', 'ollama_local'];
  const exportar = (formato: string) => `/api/registro-ia/exportar?formato=${formato}&${chave}`;
  const mudar = (campo: keyof typeof filtros) => (e: { target: { value: string } }) => setFiltros({ ...filtros, [campo]: e.target.value });

  return (
    <section aria-labelledby="titulo-registro">
      <h2 id="titulo-registro" className="h4">Registro de uso de IA</h2>
      <p>Cada linha guarda o modelo, a versão, a data, a entrada, a saída e a decisão humana sobre a sugestão.</p>
      <div className="acoes mb-3">
        <div className="br-input">
          <label htmlFor="filtro-situacao">Decisão</label>
          <select id="filtro-situacao" className="campo" value={filtros.situacao} onChange={mudar('situacao')}>
            <option value="">Todas</option>
            {['pendente', 'aceita', 'editada', 'recusada', 'invalida'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="br-input">
          <label htmlFor="filtro-provedor">Provedor</label>
          <select id="filtro-provedor" className="campo" value={filtros.provedor} onChange={mudar('provedor')}>
            <option value="">Todos</option>
            {provedores.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="br-input">
          <label htmlFor="filtro-item">Item</label>
          <input id="filtro-item" className="campo" value={filtros.item} onChange={mudar('item')} placeholder="Ex.: NEC-02" />
        </div>
        <div className="br-input">
          <label htmlFor="filtro-de">De</label>
          <input id="filtro-de" type="date" className="campo" value={filtros.de} onChange={mudar('de')} />
        </div>
        <div className="br-input">
          <label htmlFor="filtro-ate">Até</label>
          <input id="filtro-ate" type="date" className="campo" value={filtros.ate} onChange={mudar('ate')} />
        </div>
        <a className="br-button secondary" href={exportar('csv')} download>Exportar CSV</a>
        <a className="br-button secondary" href={exportar('json')} download>Exportar JSON</a>
      </div>
      {erro && (
        <div className="br-message danger" role="alert">
          <div className="content">{erro}</div>
        </div>
      )}
      {linhas === null ? (
        <p>Carregando...</p>
      ) : (
        <div className="br-table tabela-rolagem">
          <table>
            <caption className="sr-only">Registro de uso de IA, {visiveis.length} linhas</caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Data</th>
                <th scope="col">Tarefa</th>
                <th scope="col">Alvo</th>
                <th scope="col">Modelo</th>
                <th scope="col">Classificação</th>
                <th scope="col">Situação</th>
                <th scope="col">Decidido por</th>
                <th scope="col">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.id}>
                  <th scope="row">{l.codigo}</th>
                  <td>{DATA.format(new Date(l.executadaEm))}</td>
                  <td>{l.tarefa}</td>
                  <td>{l.alvoId}</td>
                  <td>
                    {l.modelo} <span className="text-down-01">({l.versaoModelo}, {l.local ? 'local' : 'nuvem'})</span>
                  </td>
                  <td>{l.classificacaoEntrada ?? ''}</td>
                  <td><span className={`selo ${l.situacao}`}>{l.situacao}</span></td>
                  <td>{l.decididoPor ? `${l.decididoPor}${l.papel ? ` (${ROTULO_PAPEL[l.papel]})` : ''}` : ''}</td>
                  <td title={l.observacao ?? undefined}>{l.resultadoId ?? (l.erro ? 'saída inválida' : '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
