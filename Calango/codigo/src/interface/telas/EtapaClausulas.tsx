// Etapa 1 — Cláusulas: conjunto padrão já carregado; o usuário liga/desliga as
// opcionais, adiciona outras da biblioteca e reordena arrastando.

import { useMemo, useState } from 'react';
import { useApp } from '../contexto';
import type { Ato, ItemSelecao } from '../../dados/tipos';
import type { DefinicaoDocumento } from '../../tipos/definicoes';
import { verificarRegras } from '../../motor/montagem';
import { selecaoPadrao, type SituacaoEscolhida } from '../../servicos/atos';
import { normalizar } from '../../lib/texto';
import { Alerta, Modal } from '../componentes/Campos';

const TIPO: Record<string, string> = { clausula: 'Cláusula', paragrafo: 'Parágrafo', texto: 'Texto' };

function ModalAdicionar(p: {
  def: DefinicaoDocumento;
  tipoSocietario: string;
  area: string;
  jaUsadas: Set<string>;
  aoAdicionar: (id: string) => void;
  aoFechar: () => void;
}) {
  const { sessao } = useApp();
  const [busca, setBusca] = useState('');
  const [tag, setTag] = useState('');
  const [soDoDocumento, setSoDoDocumento] = useState(true);
  const todas = sessao.clausulas.map((l) => l.dados).filter((c) => !c.arquivada && c.tipo_societario.includes(p.tipoSocietario));
  const tags = [...new Set(todas.flatMap((c) => c.tags))].sort((a, b) => a.localeCompare(b));
  const q = normalizar(busca);
  const lista = todas
    .filter((c) => !p.jaUsadas.has(c.id))
    .filter((c) => !soDoDocumento || c.documentos.includes(p.def.id))
    .filter((c) => !tag || c.tags.includes(tag))
    .filter((c) => !q || normalizar(`${c.titulo_interno} ${c.titulo_secao} ${c.tags.join(' ')} ${c.corpo}`).includes(q))
    .sort((a, b) => a.titulo_interno.localeCompare(b.titulo_interno));
  return (
    <Modal titulo="Adicionar cláusula da biblioteca" aoFechar={p.aoFechar} largo>
      <div className="grade">
        <label className="campo">
          Buscar
          <input type="search" autoFocus value={busca} placeholder="Título, texto ou etiqueta" onChange={(e) => setBusca(e.target.value)} />
        </label>
        <label className="campo">
          Etiqueta
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Todas</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="opcao" style={{ alignSelf: 'end' }}>
          <input type="checkbox" checked={soDoDocumento} onChange={(e) => setSoDoDocumento(e.target.checked)} />
          Só as indicadas para “{p.def.nome}”
        </label>
      </div>
      <div className="lista-escolha" style={{ marginTop: '0.75rem' }}>
        {lista.length === 0 && <div className="vazio">Nenhuma cláusula encontrada com esses filtros.</div>}
        {lista.map((c) => (
          <button key={c.id} onClick={() => p.aoAdicionar(c.id)}>
            <strong>{c.titulo_interno}</strong> <span className="etiqueta">{TIPO[c.tipo_bloco]}</span>
            {c.tags.map((t) => (
              <span key={t} className="etiqueta">
                {t}
              </span>
            ))}
            <div className="suave pequeno">{c.corpo.slice(0, 160).replace(/\n/g, ' ')}…</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function EtapaClausulas(p: {
  ato: Ato;
  def: DefinicaoDocumento;
  tipoSocietario: string;
  alterar: (fn: (a: Ato) => Ato) => void;
  somenteLeitura: boolean;
}) {
  const app = useApp();
  const { ato, def } = p;
  const [aberto, setAberto] = useState<string | null>(null);
  const [adicionarEm, setAdicionarEm] = useState<string | null>(null);
  const [arrasto, setArrasto] = useState<{ area: string; de: number } | null>(null);
  const avisos = useMemo(() => verificarRegras(ato.selecao, app.buscarClausula), [ato.selecao, app]);

  const mudarArea = (area: string, fn: (itens: ItemSelecao[]) => ItemSelecao[]) =>
    p.alterar((a) => ({ ...a, selecao: { ...a.selecao, [area]: fn(a.selecao[area] ?? []) } }));

  const mover = (area: string, de: number, para: number) =>
    mudarArea(area, (itens) => {
      if (para < 0 || para >= itens.length || de === para) return itens;
      const n = [...itens];
      const [x] = n.splice(de, 1);
      n.splice(para, 0, x);
      return n;
    });

  const mudarSituacao = (s: SituacaoEscolhida) => {
    if (s === ato.opcoes.situacao_escolhida) return;
    if (!window.confirm('Recarregar o conjunto padrão de cláusulas para esta situação?\n\nAs mudanças que você fez na lista de cláusulas serão desfeitas.')) return;
    p.alterar((a) => ({ ...a, opcoes: { ...a.opcoes, situacao_escolhida: s }, selecao: selecaoPadrao(def, app.buscarClausula, s) }));
  };

  return (
    <div>
      <div className="painel">
        <h2>Quantos sócios terá a empresa?</h2>
        <div className="cartoes-opcao">
          {(
            [
              ['pluripessoal', 'Dois ou mais sócios', 'Sociedade limitada com vários sócios.'],
              ['unipessoal', 'Um sócio só', 'Sociedade limitada unipessoal.'],
            ] as const
          ).map(([v, t, s]) => (
            <label key={v} className={ato.opcoes.situacao_escolhida === v ? 'marcado' : ''}>
              <input type="radio" name="situacao" disabled={p.somenteLeitura} checked={ato.opcoes.situacao_escolhida === v} onChange={() => mudarSituacao(v)} />
              <strong>{t}</strong>
              <div className="suave pequeno">{s}</div>
            </label>
          ))}
        </div>
        <p className="suave pequeno">O texto das cláusulas se ajusta sozinho (singular/plural, masculino/feminino) conforme os sócios cadastrados na Etapa 2.</p>
      </div>

      {avisos.length > 0 && (
        <Alerta tipo={avisos.some((x) => x.nivel === 'erro') ? 'erro' : 'aviso'}>
          <ul>
            {avisos.map((a) => (
              <li key={a.mensagem}>{a.mensagem}</li>
            ))}
          </ul>
        </Alerta>
      )}

      {def.areas.map((area) => {
        const itens = ato.selecao[area.id] ?? [];
        return (
          <div key={area.id} className="painel area-clausulas">
            <div className="entre">
              <div>
                <h2 style={{ margin: 0 }}>{area.nome}</h2>
                {area.ajuda && <div className="suave pequeno">{area.ajuda}</div>}
              </div>
              {area.editavel && !p.somenteLeitura && (
                <button onClick={() => setAdicionarEm(area.id)}>+ Adicionar da biblioteca</button>
              )}
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              {itens.length === 0 && <p className="suave">Nenhum bloco nesta área.</p>}
              {itens.map((item, i) => {
                const c = app.buscarClausula(item.clausula_id);
                const obrigatoria = !!c?.regras.obrigatoria;
                const chave = `${area.id}:${item.clausula_id}`;
                return (
                  <div key={chave}>
                    <div
                      className={`item-clausula ${c?.tipo_bloco === 'paragrafo' ? 'paragrafo' : ''} ${item.ativa ? '' : 'desligada'} ${arrasto?.area === area.id && arrasto.de === i ? 'arrastando' : ''}`}
                      draggable={!p.somenteLeitura}
                      onDragStart={() => setArrasto({ area: area.id, de: i })}
                      onDragEnd={() => setArrasto(null)}
                      onDragOver={(e) => arrasto?.area === area.id && e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (arrasto?.area === area.id) mover(area.id, arrasto.de, i);
                        setArrasto(null);
                      }}
                    >
                      <span className="alca" title="Arraste para reordenar">
                        ⠿
                      </span>
                      <input
                        type="checkbox"
                        aria-label={`Incluir ${c?.titulo_interno ?? item.clausula_id}`}
                        checked={item.ativa}
                        disabled={obrigatoria || p.somenteLeitura}
                        title={obrigatoria ? 'Cláusula obrigatória' : 'Incluir no documento'}
                        onChange={(e) => mudarArea(area.id, (xs) => xs.map((x, j) => (j === i ? { ...x, ativa: e.target.checked } : x)))}
                        style={{ width: 20, height: 20 }}
                      />
                      <div className="titulo">
                        {c ? c.titulo_interno : <span className="erro-campo">Cláusula “{item.clausula_id}” não encontrada</span>}
                        <small>
                          {c && <span className="etiqueta">{TIPO[c.tipo_bloco]}</span>}
                          {obrigatoria && <span className="etiqueta verde">🔒 obrigatória</span>}
                          {c?.regras.condicao_de_exibicao && <span className="etiqueta azul">só aparece quando: {c.regras.condicao_de_exibicao}</span>}
                          {c?.titulo_secao && <span className="etiqueta">{c.titulo_secao}</span>}
                        </small>
                      </div>
                      {!p.somenteLeitura && (
                        <>
                          <button className="pequeno" onClick={() => mover(area.id, i, i - 1)} disabled={i === 0} aria-label="Subir">
                            ↑
                          </button>
                          <button className="pequeno" onClick={() => mover(area.id, i, i + 1)} disabled={i === itens.length - 1} aria-label="Descer">
                            ↓
                          </button>
                        </>
                      )}
                      <button className="pequeno" onClick={() => setAberto(aberto === chave ? null : chave)}>
                        {aberto === chave ? 'Esconder texto' : 'Ver texto'}
                      </button>
                      {!obrigatoria && !p.somenteLeitura && (
                        <button className="pequeno perigo" onClick={() => mudarArea(area.id, (xs) => xs.filter((_, j) => j !== i))} aria-label="Remover do documento">
                          ✕
                        </button>
                      )}
                    </div>
                    {aberto === chave && c && <div className="texto-clausula">{c.corpo}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {adicionarEm && (
        <ModalAdicionar
          def={def}
          tipoSocietario={p.tipoSocietario}
          area={adicionarEm}
          jaUsadas={new Set((ato.selecao[adicionarEm] ?? []).map((i) => i.clausula_id))}
          aoFechar={() => setAdicionarEm(null)}
          aoAdicionar={(id) => {
            const c = app.buscarClausula(id);
            mudarArea(adicionarEm, (xs) => [...xs, { clausula_id: id, versao: c?.versao ?? 1, ativa: true }]);
            setAdicionarEm(null);
            app.avisar('ok', `“${c?.titulo_interno}” adicionada ao final da área. Arraste para a posição desejada.`);
          }}
        />
      )}
    </div>
  );
}
