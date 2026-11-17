import { useEffect, useState } from 'react';
import { api, ROTULO_PAPEL, type Papel } from './api';
import { Captura } from './Captura';
import { RegistroIa } from './RegistroIa';

type Aba = 'captura' | 'registro';

export function App() {
  const [aba, setAba] = useState<Aba>('captura');
  const [projetos, setProjetos] = useState<Awaited<ReturnType<typeof api.projetos>>>([]);
  const [projetoId, setProjetoId] = useState('');
  const [motores, setMotores] = useState<{ nome: string; local: boolean }[]>([]);
  const [motor, setMotor] = useState('simulado');
  const [pessoa, setPessoa] = useState(() => {
    try {
      return localStorage.getItem('pessoa') ?? '';
    } catch {
      return '';
    }
  });
  const [papel, setPapel] = useState<Papel>('product_owner');
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([api.projetos(), api.saude()])
      .then(([lista, saude]) => {
        setProjetos(lista);
        setProjetoId(lista[0]?.id ?? '');
        setMotores(saude.motores);
        if (lista[0]?.motorPreferido) setMotor(lista[0].motorPreferido);
      })
      .catch((e) => setErro(`Não foi possível falar com o servidor: ${e.message}`));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('pessoa', pessoa);
    } catch {
      /* armazenamento indisponível: segue sem lembrar */
    }
  }, [pessoa]);

  const projeto = projetos.find((p) => p.id === projetoId);

  return (
    <>
      <header className="cabecalho">
        <div className="pagina">
          <h1 className="h3 mb-1">Requisitos UX + IA</h1>
          <p className="text-down-01 mb-0">
            Protótipo com dados fictícios. Toda sugestão da IA espera uma decisão humana antes de entrar no projeto.
          </p>
        </div>
      </header>
      <main className="pagina">
        {erro && (
          <div className="br-message danger" role="alert">
            <div className="content">{erro}</div>
          </div>
        )}

        <div className="row">
          <div className="col-sm-4 br-input mb-2">
            <label htmlFor="projeto">Projeto</label>
            <select id="projeto" className="campo" value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            {projeto?.dadosReais && <p className="text-down-01">Projeto com dados reais: só motores locais são aceitos.</p>}
          </div>
          <div className="col-sm-2 br-input mb-2">
            <label htmlFor="motor">Motor de IA</label>
            <select id="motor" className="campo" value={motor} onChange={(e) => setMotor(e.target.value)}>
              {motores.map((m) => (
                <option key={m.nome} value={m.nome}>
                  {m.nome} ({m.local ? 'local' : 'nuvem'})
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-3 br-input mb-2">
            <label htmlFor="pessoa">Quem decide</label>
            <input id="pessoa" className="campo" value={pessoa} onChange={(e) => setPessoa(e.target.value)} placeholder="Ex.: EQP-01" />
          </div>
          <div className="col-sm-3 br-input mb-2">
            <label htmlFor="papel">Papel exercido</label>
            <select id="papel" className="campo" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
              {Object.entries(ROTULO_PAPEL).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
        </div>

        <nav className="abas" aria-label="Seções">
          {(['captura', 'registro'] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={`br-button ${aba === a ? 'primary' : 'secondary'}`}
              aria-current={aba === a ? 'page' : undefined}
              onClick={() => setAba(a)}
            >
              {a === 'captura' ? 'Captura de necessidades' : 'Registro de uso de IA'}
            </button>
          ))}
        </nav>

        {projetoId && aba === 'captura' && <Captura projetoId={projetoId} motor={motor} pessoa={pessoa} papel={papel} />}
        {projetoId && aba === 'registro' && <RegistroIa projetoId={projetoId} />}
      </main>
    </>
  );
}
