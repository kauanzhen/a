// Campos de formulário reutilizáveis.

import { useEffect, useState, type ReactNode } from 'react';
import { UFS } from '../../dados/ufs';
import type { Endereco } from '../../dados/tipos';
import { formatarNumeroMoeda, lerMoeda } from '../../lib/dinheiro';
import { formatarCEP } from '../../dados/documentos';

interface Base {
  rotulo: ReactNode;
  dica?: ReactNode;
  erro?: string;
  largo?: boolean;
}

export function Rotulo({ rotulo, dica, erro, largo, children }: Base & { children: ReactNode }) {
  return (
    <label className="campo" style={largo ? { gridColumn: '1 / -1' } : undefined}>
      <span>{rotulo}</span>
      {children}
      {dica && <span className="dica">{dica}</span>}
      {erro && <span className="erro-campo">{erro}</span>}
    </label>
  );
}

export function CampoTexto(
  p: Base & { valor: string; onChange: (v: string) => void; placeholder?: string; maiusculas?: boolean; onBlur?: (valorAtual: string) => void; autoFoco?: boolean },
) {
  return (
    <Rotulo {...p}>
      <input
        type="text"
        value={p.valor}
        placeholder={p.placeholder}
        autoFocus={p.autoFoco}
        className={p.erro ? 'invalido' : undefined}
        onChange={(e) => p.onChange(p.maiusculas ? e.target.value.toLocaleUpperCase('pt-BR') : e.target.value)}
        onBlur={(e) => p.onBlur?.(e.target.value)}
      />
    </Rotulo>
  );
}

export function CampoAreaTexto(p: Base & { valor: string; onChange: (v: string) => void; linhas?: number; placeholder?: string }) {
  return (
    <Rotulo {...p}>
      <textarea
        value={p.valor}
        rows={p.linhas ?? 3}
        placeholder={p.placeholder}
        className={p.erro ? 'invalido' : undefined}
        onChange={(e) => p.onChange(e.target.value)}
      />
    </Rotulo>
  );
}

export function CampoData(p: Base & { valor: string; onChange: (v: string) => void }) {
  return (
    <Rotulo {...p}>
      <input type="date" value={p.valor} className={p.erro ? 'invalido' : undefined} onChange={(e) => p.onChange(e.target.value)} />
    </Rotulo>
  );
}

