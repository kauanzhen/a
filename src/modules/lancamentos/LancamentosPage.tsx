import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CabecalhoPagina, Campo, CampoData, ExigeEmpresa, Modal } from '../../components/ui';
import { SeletorConta } from '../../components/SeletorConta';
import { db } from '../../db/db';
import { NOMES_ORIGEM, type Conta, type Lancamento, type OrigemLancamento } from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { formatarData, hojeISO } from '../../lib/date';
import { formatarMoeda } from '../../lib/money';
import { ehDescendente } from '../../lib/mascara';
import { estornarLancamento, excluirLancamento } from './lancamentoService';
import { PainelDidatico } from './PainelDidatico';
import { baixarLancamentos } from '../importacao/planilhas';
import { normalizarCabecalho } from '../importacao/colunas';

export function LancamentosPage() {
  return (
    <ExigeEmpresa>
      <Conteudo />
    </ExigeEmpresa>
  );
}

function Conteudo() {
  const { empresa, confirmar } = useApp();
  const acao = useAcao();
  const navegar = useNavigate();
  const local = useLocation();
  const empresaId = empresa!.id!;
  const destaque = (local.state as { destaque?: number } | null)?.destaque;

  const lancamentos = useLiveQuery(() => db.lancamentos.where('empresaId').equals(empresaId).toArray(), [empresaId], [] as Lancamento[]);
  const contas = useLiveQuery(() => db.contas.where('empresaId').equals(empresaId).toArray(), [empresaId], [] as Conta[]);
  const centros = useLiveQuery(() => db.centrosCusto.where('empresaId').equals(empresaId).toArray(), [empresaId], []);
  const periodos = useLiveQuery(() => db.periodos.where('empresaId').equals(empresaId).toArray(), [empresaId], []);
  const mapaContas = useMemo(() => new Map(contas.map((c) => [c.id!, c])), [contas]);
  const fechados = useMemo(() => new Set(periodos.filter((p) => p.status === 'FECHADO').map((p) => p.competencia)), [periodos]);

  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [contaId, setContaId] = useState<number | undefined>();
  const [texto, setTexto] = useState('');
  const [origem, setOrigem] = useState<OrigemLancamento | ''>('');
  const [aberto, setAberto] = useState<number | undefined>(destaque);
  const [estornando, setEstornando] = useState<Lancamento | null>(null);
  const [didatico, setDidatico] = useState<Lancamento | null>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyN') {
        e.preventDefault();
        navegar('/lancamentos/novo');
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [navegar]);

  const filtrados = useMemo(() => {
    const t = normalizarCabecalho(texto);
    const contaFiltro = contaId ? mapaContas.get(contaId) : undefined;
    return lancamentos
      .filter((l) => {
        if (de && l.data < de) return false;
        if (ate && l.data > ate) return false;
        if (origem && l.origem !== origem) return false;
        if (contaFiltro) {
          const ok = l.partidas.some((p) => {
            const c = mapaContas.get(p.contaId);
            return c && (c.id === contaFiltro.id || ehDescendente(c.codigo, contaFiltro.codigo));
          });
          if (!ok) return false;
        }
        if (t) {
          const alvo = normalizarCabecalho(`${l.numero} ${l.lote} ${l.documento ?? ''} ${l.historico} ${l.complemento ?? ''} ${formatarData(l.data)}`);
          if (!alvo.includes(t)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.data === b.data ? a.numero - b.numero : a.data < b.data ? -1 : 1));
  }, [lancamentos, de, ate, origem, contaId, texto, mapaContas]);

  const total = filtrados.reduce((s, l) => s + l.valorTotal, 0);

  async function excluir(l: Lancamento) {
    if (await confirmar({ titulo: 'Excluir lançamento', mensagem: `Excluir o lançamento nº ${l.numero} (${l.historico})? Prefira o estorno para manter o histórico.`, perigo: true, textoConfirmar: 'Excluir' }))
      await acao(() => excluirLancamento(l.id!), 'Lançamento excluído.');
  }

  return (
    <>
      <CabecalhoPagina titulo="Lançamentos" descricao="Livro de lançamentos da empresa. Clique numa linha para ver as partidas.">
        <button onClick={() => baixarLancamentos(filtrados, mapaContas, new Map(centros.map((c) => [c.id!, c])), `lancamentos-${empresa!.razaoSocial.replace(/\W+/g, '-').toLowerCase()}.xlsx`)}>
          Exportar Excel
        </button>
        <button onClick={() => window.print()}>Imprimir</button>
        <Link className="botao" to="/assistente">
          Assistente IA
        </Link>
        <button className="primario" onClick={() => navegar('/lancamentos/novo')}>
          Novo lançamento (Alt+N)
        </button>
      </CabecalhoPagina>

      <div className="filtros nao-imprimir">
        <Campo rotulo="De">
          <CampoData valor={de} aoMudar={setDe} />
        </Campo>
        <Campo rotulo="Até">
          <CampoData valor={ate} aoMudar={setAte} />
        </Campo>
        <Campo rotulo="Conta (inclui subcontas)">
          <div style={{ minWidth: 260 }}>
            <SeletorConta contas={contas} valor={contaId} aoMudar={setContaId} incluirSinteticas placeholder="Todas as contas" />
          </div>
        </Campo>
        <Campo rotulo="Origem">
          <select value={origem} onChange={(e) => setOrigem(e.target.value as OrigemLancamento | '')}>
            <option value="">Todas</option>
            {Object.entries(NOMES_ORIGEM).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Busca">
          <input type="search" placeholder="Nº, histórico, documento…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Campo>
        {(de || ate || contaId || origem || texto) && (
          <button
            onClick={() => {
              setDe('');
              setAte('');
              setContaId(undefined);
              setOrigem('');
              setTexto('');
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Data</th>
              <th className="esconder-mobile">Lote</th>
              <th className="esconder-mobile">Documento</th>
              <th>Histórico</th>
              <th className="esconder-mobile">Origem</th>
              <th className="num">Valor</th>
              <th className="nao-imprimir" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((l) => {
              const fechado = fechados.has(l.competencia);
              return (
                <Fragment key={l.id}>
                  <tr onClick={() => setAberto(aberto === l.id ? undefined : l.id)} style={{ cursor: 'pointer', ...(l.id === destaque ? { background: 'var(--success-soft)' } : {}) }}>
                    <td>{l.numero}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarData(l.data)}</td>
                    <td className="esconder-mobile">{l.lote}</td>
                    <td className="esconder-mobile">{l.documento}</td>
                    <td>
                      {l.historico} {l.complemento}
                      <div>
                        {l.estornadoPorId && <span className="etiqueta perigo">estornado</span>} {l.estornoDeId && <span className="etiqueta aviso">estorno</span>}{' '}
                        {fechado && <span className="etiqueta">período fechado</span>} {l.partidas.length > 2 && <span className="etiqueta">{l.partidas.length} partidas</span>}
                      </div>
                    </td>
                    <td className="esconder-mobile">
                      <span className={`etiqueta ${l.origem === 'IA' ? 'info' : ''}`}>{NOMES_ORIGEM[l.origem]}</span>
                    </td>
                    <td className="num">{formatarMoeda(l.valorTotal)}</td>
                    <td className="nao-imprimir" onClick={(e) => e.stopPropagation()}>
                      <div className="acoes" style={{ flexWrap: 'nowrap' }}>
                        <button className="pequeno" onClick={() => navegar(`/lancamentos/${l.id}`)}>
                          {fechado || l.estornadoPorId ? 'Ver' : 'Editar'}
                        </button>
                        <button className="pequeno" onClick={() => navegar(`/lancamentos/novo?copiar=${l.id}`)} title="Copiar">
                          Copiar
                        </button>
                        <button className="pequeno" disabled={Boolean(l.estornadoPorId || l.estornoDeId)} onClick={() => setEstornando(l)}>
                          Estornar
                        </button>
                        <button className="pequeno" onClick={() => setDidatico(l)} title="Explicação didática">
                          ?
                        </button>
                        <button className="pequeno perigo" disabled={fechado} onClick={() => excluir(l)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                  {aberto === l.id && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--surface-2)' }}>
                        <table>
                          <tbody>
                            {l.partidas.map((p, i) => {
                              const c = mapaContas.get(p.contaId);
                              const cc = centros.find((x) => x.id === p.centroCustoId);
                              return (
                                <tr key={i}>
                                  <td style={{ width: 30 }}>
                                    <strong className={p.tipo === 'D' ? '' : 'texto-sucesso'}>{p.tipo}</strong>
                                  </td>
                                  <td className="mono" style={{ width: 130 }}>
                                    {c?.codigo}
                                  </td>
                                  <td>
                                    {c?.nome}
                                    {p.historico && <div className="texto-2">{p.historico}</div>}
                                  </td>
                                  <td>{cc ? `${cc.codigo} ${cc.nome}` : ''}</td>
                                  <td className="num">{p.tipo === 'D' ? formatarMoeda(p.valor) : ''}</td>
                                  <td className="num">{p.tipo === 'C' ? formatarMoeda(p.valor) : ''}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {l.observacao && <p className="texto-2">{l.observacao}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!filtrados.length && (
              <tr>
                <td colSpan={8} className="vazio">
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={6}>{filtrados.length} lançamento(s)</td>
                <td className="num">{formatarMoeda(total)}</td>
                <td className="nao-imprimir" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {estornando && <ModalEstorno lancamento={estornando} aoFechar={() => setEstornando(null)} />}
      {didatico && (
        <Modal titulo={`Lançamento nº ${didatico.numero} — explicação didática`} aoFechar={() => setDidatico(null)} largo>
          <p className="texto-2">
            {formatarData(didatico.data)} · {didatico.historico}
          </p>
          <PainelDidatico partidas={didatico.partidas} contas={mapaContas} />
        </Modal>
      )}
    </>
  );
}

function ModalEstorno({ lancamento, aoFechar }: { lancamento: Lancamento; aoFechar: () => void }) {
  const acao = useAcao();
  const [data, setData] = useState(hojeISO() < lancamento.data ? lancamento.data : hojeISO());
  const [motivo, setMotivo] = useState('');
  return (
    <Modal
      titulo={`Estornar lançamento nº ${lancamento.numero}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Cancelar</button>
          <button
            className="primario"
            onClick={async () => {
              const e = await acao(() => estornarLancamento(lancamento.id!, data, motivo), 'Estorno gerado.');
              if (e) aoFechar();
            }}
          >
            Gerar estorno
          </button>
        </>
      }
    >
      <p>
        O estorno cria um <strong>novo lançamento</strong> com os débitos e créditos invertidos, anulando o efeito do original sem apagá-lo (boa prática de
        auditoria).
      </p>
      <div className="form-grade">
        <Campo rotulo="Data do estorno" className="col-4">
          <CampoData valor={data} aoMudar={setData} autoFocus />
        </Campo>
        <Campo rotulo="Motivo" className="col-8">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: lançado em duplicidade" />
        </Campo>
      </div>
    </Modal>
  );
}
