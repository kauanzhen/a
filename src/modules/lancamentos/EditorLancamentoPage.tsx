import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CabecalhoPagina, Campo, CampoData, CampoMoeda, ExigeEmpresa, ListaErros, Modal } from '../../components/ui';
import { SeletorConta } from '../../components/SeletorConta';
import { db } from '../../db/db';
import type { CentroCusto, Conta, HistoricoPadrao, Lancamento, Natureza, OrigemLancamento, Partida } from '../../db/types';
import { NOMES_ORIGEM } from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { competenciaDe, formatarData, formatarDataHora, hojeISO } from '../../lib/date';
import { formatarMoeda } from '../../lib/money';
import { criarIndiceContas } from '../planoContas/indiceContas';
import { calcularTotais, validarLancamento, type RascunhoLancamento } from './partidas';
import { rascunhoDeCopia, rascunhoDeModelo, salvarLancamento, salvarModelo } from './lancamentoService';
import { PainelDidatico } from './PainelDidatico';

interface Linha extends Partida {
  chave: number;
}

let chaveSeq = 1;
const novaLinha = (tipo: Natureza, p?: Partial<Partida>): Linha => ({ chave: chaveSeq++, contaId: 0, tipo, valor: 0, ...p });

function ultimaDataUsada(): string {
  try {
    return localStorage.getItem('contabil-escola:ultimaData') || hojeISO();
  } catch {
    return hojeISO();
  }
}
function lembrarData(d: string) {
  try {
    localStorage.setItem('contabil-escola:ultimaData', d);
  } catch {
    /* sem armazenamento local: só não lembra a data */
  }
}

export function EditorLancamentoPage() {
  return (
    <ExigeEmpresa>
      <Editor />
    </ExigeEmpresa>
  );
}

interface EstadoNavegacao {
  rascunho?: RascunhoLancamento;
  origem?: OrigemLancamento;
  /** volta para esta rota depois de salvar (ex.: revisão do assistente IA) */
  voltarPara?: string;
  idSugestao?: string;
}

