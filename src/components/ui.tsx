import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../hooks/app';
import { formatarData, interpretarData } from '../lib/date';
import { formatarNumero, interpretarMoeda, type Centavos } from '../lib/money';

export function Modal(props: { titulo: ReactNode; aoFechar: () => void; largo?: boolean; children: ReactNode; rodape?: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.aoFechar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [props]);
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && props.aoFechar()}>
      <div className={`modal ${props.largo ? 'largo' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-cabecalho">
          <h2>{props.titulo}</h2>
          <button className="link" onClick={props.aoFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-corpo">{props.children}</div>
        {props.rodape && <div className="modal-rodape">{props.rodape}</div>}
      </div>
    </div>
  );
}

export function Campo(props: { rotulo: ReactNode; dica?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={`campo ${props.className ?? ''}`}>
      <span className="rotulo">{props.rotulo}</span>
      {props.children}
      {props.dica && <small>{props.dica}</small>}
    </label>
  );
}

export function CabecalhoPagina(props: { titulo: ReactNode; descricao?: ReactNode; children?: ReactNode }) {
  return (
    <div className="cabecalho-pagina">
      <div>
        <h1>{props.titulo}</h1>
        {props.descricao && <p>{props.descricao}</p>}
      </div>
      {props.children && <div className="acoes nao-imprimir">{props.children}</div>}
    </div>
  );
}

export function ListaErros({ erros, titulo }: { erros: string[]; titulo?: string }) {
  if (!erros.length) return null;
  return (
    <div className="aviso perigo" role="alert">
      <strong>{titulo ?? 'Corrija antes de continuar:'}</strong>
      <ul>
        {erros.map((e, i) => (
          <li key={i} className="pre">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mostra o conteúdo só se houver empresa selecionada. */
export function ExigeEmpresa({ children }: { children: ReactNode }) {
  const { empresa, pronto } = useApp();
  if (!pronto) return <div className="vazio">Carregando…</div>;
  if (!empresa) {
    return (
      <div className="cartao vazio">
        <h2>Nenhuma empresa selecionada</h2>
        <p>Cadastre ou selecione uma empresa fictícia para continuar.</p>
        <Link className="botao primario" to="/empresas">
          Ir para Empresas
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * Campo de valor em reais que guarda CENTAVOS. Mostra "1.234,56" fora de foco e permite
 * digitar livremente ("1234,56", "1.234,56" ou "1234.56").
 */
export function CampoMoeda(props: {
  valor: Centavos;
  aoMudar: (c: Centavos) => void;
  id?: string;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  inputRef?: React.Ref<HTMLInputElement>;
  ariaLabel?: string;
  permitirZero?: boolean;
}) {
  const [texto, setTexto] = useState(props.valor ? formatarNumero(props.valor) : '');
  const [foco, setFoco] = useState(false);
  useEffect(() => {
    // fora de foco, ou quando o valor muda por fora (ex.: Alt+B), mostra o valor formatado
    setTexto((atual) => (!foco || (interpretarMoeda(atual) ?? 0) !== props.valor ? (props.valor ? formatarNumero(props.valor) : '') : atual));
  }, [props.valor, foco]);
  const interpretado = interpretarMoeda(texto);
  const invalido = texto.trim() !== '' && (interpretado === null || interpretado < 0);
  return (
    <input
      id={props.id}
      ref={props.inputRef}
      aria-label={props.ariaLabel}
      className={`direita ${invalido ? 'invalido' : ''}`}
      inputMode="decimal"
      placeholder="0,00"
      value={texto}
      autoFocus={props.autoFocus}
      onFocus={(e) => {
        setFoco(true);
        e.target.select();
      }}
      onBlur={() => {
        setFoco(false);
        const c = interpretarMoeda(texto);
        if (c !== null && c >= 0) {
          props.aoMudar(c);
          setTexto(c ? formatarNumero(c) : '');
        }
      }}
      onChange={(e) => {
        setTexto(e.target.value);
        const c = interpretarMoeda(e.target.value);
        if (c !== null && c >= 0) props.aoMudar(c);
        else if (e.target.value.trim() === '') props.aoMudar(0);
      }}
      onKeyDown={props.onKeyDown}
    />
  );
}

/** Campo de data dd/mm/aaaa que guarda ISO. Teclas: + / - mudam o dia; "h" = hoje. */
export function CampoData(props: {
  valor: string;
  aoMudar: (iso: string) => void;
  id?: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  ariaLabel?: string;
}) {
  const [texto, setTexto] = useState(formatarData(props.valor));
  const [foco, setFoco] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!foco) setTexto(formatarData(props.valor));
  }, [props.valor, foco]);
  const iso = interpretarData(texto);
  const invalido = texto.trim() !== '' && !iso;

  function mascarar(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  }

  function somarDias(n: number) {
    const base = iso ?? props.valor;
    if (!base) return;
    const [a, m, d] = base.split('-').map(Number);
    const dt = new Date(Date.UTC(a, m - 1, d + n));
    const novo = dt.toISOString().slice(0, 10);
    setTexto(formatarData(novo));
    props.aoMudar(novo);
  }

  return (
    <input
      id={props.id}
      ref={(el) => {
        ref.current = el;
        if (typeof props.inputRef === 'function') props.inputRef(el);
        else if (props.inputRef) (props.inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      }}
      aria-label={props.ariaLabel}
      className={invalido ? 'invalido' : ''}
      placeholder="dd/mm/aaaa"
      inputMode="numeric"
      value={texto}
      autoFocus={props.autoFocus}
      onFocus={(e) => {
        setFoco(true);
        e.target.select();
      }}
      onBlur={() => {
        setFoco(false);
        if (iso) props.aoMudar(iso);
      }}
      onKeyDown={(e) => {
        if (e.key === '+' || e.key === 'ArrowUp') {
          e.preventDefault();
          somarDias(1);
        } else if (e.key === '-' || e.key === 'ArrowDown') {
          e.preventDefault();
          somarDias(-1);
        } else if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          const hoje = new Date();
          const novo = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
          setTexto(formatarData(novo));
          props.aoMudar(novo);
        }
      }}
      onChange={(e) => {
        const v = /^\d{4}-/.test(e.target.value) ? e.target.value : mascarar(e.target.value);
        setTexto(v);
        const i = interpretarData(v);
        if (i) props.aoMudar(i);
      }}
    />
  );
}

export function Etiqueta({ tipo, children }: { tipo?: 'sucesso' | 'perigo' | 'aviso' | 'info'; children: ReactNode }) {
  return <span className={`etiqueta ${tipo ?? ''}`}>{children}</span>;
}

/** Lê um arquivo escolhido pelo usuário. */
export function lerArquivo(arquivo: File, comoTexto = false): Promise<ArrayBuffer | string> {
  return comoTexto ? arquivo.text() : arquivo.arrayBuffer();
}
