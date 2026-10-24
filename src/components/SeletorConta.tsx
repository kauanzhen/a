import { useEffect, useMemo, useRef, useState } from 'react';
import type { Conta } from '../db/types';

function normalizar(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Ordem da busca: reduzido/código exato, nome que começa com o termo, palavra que começa com o termo, o resto. */
function relevancia(c: Conta, termo: string): number {
  if (String(c.reduzido) === termo || c.codigo === termo) return 0;
  const nome = normalizar(c.nome.replace(/^\(-\)\s*/, ''));
  if (nome.startsWith(termo)) return 1;
  if (nome.split(/[\s(/-]+/).some((p) => p.startsWith(termo))) return 2;
  return 3;
}

/**
 * Seletor de conta com busca por código de classificação, código reduzido ou nome.
 * Teclado: digite e use ↑/↓ e Enter; Enter com um número exato de reduzido seleciona direto.
 */
export function SeletorConta(props: {
  contas: Conta[];
  valor?: number;
  aoMudar: (contaId: number | undefined) => void;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  ariaLabel?: string;
  /** mostra também sintéticas (ex.: filtros de relatório) */
  incluirSinteticas?: boolean;
  placeholder?: string;
}) {
  const selecionaveis = useMemo(
    () => props.contas.filter((c) => (props.incluirSinteticas || c.tipo === 'A') && c.ativa),
    [props.contas, props.incluirSinteticas],
  );
  const atual = props.contas.find((c) => c.id === props.valor);
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) setTexto(atual ? `${atual.codigo} ${atual.nome}` : '');
  }, [atual, aberto]);

  const opcoes = useMemo(() => {
    const t = normalizar(texto.trim());
    if (!t || (atual && texto === `${atual.codigo} ${atual.nome}`)) return selecionaveis.slice(0, 50);
    const termos = t.split(/\s+/);
    return selecionaveis
      .filter((c) => {
        const alvo = normalizar(`${c.codigo} ${c.codigo.replace(/\D/g, '')} ${c.reduzido ?? ''} ${c.nome}`);
        return termos.every((termo) => alvo.includes(termo));
      })
      .sort((a, b) => relevancia(a, t) - relevancia(b, t))
      .slice(0, 50);
  }, [texto, selecionaveis, atual]);

  function escolher(c: Conta | undefined) {
    props.aoMudar(c?.id);
    setAberto(false);
    setTexto(c ? `${c.codigo} ${c.nome}` : '');
  }

  return (
    <div className="seletor-conta" ref={caixa}>
      <input
        ref={props.inputRef}
        aria-label={props.ariaLabel ?? 'Conta'}
        placeholder={props.placeholder ?? 'Código, reduzido ou nome'}
        value={texto}
        autoFocus={props.autoFocus}
        onFocus={(e) => {
          setAberto(true);
          setDestaque(0);
          e.target.select();
        }}
        onBlur={() =>
          setTimeout(() => {
            setAberto(false);
            if (!texto.trim()) props.aoMudar(undefined);
          }, 150)
        }
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
          setDestaque(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAberto(true);
            setDestaque((d) => Math.min(d + 1, opcoes.length - 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDestaque((d) => Math.max(d - 1, 0));
            return;
          }
          if (e.key === 'Enter' && aberto && opcoes[destaque]) {
            e.preventDefault();
            escolher(opcoes[destaque]);
            return;
          }
          if (e.key === 'Escape' && aberto) {
            e.stopPropagation();
            setAberto(false);
            return;
          }
          props.onKeyDown?.(e);
        }}
      />
      {aberto && opcoes.length > 0 && (
        <div className="opcoes" role="listbox">
          {opcoes.map((c, i) => (
            <div
              key={c.id}
              role="option"
              aria-selected={i === destaque}
              className={`opcao ${i === destaque ? 'destaque' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(c);
              }}
              onMouseEnter={() => setDestaque(i)}
            >
              <code>{c.codigo}</code>
              <span>
                {c.reduzido !== undefined && <span className="texto-2">[{c.reduzido}] </span>}
                {c.nome}
                {c.exigeCentroCusto && <span className="etiqueta aviso" style={{ marginLeft: 6 }}>CC</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
