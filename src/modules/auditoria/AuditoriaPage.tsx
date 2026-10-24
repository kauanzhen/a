import { Fragment, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CabecalhoPagina } from '../../components/ui';
import { db } from '../../db/db';
import type { AcaoAuditoria, RegistroAuditoria } from '../../db/types';
import { useApp } from '../../hooks/app';
import { formatarDataHora } from '../../lib/date';
import { normalizarCabecalho } from '../importacao/colunas';

const ACOES: AcaoAuditoria[] = ['CRIAR', 'ALTERAR', 'EXCLUIR', 'INATIVAR', 'ATIVAR', 'FECHAR', 'REABRIR', 'ESTORNAR', 'IMPORTAR', 'DESFAZER', 'RESTAURAR'];

function valor(v: unknown): string {
  if (v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function AuditoriaPage() {
  const { empresaId } = useApp();
  const [somenteEmpresa, setSomenteEmpresa] = useState(true);
  const [entidade, setEntidade] = useState('');
  const [acaoFiltro, setAcaoFiltro] = useState<AcaoAuditoria | ''>('');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<number | undefined>();
  const [limite, setLimite] = useState(200);

  const registros = useLiveQuery(() => db.auditoria.orderBy('data').reverse().toArray(), [], [] as RegistroAuditoria[]);
  const entidades = useMemo(() => [...new Set(registros.map((r) => r.entidade))].sort(), [registros]);
  const filtrados = useMemo(() => {
    const t = normalizarCabecalho(busca);
    return registros.filter(
      (r) =>
        (!somenteEmpresa || r.empresaId === undefined || r.empresaId === empresaId) &&
        (!entidade || r.entidade === entidade) &&
        (!acaoFiltro || r.acao === acaoFiltro) &&
        (!t || normalizarCabecalho(`${r.descricao} ${r.usuario}`).includes(t)),
    );
  }, [registros, somenteEmpresa, empresaId, entidade, acaoFiltro, busca]);

  return (
    <>
      <CabecalhoPagina titulo="Trilha de auditoria" descricao="Quem fez, quando e o que mudou. Os registros são gravados na mesma operação da alteração." />
      <div className="filtros">
        <input type="search" placeholder="Buscar na descrição ou usuário…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={entidade} onChange={(e) => setEntidade(e.target.value)} aria-label="Entidade">
          <option value="">Todas as entidades</option>
          {entidades.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <select value={acaoFiltro} onChange={(e) => setAcaoFiltro(e.target.value as AcaoAuditoria | '')} aria-label="Ação">
          <option value="">Todas as ações</option>
          {ACOES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={somenteEmpresa} onChange={(e) => setSomenteEmpresa(e.target.checked)} />
          Só a empresa atual (e registros gerais)
        </label>
      </div>
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Usuário</th>
              <th>Entidade</th>
              <th>Ação</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.slice(0, limite).map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => setAberto(aberto === r.id ? undefined : r.id)} style={{ cursor: r.diferencas?.length || r.antes || r.depois ? 'pointer' : undefined }}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatarDataHora(r.data)}</td>
                  <td>{r.usuario}</td>
                  <td>{r.entidade}</td>
                  <td>
                    <span className={`etiqueta ${r.acao === 'EXCLUIR' || r.acao === 'DESFAZER' ? 'perigo' : r.acao === 'CRIAR' || r.acao === 'IMPORTAR' ? 'sucesso' : 'info'}`}>{r.acao}</span>
                  </td>
                  <td>
                    {r.descricao}
                    {r.diferencas?.length ? <span className="texto-2"> · {r.diferencas.length} campo(s) alterado(s)</span> : null}
                  </td>
                </tr>
                {aberto === r.id && Boolean(r.diferencas?.length || r.antes || r.depois) && (
                  <tr>
                    <td colSpan={5} style={{ background: 'var(--surface-2)' }}>
                      {r.diferencas?.length ? (
                        <table>
                          <thead>
                            <tr>
                              <th>Campo</th>
                              <th>De</th>
                              <th>Para</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.diferencas.map((d) => (
                              <tr key={d.campo}>
                                <td className="mono">{d.campo}</td>
                                <td className="mono pre" style={{ maxWidth: 420, overflowWrap: 'anywhere' }}>
                                  {valor(d.de)}
                                </td>
                                <td className="mono pre" style={{ maxWidth: 420, overflowWrap: 'anywhere' }}>
                                  {valor(d.para)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <pre className="mono pre" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                          {JSON.stringify(r.antes ?? r.depois, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!filtrados.length && (
              <tr>
                <td colSpan={5} className="vazio">
                  Nenhum registro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtrados.length > limite && (
        <div className="acoes" style={{ marginTop: 8 }}>
          <button onClick={() => setLimite(limite + 200)}>Mostrar mais ({filtrados.length - limite} restantes)</button>
        </div>
      )}
    </>
  );
}