function Editor() {
  const { empresa, modoDidatico, definirModoDidatico } = useApp();
  const acao = useAcao();
  const navegar = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const local = useLocation();
  const empresaId = empresa!.id!;
  const idEdicao = id && id !== 'novo' ? Number(id) : undefined;

  const contas = useLiveQuery(() => db.contas.where('empresaId').equals(empresaId).toArray(), [empresaId], [] as Conta[]);
  const centros = useLiveQuery(() => db.centrosCusto.where('empresaId').equals(empresaId).sortBy('codigo'), [empresaId], [] as CentroCusto[]);
  const historicos = useLiveQuery(() => db.historicos.where('empresaId').equals(empresaId).sortBy('codigo'), [empresaId], [] as HistoricoPadrao[]);
  const mapaContas = useMemo(() => new Map(contas.map((c) => [c.id!, c])), [contas]);

  const [carregado, setCarregado] = useState(false);
  const [original, setOriginal] = useState<Lancamento | undefined>();
  const [bloqueio, setBloqueio] = useState<string | undefined>();
  const [origem, setOrigem] = useState<OrigemLancamento>('MANUAL');
  const [data, setData] = useState(ultimaDataUsada);
  const [lote, setLote] = useState('');
  const [documento, setDocumento] = useState('');
  const [historicoPadraoId, setHistoricoPadraoId] = useState<number | undefined>();
  const [codigoHistorico, setCodigoHistorico] = useState('');
  const [historico, setHistorico] = useState('');
  const [complemento, setComplemento] = useState('');
  const [observacao, setObservacao] = useState<string | undefined>();
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha('D'), novaLinha('C')]);
  const [linhaAtual, setLinhaAtual] = useState(0);
  const [erros, setErros] = useState<string[]>([]);
  const [salvo, setSalvo] = useState<{ lancamento: Lancamento; continuar: boolean } | null>(null);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const refsConta = useRef<(HTMLInputElement | null)[]>([]);
  const refData = useRef<HTMLInputElement | null>(null);

  const aplicarRascunho = useCallback((r: RascunhoLancamento) => {
    setData(r.data);
    setLote(r.lote ?? '');
    setDocumento(r.documento ?? '');
    setHistoricoPadraoId(r.historicoPadraoId);
    setHistorico(r.historico);
    setComplemento(r.complemento ?? '');
    setObservacao(r.observacao);
    setLinhas(r.partidas.length ? r.partidas.map((p) => novaLinha(p.tipo, p)) : [novaLinha('D'), novaLinha('C')]);
  }, []);

  // carga inicial: edição, cópia, modelo ou rascunho vindo do assistente IA
  useEffect(() => {
    (async () => {
      const estado = local.state as EstadoNavegacao | null;
      if (idEdicao) {
        const l = await db.lancamentos.get(idEdicao);
        if (!l || l.empresaId !== empresaId) {
          setBloqueio('Lançamento não encontrado.');
        } else {
          setOriginal(l);
          setOrigem(l.origem);
          setLote(l.lote);
          aplicarRascunho({ ...l, lote: l.lote });
          const periodo = await db.periodos.where('[empresaId+competencia]').equals([empresaId, l.competencia]).first();
          if (periodo?.status === 'FECHADO') setBloqueio('Este lançamento está em período FECHADO e não pode ser alterado.');
          else if (l.estornadoPorId) setBloqueio('Este lançamento foi estornado e não pode ser alterado.');
        }
      } else if (params.get('copiar')) {
        const l = await db.lancamentos.get(Number(params.get('copiar')));
        if (l) {
          aplicarRascunho(rascunhoDeCopia(l, ultimaDataUsada()));
          setOrigem('COPIA');
        }
      } else if (params.get('modelo')) {
        const m = await db.modelos.get(Number(params.get('modelo')));
        if (m) {
          aplicarRascunho(rascunhoDeModelo(m, ultimaDataUsada()));
          setOrigem('MODELO');
        }
      } else if (estado?.rascunho) {
        aplicarRascunho(estado.rascunho);
        setOrigem(estado.origem ?? 'MANUAL');
      }
      setCarregado(true);
    })();
  }, [idEdicao, empresaId, params, local.state, aplicarRascunho]);

  const partidas: Partida[] = linhas.map(({ chave: _c, ...p }) => p);
  const totais = calcularTotais(partidas.filter((p) => p.contaId || p.valor));
  const rascunho: RascunhoLancamento = { data, lote, documento, historicoPadraoId, historico, complemento, observacao, partidas };

  function mudarLinha(i: number, p: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  }

  function adicionarLinha() {
    const tipo: Natureza = totais.diferenca > 0 ? 'C' : 'D';
    setLinhas((ls) => [...ls, novaLinha(tipo, { valor: Math.abs(totais.diferenca) })]);
    setTimeout(() => refsConta.current[linhas.length]?.focus(), 30);
  }

  function balancear(i = linhaAtual) {
    const l = linhas[i];
    if (!l) return;
    const semEsta = calcularTotais(partidas.filter((_, j) => j !== i));
    const dif = semEsta.debitos - semEsta.creditos;
    if (dif === 0) return;
    mudarLinha(i, { tipo: dif > 0 ? 'C' : 'D', valor: Math.abs(dif) });
  }

  function removerLinha(i: number) {
    setLinhas((ls) => (ls.length <= 1 ? ls : ls.filter((_, j) => j !== i)));
  }

  function escolherHistoricoPorCodigo(cod: string) {
    setCodigoHistorico(cod);
    const h = historicos.find((x) => String(x.codigo) === cod.trim() && x.ativo);
    if (h) {
      setHistoricoPadraoId(h.id);
      setHistorico(h.texto);
    }
  }

  async function salvar(continuar: boolean) {
    if (bloqueio) return;
    const ctx = { indice: criarIndiceContas(contas), centros: new Map(centros.map((c) => [c.id!, c])) };
    const e = validarLancamento({ ...rascunho, partidas: partidas.filter((p) => p.contaId || p.valor) }, ctx);
    setErros(e);
    if (e.length) return;
    const l = await acao(() => salvarLancamento(empresaId, rascunho, idEdicao, { origem }));
    if (!l) return;
    lembrarData(l.data);
    if (modoDidatico) {
      setSalvo({ lancamento: l, continuar });
    } else {
      concluir(l, continuar);
    }
  }

  function concluir(l: Lancamento, continuar: boolean) {
    setSalvo(null);
    if (continuar && !idEdicao) {
      // novo lançamento mantendo a data
      setOriginal(undefined);
      setOrigem('MANUAL');
      setLote('');
      setDocumento('');
      setHistoricoPadraoId(undefined);
      setCodigoHistorico('');
      setHistorico('');
      setComplemento('');
      setObservacao(undefined);
      setLinhas([novaLinha('D'), novaLinha('C')]);
      setErros([]);
      setTimeout(() => refData.current?.focus(), 30);
    } else {
      const estado = local.state as EstadoNavegacao | null;
      if (estado?.voltarPara) navegar(estado.voltarPara, { state: { sugestaoTratada: estado.idSugestao } });
      else navegar('/lancamentos', { state: { destaque: l.id } });
    }
  }

  // atalhos de teclado do editor
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (salvo || salvandoModelo) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.code === 'KeyS')) {
        e.preventDefault();
        salvar(e.shiftKey || e.code === 'KeyS' ? !idEdicao : false);
      } else if (e.altKey && !e.ctrlKey && !e.metaKey) {
        // e.code (tecla física) para funcionar também no macOS (Option+letra)
        if (e.code === 'KeyN') {
          e.preventDefault();
          adicionarLinha();
        } else if (e.code === 'KeyB') {
          e.preventDefault();
          balancear();
        } else if (e.code === 'KeyD' || e.code === 'KeyC') {
          e.preventDefault();
          mudarLinha(linhaAtual, { tipo: e.code === 'KeyD' ? 'D' : 'C' });
        } else if (e.code === 'KeyX') {
          e.preventDefault();
          removerLinha(linhaAtual);
        }
      } else if (e.key === 'Escape' && !document.querySelector('.modal-fundo')) {
        navegar('/lancamentos');
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  if (!carregado) return <div className="vazio">Carregando…</div>;

  const titulo = idEdicao ? `Lançamento nº ${original?.numero ?? ''}` : origem === 'COPIA' ? 'Novo lançamento (cópia)' : origem === 'IA' ? 'Revisar sugestão da IA' : 'Novo lançamento';

  return (
    <>
      <CabecalhoPagina
        titulo={titulo}
        descricao={
          original
            ? `Origem: ${NOMES_ORIGEM[original.origem]} · criado em ${formatarDataHora(original.criadoEm)} por ${original.criadoPor}${original.alteradoEm ? ` · alterado em ${formatarDataHora(original.alteradoEm)} por ${original.alteradoPor}` : ''}`
            : 'Partidas dobradas: o sistema só salva quando a soma dos débitos é igual à dos créditos.'
        }
      >
        <button onClick={() => navegar('/lancamentos')}>Voltar (Esc)</button>
        {!bloqueio && (
          <button onClick={() => setSalvandoModelo(true)} title="Guardar como lançamento-modelo">
            Salvar como modelo
          </button>
        )}
        {!bloqueio && !idEdicao && <button onClick={() => salvar(true)}>Salvar e novo (Ctrl+S)</button>}
        {!bloqueio && (
          <button className="primario" onClick={() => salvar(false)}>
            Salvar (Ctrl+Enter)
          </button>
        )}
      </CabecalhoPagina>

      {bloqueio && <div className="aviso alerta">{bloqueio}</div>}
      {observacao && <div className="aviso info">{observacao}</div>}
      {original?.estornoDeId && <div className="aviso info">Este lançamento é o estorno de outro lançamento.</div>}
      <ListaErros erros={erros} />

      <div className="cartao">
        <div className="form-grade">
          <Campo rotulo="Data *" className="col-2" dica={`competência ${competenciaDe(data).split('-').reverse().join('/')}`}>
            <CampoData valor={data} aoMudar={setData} autoFocus={!idEdicao} inputRef={refData} />
          </Campo>
          <Campo rotulo="Lote" className="col-2" dica="em branco = nº do lançamento">
            <input value={lote} onChange={(e) => setLote(e.target.value)} />
          </Campo>
          <Campo rotulo="Documento" className="col-3">
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="NF, recibo, boleto…" />
          </Campo>
          <Campo rotulo="Hist. padrão" className="col-2" dica="digite o código">
            <input
              list="historicos-padrao"
              value={codigoHistorico || (historicoPadraoId ? String(historicos.find((h) => h.id === historicoPadraoId)?.codigo ?? '') : '')}
              onChange={(e) => escolherHistoricoPorCodigo(e.target.value)}
            />
            <datalist id="historicos-padrao">
              {historicos
                .filter((h) => h.ativo)
                .map((h) => (
                  <option key={h.id} value={h.codigo}>
                    {h.texto}
                  </option>
                ))}
            </datalist>
          </Campo>
          <Campo rotulo="Histórico *" className="col-3">
            <input value={historico} onChange={(e) => setHistorico(e.target.value)} />
          </Campo>
          <Campo rotulo="Complemento do histórico" className="col-12">
            <input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="ex.: ref. 03/2026 — Fornecedor Exemplo" />
          </Campo>
        </div>
      </div>

      <div className="cartao">
        <h2>Partidas</h2>
        <div className="tabela-container">
          <table className="partidas">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th style={{ width: 56 }}>D/C</th>
                <th>Conta</th>
                <th style={{ width: 150 }} className="num">
                  Valor (R$)
                </th>
                <th style={{ width: 170 }}>Centro de custo</th>
                <th className="esconder-mobile">Histórico da partida</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const conta = mapaContas.get(l.contaId);
                return (
                  <tr key={l.chave} onFocus={() => setLinhaAtual(i)} style={i === linhaAtual ? { background: 'var(--primary-soft)' } : undefined}>
                    <td>{i + 1}</td>
                    <td>
                      <button
                        type="button"
                        className={`dc-botao ${l.tipo}`}
                        title="Alterna débito/crédito (Alt+D / Alt+C)"
                        onClick={() => mudarLinha(i, { tipo: l.tipo === 'D' ? 'C' : 'D' })}
                      >
                        {l.tipo}
                      </button>
                    </td>
                    <td>
                      <SeletorConta
                        contas={contas}
                        valor={l.contaId || undefined}
                        aoMudar={(cid) => mudarLinha(i, { contaId: cid ?? 0 })}
                        inputRef={(el) => {
                          refsConta.current[i] = el;
                        }}
                        ariaLabel={`Conta da partida ${i + 1}`}
                      />
                      {conta && (
                        <div className="conta-nome">
                          {conta.grupo} · natureza {conta.natureza === 'D' ? 'devedora' : 'credora'}
                          {conta.exigeCentroCusto ? ' · exige centro de custo' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <CampoMoeda
                        valor={l.valor}
                        aoMudar={(v) => mudarLinha(i, { valor: v })}
                        ariaLabel={`Valor da partida ${i + 1}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && i === linhas.length - 1 && totais.diferenca !== 0) {
                            e.preventDefault();
                            adicionarLinha();
                          }
                        }}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`Centro de custo da partida ${i + 1}`}
                        className={conta?.exigeCentroCusto && !l.centroCustoId ? 'invalido' : ''}
                        value={l.centroCustoId ?? ''}
                        onChange={(e) => mudarLinha(i, { centroCustoId: e.target.value ? Number(e.target.value) : undefined })}
                      >
                        <option value="">—</option>
                        {centros
                          .filter((c) => c.ativo || c.id === l.centroCustoId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.codigo} {c.nome}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="esconder-mobile">
                      <input value={l.historico ?? ''} onChange={(e) => mudarLinha(i, { historico: e.target.value })} placeholder="(opcional)" />
                    </td>
                    <td>
                      <button type="button" className="link" title="Remover partida (Alt+X)" onClick={() => removerLinha(i)} aria-label={`Remover partida ${i + 1}`}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="acoes" style={{ marginTop: 8, justifyContent: 'space-between' }}>
          <div className="acoes">
            <button onClick={adicionarLinha}>+ Partida (Alt+N)</button>
            <button onClick={() => balancear()} disabled={totais.diferenca === 0}>
              Balancear linha atual (Alt+B)
            </button>
          </div>
          <div className="totais">
            <span>
              Débitos: <strong>{formatarMoeda(totais.debitos)}</strong>
            </span>
            <span>
              Créditos: <strong>{formatarMoeda(totais.creditos)}</strong>
            </span>
            <span className={totais.diferenca === 0 && totais.debitos > 0 ? 'diferenca-ok' : 'diferenca-erro'}>
              {totais.diferenca === 0 ? (totais.debitos > 0 ? 'Balanceado ✓' : 'Sem valores') : `Diferença: ${formatarMoeda(Math.abs(totais.diferenca))} ${totais.diferenca > 0 ? '(falta crédito)' : '(falta débito)'}`}
            </span>
          </div>
        </div>
        <p className="atalhos">
          Atalhos: <kbd>Ctrl+Enter</kbd> salvar · <kbd>Ctrl+S</kbd> salvar e novo · <kbd>Alt+N</kbd> nova partida · <kbd>Alt+B</kbd> balancear ·{' '}
          <kbd>Alt+D</kbd>/<kbd>Alt+C</kbd> débito/crédito · <kbd>Alt+X</kbd> remover partida · <kbd>Esc</kbd> voltar · na data: <kbd>+</kbd>/<kbd>-</kbd> muda o
          dia, <kbd>H</kbd> hoje · na conta: digite o reduzido, código ou nome e <kbd>Enter</kbd>.
        </p>
      </div>

      {modoDidatico && (
        <div className="cartao">
          <h2>Modo didático — efeito no patrimônio</h2>
          <PainelDidatico partidas={partidas} contas={mapaContas} />
        </div>
      )}

      {salvo && (
        <Modal
          titulo={`Lançamento nº ${salvo.lancamento.numero} salvo ✓`}
          aoFechar={() => concluir(salvo.lancamento, salvo.continuar)}
          rodape={
            <>
              <button
                onClick={() => {
                  definirModoDidatico(false);
                  concluir(salvo.lancamento, salvo.continuar);
                }}
              >
                Desativar modo didático
              </button>
              <button className="primario" autoFocus onClick={() => concluir(salvo.lancamento, salvo.continuar)}>
                {salvo.continuar ? 'Próximo lançamento' : 'OK'}
              </button>
            </>
          }
        >
          <p className="texto-2">
            {formatarData(salvo.lancamento.data)} · {salvo.lancamento.historico} · {formatarMoeda(salvo.lancamento.valorTotal)}
          </p>
          <PainelDidatico partidas={salvo.lancamento.partidas} contas={mapaContas} />
        </Modal>
      )}

      {salvandoModelo && <SalvarComoModelo rascunho={rascunho} empresaId={empresaId} aoFechar={() => setSalvandoModelo(false)} />}
    </>
  );
}

function SalvarComoModelo(props: { rascunho: RascunhoLancamento; empresaId: number; aoFechar: () => void }) {
  const acao = useAcao();
  const [nome, setNome] = useState(props.rascunho.historico);
  const [recorrente, setRecorrente] = useState(true);
  const dia = Number(props.rascunho.data.slice(8, 10)) || 1;
  return (
    <Modal
      titulo="Salvar como lançamento-modelo"
      aoFechar={props.aoFechar}
      rodape={
        <>
          <button onClick={props.aoFechar}>Cancelar</button>
          <button
            className="primario"
            onClick={async () => {
              const ok = await acao(
                () =>
                  salvarModelo({
                    empresaId: props.empresaId,
                    nome,
                    historico: props.rascunho.historico,
                    historicoPadraoId: props.rascunho.historicoPadraoId,
                    complemento: props.rascunho.complemento,
                    documento: props.rascunho.documento,
                    partidas: props.rascunho.partidas.filter((p) => p.contaId),
                    recorrente,
                    diaPadrao: dia,
                    ativo: true,
                  }),
                'Modelo salvo. Veja em Lançamentos-modelo.',
              );
              if (ok) props.aoFechar();
            }}
          >
            Salvar modelo
          </button>
        </>
      }
    >
      <Campo rotulo="Nome do modelo">
        <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      </Campo>
      <label className="check" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
        Recorrente (ex.: aluguel mensal) — permite gerar vários meses de uma vez, todo dia {dia}
      </label>
    </Modal>
  );
}
