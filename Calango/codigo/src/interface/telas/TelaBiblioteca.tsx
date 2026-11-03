import { useState } from 'react';
import { mensagemDeErro, useApp } from '../contexto';
import { TIPOS_DOCUMENTO_CLAUSULA } from '../../tipos/registro';
import { arquivarClausula } from '../../biblioteca/edicao';
import { normalizar } from '../../lib/texto';
import type { Clausula } from '../../motor/clausula';

const TIPO: Record<string, string> = { clausula: 'Cláusula', paragrafo: 'Parágrafo', texto: 'Texto' };

export function TelaBiblioteca() {
  const app = useApp();
  const { sessao, ir } = app;
  const [busca, setBusca] = useState('');
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [doc, setDoc] = useState('');
  const [arquivadas, setArquivadas] = useState(false);

  const todas = sessao.clausulas.map((l) => l.dados);
  const todasTags = [...new Set(todas.flatMap((c) => c.tags))].sort((a, b) => a.localeCompare(b));
  const q = normalizar(busca);
  const lista = todas
    .filter((c) => arquivadas || !c.arquivada)
    .filter((c) => !doc || c.documentos.includes(doc))
    .filter((c) => [...tags].every((t) => c.tags.includes(t)))
    .filter((c) => !q || normalizar(`${c.titulo_interno} ${c.titulo_secao} ${c.id} ${c.tags.join(' ')} ${c.corpo}`).includes(q))
    .sort((a, b) => a.titulo_interno.localeCompare(b.titulo_interno));

  async function alternarArquivo(c: Clausula) {
    const lida = sessao.clausulas.find((l) => l.dados.id === c.id)!;
    const acao = c.arquivada ? 'desarquivar' : 'arquivar';
    if (!window.confirm(`Deseja ${acao} “${c.titulo_interno}”?${c.arquivada ? '' : '\n\nCláusulas arquivadas não aparecem para novos documentos, mas continuam guardadas.'}`)) return;
    try {
      const nova = arquivarClausula(c, !c.arquivada);
      const m = await sessao.repo.salvarClausula(nova, lida.modificadoEm);
      app.atualizarClausulaLocal({ dados: nova, caminho: lida.caminho, modificadoEm: m });
      app.avisar('ok', `Cláusula ${c.arquivada ? 'desarquivada' : 'arquivada'}.`);
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    }
  }

  return (
    <>
      <div className="entre">
        <h1>Biblioteca de cláusulas</h1>
        <button className="primario" onClick={() => ir({ nome: 'editor-clausula', id: null })}>
          + Nova cláusula
        </button>
      </div>
      <div className="painel">
        <div className="grade">
          <label className="campo">
            Buscar
            <input type="search" value={busca} placeholder="Título, texto ou etiqueta" onChange={(e) => setBusca(e.target.value)} />
          </label>
          <label className="campo">
            Tipo de documento
            <select value={doc} onChange={(e) => setDoc(e.target.value)}>
              <option value="">Todos</option>
              {TIPOS_DOCUMENTO_CLAUSULA.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="opcao" style={{ alignSelf: 'end' }}>
            <input type="checkbox" checked={arquivadas} onChange={(e) => setArquivadas(e.target.checked)} />
            Mostrar arquivadas
          </label>
        </div>
        <div style={{ marginTop: '0.6rem' }}>
          <span className="suave pequeno">Etiquetas: </span>
          {todasTags.map((t) => (
            <button
              key={t}
              className="pequeno"
              style={{ margin: 2, ...(tags.has(t) ? { background: 'var(--primaria-clara)', borderColor: 'var(--primaria)' } : {}) }}
              onClick={() =>
                setTags((s) => {
                  const n = new Set(s);
                  if (n.has(t)) n.delete(t);
                  else n.add(t);
                  return n;
                })
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <p className="suave">{lista.length} cláusula(s)</p>
      <div className="painel" style={{ padding: 0 }}>
        <table className="lista">
          <thead>
            <tr>
              <th>Título</th>
              <th>Tipo</th>
              <th>Etiquetas</th>
              <th>Documentos</th>
              <th>Versão</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} style={c.arquivada ? { opacity: 0.6 } : undefined}>
                <td>
                  <strong>{c.titulo_interno}</strong>
                  {c.titulo_secao && <div className="suave pequeno">{c.titulo_secao}</div>}
                  {c.arquivada && <span className="etiqueta vermelha">arquivada</span>}
                  {c.regras.obrigatoria && <span className="etiqueta verde">obrigatória</span>}
                </td>
                <td>{TIPO[c.tipo_bloco]}</td>
                <td>
                  {c.tags.map((t) => (
                    <span key={t} className="etiqueta">
                      {t}
                    </span>
                  ))}
                </td>
                <td className="pequeno">{c.documentos.map((d) => TIPOS_DOCUMENTO_CLAUSULA.find((x) => x.id === d)?.nome ?? d).join(', ') || <span className="suave">componente</span>}</td>
                <td>v{c.versao}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="pequeno" onClick={() => ir({ nome: 'editor-clausula', id: c.id })}>
                    Editar
                  </button>{' '}
                  <button className="pequeno" onClick={() => ir({ nome: 'editor-clausula', id: null, duplicarDe: c.id })}>
                    Duplicar
                  </button>{' '}
                  <button className="pequeno" onClick={() => alternarArquivo(c)}>
                    {c.arquivada ? 'Desarquivar' : 'Arquivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
