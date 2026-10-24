import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { definirUsuarioAtual } from '../db/sessao';
import type { Empresa } from '../db/types';
import { garantirTabelasPadrao } from '../modules/tabelasFiscais/tabelaService';

export type Tema = 'sistema' | 'claro' | 'escuro';
type TipoAviso = 'info' | 'sucesso' | 'erro';

interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
}

interface PedidoConfirmacao {
  titulo: string;
  mensagem: ReactNode;
  textoConfirmar?: string;
  perigo?: boolean;
  resolver: (ok: boolean) => void;
}

interface EstadoApp {
  pronto: boolean;
  empresas: Empresa[];
  empresa?: Empresa;
  empresaId?: number;
  selecionarEmpresa: (id?: number) => void;
  usuario: string;
  definirUsuario: (nome: string) => void;
  modoDidatico: boolean;
  definirModoDidatico: (ativo: boolean) => void;
  tema: Tema;
  definirTema: (t: Tema) => void;
  avisar: (texto: string, tipo?: TipoAviso) => void;
  confirmar: (p: Omit<PedidoConfirmacao, 'resolver'>) => Promise<boolean>;
}

const Contexto = createContext<EstadoApp | null>(null);

function lerTemaLocal(): Tema {
  try {
    const t = localStorage.getItem('contabil-escola:tema');
    return t === 'claro' || t === 'escuro' ? t : 'sistema';
  } catch {
    return 'sistema';
  }
}

function aplicarTema(t: Tema) {
  const raiz = document.documentElement;
  if (t === 'sistema') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', t === 'escuro' ? 'dark' : 'light');
}

async function salvarConfig(chave: string, valor: unknown) {
  await db.config.put({ chave, valor });
}

export function ProvedorApp({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const [empresaId, setEmpresaId] = useState<number | undefined>();
  const [usuario, setUsuario] = useState('Estudante');
  const [modoDidatico, setModoDidatico] = useState(true);
  const [tema, setTema] = useState<Tema>(lerTemaLocal);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const contador = useRef(0);

  const empresas = useLiveQuery(() => db.empresas.orderBy('id').toArray(), [], []);
  const empresa = empresas.find((e) => e.id === empresaId);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  useEffect(() => {
    (async () => {
      await db.open();
      await garantirTabelasPadrao();
      const cfg = new Map((await db.config.toArray()).map((c) => [c.chave, c.valor]));
      const nome = typeof cfg.get('usuario') === 'string' ? (cfg.get('usuario') as string) : 'Estudante';
      setUsuario(nome);
      definirUsuarioAtual(nome);
      if (typeof cfg.get('modoDidatico') === 'boolean') setModoDidatico(cfg.get('modoDidatico') as boolean);
      const id = cfg.get('empresaAtualId');
      const lista = await db.empresas.toArray();
      if (typeof id === 'number' && lista.some((e) => e.id === id)) setEmpresaId(id);
      else if (lista.length) setEmpresaId(lista[0].id);
      setPronto(true);
    })();
  }, []);

  // sem empresa selecionada, seleciona a primeira; se a atual foi excluída, seleciona outra.
  // A consulta reativa pode chegar atrasada logo após criar uma empresa, por isso confere no banco.
  useEffect(() => {
    if (!pronto) return;
    if (empresaId === undefined) {
      if (empresas.length) setEmpresaId(empresas[0].id);
      return;
    }
    if (!empresas.some((e) => e.id === empresaId)) {
      db.empresas.get(empresaId).then((e) => {
        if (!e) setEmpresaId(empresas[0]?.id);
      });
    }
  }, [empresas, empresaId, pronto]);

  const avisar = useCallback((texto: string, tipo: TipoAviso = 'info') => {
    const id = ++contador.current;
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'erro' ? 9000 : 4500);
  }, []);

  const confirmar = useCallback(
    (p: Omit<PedidoConfirmacao, 'resolver'>) => new Promise<boolean>((resolver) => setPedido({ ...p, resolver })),
    [],
  );

  const valor = useMemo<EstadoApp>(
    () => ({
      pronto,
      empresas,
      empresa,
      empresaId: empresa?.id,
      selecionarEmpresa: (id) => {
        setEmpresaId(id);
        salvarConfig('empresaAtualId', id);
      },
      usuario,
      definirUsuario: (nome) => {
        const n = nome.trim() || 'Estudante';
        setUsuario(n);
        definirUsuarioAtual(n);
        salvarConfig('usuario', n);
      },
      modoDidatico,
      definirModoDidatico: (ativo) => {
        setModoDidatico(ativo);
        salvarConfig('modoDidatico', ativo);
      },
      tema,
      definirTema: (t) => {
        setTema(t);
        try {
          localStorage.setItem('contabil-escola:tema', t);
        } catch {
          /* armazenamento indisponível: o tema vale só nesta sessão */
        }
      },
      avisar,
      confirmar,
    }),
    [pronto, empresas, empresa, usuario, modoDidatico, tema, avisar, confirmar],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`toast ${a.tipo}`}>
            {a.texto}
          </div>
        ))}
      </div>
      {pedido && (
        <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && (pedido.resolver(false), setPedido(null))}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacao">
            <div className="modal-cabecalho">
              <h2 id="titulo-confirmacao">{pedido.titulo}</h2>
            </div>
            <div className="modal-corpo">{pedido.mensagem}</div>
            <div className="modal-rodape">
              <button
                onClick={() => {
                  pedido.resolver(false);
                  setPedido(null);
                }}
              >
                Cancelar
              </button>
              <button
                autoFocus
                className={pedido.perigo ? 'perigo' : 'primario'}
                onClick={() => {
                  pedido.resolver(true);
                  setPedido(null);
                }}
              >
                {pedido.textoConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Contexto.Provider>
  );
}

export function useApp(): EstadoApp {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useApp fora do ProvedorApp');
  return ctx;
}

/** Executa uma ação assíncrona mostrando o erro (se houver) num aviso. */
export function useAcao() {
  const { avisar } = useApp();
  return useCallback(
    async <T,>(fn: () => Promise<T>, sucesso?: string): Promise<T | undefined> => {
      try {
        const r = await fn();
        if (sucesso) avisar(sucesso, 'sucesso');
        return r;
      } catch (e) {
        avisar((e as Error).message || String(e), 'erro');
        return undefined;
      }
    },
    [avisar],
  );
}