export function CampoNumero(p: Base & { valor: number; onChange: (v: number) => void; min?: number; max?: number; passo?: number }) {
  return (
    <Rotulo {...p}>
      <input
        type="number"
        value={Number.isFinite(p.valor) ? p.valor : ''}
        min={p.min}
        max={p.max}
        step={p.passo ?? 1}
        onChange={(e) => p.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </Rotulo>
  );
}

export function CampoSelecao<T extends string>(
  p: Base & { valor: T; onChange: (v: T) => void; opcoes: { valor: T; rotulo: string; desativado?: boolean }[]; vazio?: string },
) {
  return (
    <Rotulo {...p}>
      <select value={p.valor} className={p.erro ? 'invalido' : undefined} onChange={(e) => p.onChange(e.target.value as T)}>
        {p.vazio !== undefined && <option value="">{p.vazio}</option>}
        {p.opcoes.map((o) => (
          <option key={o.valor} value={o.valor} disabled={o.desativado}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Rotulo>
  );
}

export function CampoUF(p: Base & { valor: string; onChange: (v: string) => void }) {
  return (
    <CampoSelecao
      {...p}
      vazio="UF"
      valor={p.valor}
      opcoes={UFS.map((u) => ({ valor: u.sigla, rotulo: `${u.sigla} — ${u.nome}` }))}
    />
  );
}

/** Valor em reais; guarda em centavos. Mostra erro se o texto não for um valor. */
export function CampoMoeda(p: Base & { valor: number; onChange: (centavos: number) => void }) {
  const [texto, setTexto] = useState(p.valor ? formatarNumeroMoeda(p.valor) : '');
  const [invalido, setInvalido] = useState(false);
  useEffect(() => {
    const atual = lerMoeda(texto);
    if (atual !== p.valor) setTexto(p.valor ? formatarNumeroMoeda(p.valor) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.valor]);
  return (
    <Rotulo {...p} erro={invalido ? 'Valor inválido. Use o formato 10.500,00' : p.erro}>
      <div className="linha" style={{ flexWrap: 'nowrap' }}>
        <span className="suave">R$</span>
        <input
          type="text"
          inputMode="decimal"
          value={texto}
          placeholder="0,00"
          className={invalido || p.erro ? 'invalido' : undefined}
          onChange={(e) => {
            setTexto(e.target.value);
            const v = lerMoeda(e.target.value);
            setInvalido(e.target.value.trim() !== '' && (v === null || v < 0));
            if (v !== null && v >= 0) p.onChange(v);
            if (e.target.value.trim() === '') p.onChange(0);
          }}
          onBlur={() => {
            const v = lerMoeda(texto);
            if (v !== null && v >= 0) setTexto(v ? formatarNumeroMoeda(v) : '');
          }}
        />
      </div>
    </Rotulo>
  );
}

export function CampoMarcar(p: { rotulo: ReactNode; valor: boolean; onChange: (v: boolean) => void; desativado?: boolean }) {
  return (
    <label className="opcao">
      <input type="checkbox" checked={p.valor} disabled={p.desativado} onChange={(e) => p.onChange(e.target.checked)} />
      <span>{p.rotulo}</span>
    </label>
  );
}

export function OpcoesRadio<T extends string>(p: { nome: string; valor: T; onChange: (v: T) => void; opcoes: { valor: T; rotulo: ReactNode }[] }) {
  return (
    <div className="radios">
      {p.opcoes.map((o) => (
        <label key={o.valor} className="opcao">
          <input type="radio" name={p.nome} checked={p.valor === o.valor} onChange={() => p.onChange(o.valor)} />
          <span>{o.rotulo}</span>
        </label>
      ))}
    </div>
  );
}

/** Emite só a parte alterada; quem usa junta com o valor mais recente. */
export function CamposEndereco(p: { valor: Endereco; onChange: (parcial: Partial<Endereco>) => void; erro?: string }) {
  const e = p.valor;
  const mudar = (parcial: Partial<Endereco>) => p.onChange(parcial);
  return (
    <div className="grade">
      <CampoTexto rotulo="Logradouro" dica="Com o tipo: Rua, Avenida, Alameda..." valor={e.logradouro} onChange={(v) => mudar({ logradouro: v })} />
      <CampoTexto rotulo="Número" dica="Deixe vazio se não houver (fica s/nº)" valor={e.numero} onChange={(v) => mudar({ numero: v })} />
      <CampoTexto rotulo="Complemento" dica="Opcional" valor={e.complemento} onChange={(v) => mudar({ complemento: v })} />
      <CampoTexto rotulo="Bairro" valor={e.bairro} onChange={(v) => mudar({ bairro: v })} />
      <CampoTexto rotulo="Cidade" valor={e.cidade} onChange={(v) => mudar({ cidade: v })} />
      <CampoUF rotulo="UF" valor={e.uf} onChange={(v) => mudar({ uf: v })} />
      <CampoTexto rotulo="CEP" valor={e.cep} placeholder="00000-000" onChange={(v) => mudar({ cep: v })} onBlur={(v) => mudar({ cep: formatarCEP(v) })} />
      {p.erro && <div className="erro-campo" style={{ gridColumn: '1 / -1' }}>{p.erro}</div>}
    </div>
  );
}

export function Alerta({ tipo, children, titulo }: { tipo: 'erro' | 'aviso' | 'info' | 'ok'; titulo?: string; children?: ReactNode }) {
  return (
    <div className={`alerta ${tipo}`} role={tipo === 'erro' ? 'alert' : undefined}>
      {titulo && <strong>{titulo} </strong>}
      {children}
    </div>
  );
}

export function Modal(p: { titulo: string; children: ReactNode; aoFechar: () => void; largo?: boolean; rodape?: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && p.aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [p]);
  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && p.aoFechar()}>
      <div className={`modal ${p.largo ? 'largo' : ''}`} role="dialog" aria-label={p.titulo}>
        <div className="entre">
          <h2>{p.titulo}</h2>
          <button className="pequeno" onClick={p.aoFechar} aria-label="Fechar">
            ✕ Fechar
          </button>
        </div>
        {p.children}
        {p.rodape && <div className="linha fim" style={{ marginTop: '1rem' }}>{p.rodape}</div>}
      </div>
    </div>
  );
}

/** Lista de pendências agrupada por nível. */
export function ListaPendencias({ itens, vazio }: { itens: { nivel: 'erro' | 'aviso'; mensagem: string }[]; vazio?: string }) {
  const erros = itens.filter((i) => i.nivel === 'erro');
  const avisos = itens.filter((i) => i.nivel === 'aviso');
  if (!erros.length && !avisos.length) return vazio ? <Alerta tipo="ok">{vazio}</Alerta> : null;
  return (
    <>
      {erros.length > 0 && (
        <Alerta tipo="erro" titulo={`${erros.length} pendência${erros.length > 1 ? 's' : ''} a resolver:`}>
          <ul>
            {erros.map((e, i) => (
              <li key={i}>{e.mensagem}</li>
            ))}
          </ul>
        </Alerta>
      )}
      {avisos.length > 0 && (
        <Alerta tipo="aviso" titulo="Atenção:">
          <ul>
            {avisos.map((e, i) => (
              <li key={i}>{e.mensagem}</li>
            ))}
          </ul>
        </Alerta>
      )}
    </>
  );
}

export function baixarArquivo(conteudo: Blob, nome: string) {
  const url = URL.createObjectURL(conteudo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
