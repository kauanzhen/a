import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { CabecalhoPagina, Campo, ExigeEmpresa, ListaErros } from '../../components/ui';
import { db } from '../../db/db';
import { NOMES_FORMATO, type FormatoImportacao, type Importacao } from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { formatarData, formatarDataHora } from '../../lib/date';
import { formatarMoeda } from '../../lib/money';
import { CAMPOS_POR_FORMATO, camposFaltantes, detectarFormato, localizarLinhaCabecalho, sugerirMapeamento, type Campo as CampoPlanilha, type Mapeamento } from './colunas';
import { carregarContextoImportacao, desfazerImportacao, importarLotes } from './importacaoService';
import { baixarPlanilhaModelo, lerPlanilha, type AbaLida } from './planilhas';
import { errosDeLotePorLinha, validarImportacao } from './validador';

type FormatoPlanilha = Exclude<FormatoImportacao, 'IA_JSON'>;

export function ImportacaoPage() {
  return (
    <ExigeEmpresa>
      <Conteudo />
    </ExigeEmpresa>
  );
}

function Conteudo() {
  const [aba, setAba] = useState<'importar' | 'historico'>('importar');
  return (
    <>
      <CabecalhoPagina
        titulo="Importação de lançamentos (Excel)"
        descricao="Importe .xlsx, .xls, .ods ou .csv. Tudo é validado antes; a gravação acontece numa única operação e pode ser desfeita depois."
      />
      <div className="abas">
        <button className={aba === 'importar' ? 'ativa' : ''} onClick={() => setAba('importar')}>
          Importar planilha
        </button>
        <button className={aba === 'historico' ? 'ativa' : ''} onClick={() => setAba('historico')}>
          Histórico de importações
        </button>
      </div>
      {aba === 'importar' ? <Assistente /> : <Historico />}
    </>
  );
}

function Assistente() {
  const { empresa } = useApp();
  const acao = useAcao();
  const empresaId = empresa!.id!;
  const ctx = useLiveQuery(() => carregarContextoImportacao(empresaId), [empresaId]);
  const [arquivo, setArquivo] = useState<{ nome: string; abas: AbaLida[] } | null>(null);
  const [indiceAba, setIndiceAba] = useState(0);
  const [linhaCabecalho, setLinhaCabecalho] = useState(0);
  const [formato, setFormato] = useState<FormatoPlanilha>('SIMPLES');
  const [mapa, setMapa] = useState<Mapeamento>({});
  const [filtro, setFiltro] = useState<'todas' | 'erros' | 'validas'>('todas');
  const [erroLeitura, setErroLeitura] = useState('');
  const [concluida, setConcluida] = useState<Importacao | null>(null);

  const linhas = arquivo?.abas[indiceAba]?.linhas ?? [];
  const cabecalhos = linhas[linhaCabecalho] ?? [];

  function configurarAba(abas: AbaLida[], i: number) {
    const l = abas[i]?.linhas ?? [];
    const cab = localizarLinhaCabecalho(l);
    const f = detectarFormato(l[cab] ?? []);
    setIndiceAba(i);
    setLinhaCabecalho(cab);
    setFormato(f);
    setMapa(sugerirMapeamento(l[cab] ?? [], f));
  }

  async function ler(f: File) {
    setErroLeitura('');
    setConcluida(null);
    try {
      const abas = lerPlanilha(await f.arrayBuffer(), f.name).filter((a) => a.linhas.length);
      if (!abas.length) throw new Error('A planilha está vazia.');
      setArquivo({ nome: f.name, abas });
      // prefere a primeira aba que tenha cabeçalho reconhecível (pula "Instruções")
      const preferida = abas.findIndex((a) => !/instru/i.test(a.nome));
      configurarAba(abas, preferida >= 0 ? preferida : 0);
    } catch (e) {
      setArquivo(null);
      setErroLeitura(`Não foi possível ler o arquivo: ${(e as Error).message}`);
    }
  }

  const faltando = camposFaltantes(mapa, formato);
  const resultado = useMemo(
    () => (ctx && arquivo && !faltando.length ? validarImportacao(linhas, linhaCabecalho, mapa, formato, ctx) : null),
    [ctx, arquivo, linhas, linhaCabecalho, mapa, formato, faltando.length],
  );
  const errosLote = useMemo(() => (resultado ? errosDeLotePorLinha(resultado) : new Map<number, string[]>()), [resultado]);

  async function importar() {
    if (!resultado || !arquivo) return;
    const validos = resultado.lotes.filter((l) => l.valido).map((l) => l.rascunho!);
    const imp = await acao(
      () =>
        importarLotes(empresaId, validos, {
          arquivo: `${arquivo.nome} / ${arquivo.abas[indiceAba].nome}`,
          formato,
          linhasLidas: resultado.resumo.linhasLidas,
          linhasImportadas: resultado.resumo.linhasImportaveis,
          linhasRejeitadas: resultado.resumo.linhasLidas - resultado.resumo.linhasImportaveis,
        }),
      `${validos.length} lançamento(s) importado(s).`,
    );
    if (imp) {
      setConcluida(imp);
      setArquivo(null);
    }
  }

  return (
    <>
      <div className="passos">
        <span className={!arquivo ? 'atual' : ''}>1. Arquivo</span>
        <span className={arquivo && faltando.length ? 'atual' : ''}>2. Colunas</span>
        <span className={arquivo && !faltando.length ? 'atual' : ''}>3. Pré-visualização</span>
        <span className={concluida ? 'atual' : ''}>4. Concluído</span>
      </div>

      {concluida && (
        <div className="aviso sucesso">
          Importação concluída: {concluida.lancamentoIds.length} lançamento(s), {formatarMoeda(concluida.valorTotal)}. {concluida.qtdLinhasRejeitadas} linha(s)
          rejeitada(s). <Link to="/lancamentos">Ver lançamentos</Link> · você pode desfazer em “Histórico de importações”.
        </div>
      )}

      <div className="cartao">
        <h2>1. Escolha o arquivo</h2>
        <div className="acoes">
          <input type="file" accept=".xlsx,.xls,.ods,.csv,.txt" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
          <button
            onClick={async () => {
              const [contas, centros] = await Promise.all([db.contas.where('empresaId').equals(empresaId).toArray(), db.centrosCusto.where('empresaId').equals(empresaId).toArray()]);
              baixarPlanilhaModelo(contas, centros);
            }}
          >
            Baixar planilha-modelo (.xlsx)
          </button>
        </div>
        <p className="texto-2">
          A planilha-modelo traz os dois formatos (uma linha por lançamento e uma linha por partida), uma aba de instruções e o seu plano de contas.
        </p>
        <ListaErros erros={erroLeitura ? [erroLeitura] : []} />
      </div>

      {arquivo && (
        <div className="cartao">
          <h2>2. Formato e mapeamento de colunas</h2>
          <div className="form-grade">
            <Campo rotulo="Aba" className="col-3">
              <select value={indiceAba} onChange={(e) => configurarAba(arquivo.abas, Number(e.target.value))}>
                {arquivo.abas.map((a, i) => (
                  <option key={i} value={i}>
                    {a.nome} ({a.linhas.length} linhas)
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Linha do cabeçalho" className="col-3">
              <input
                type="number"
                min={1}
                value={linhaCabecalho + 1}
                onChange={(e) => {
                  const n = Math.max(0, Number(e.target.value) - 1);
                  setLinhaCabecalho(n);
                  setMapa(sugerirMapeamento(linhas[n] ?? [], formato));
                }}
              />
            </Campo>
            <Campo rotulo="Formato" className="col-6">
              <select
                value={formato}
                onChange={(e) => {
                  const f = e.target.value as FormatoPlanilha;
                  setFormato(f);
                  setMapa(sugerirMapeamento(cabecalhos, f));
                }}
              >
                <option value="SIMPLES">{NOMES_FORMATO.SIMPLES} (Data | Conta Débito | Conta Crédito | Valor…)</option>
                <option value="PARTIDA">{NOMES_FORMATO.PARTIDA} (Lote | Data | Conta | D/C | Valor…)</option>
              </select>
            </Campo>
            {CAMPOS_POR_FORMATO[formato].map((def) => (
              <Campo key={def.campo} rotulo={`${def.rotulo}${def.obrigatorio ? ' *' : ''}`} className="col-3">
                <select
                  className={def.obrigatorio && (mapa[def.campo] ?? -1) < 0 ? 'invalido' : ''}
                  value={mapa[def.campo] ?? -1}
                  onChange={(e) => setMapa({ ...mapa, [def.campo as CampoPlanilha]: Number(e.target.value) })}
                >
                  <option value={-1}>— não usar —</option>
                  {cabecalhos.map((c, i) => (
                    <option key={i} value={i}>
                      {String(c || `(coluna ${i + 1})`)}
                    </option>
                  ))}
                </select>
              </Campo>
            ))}
          </div>
          {faltando.length > 0 && <div className="aviso alerta" style={{ marginTop: 12 }}>Escolha a coluna de: {faltando.map((f) => f.rotulo).join(', ')}.</div>}
        </div>
      )}

      {resultado && (
        <div className="cartao">
          <h2>3. Pré-visualização e validação</h2>
          <div className="grade" style={{ marginBottom: 12 }}>
            <div>
              <div className="indicador-rotulo">Linhas lidas</div>
              <div className="indicador">{resultado.resumo.linhasLidas}</div>
            </div>
            <div>
              <div className="indicador-rotulo">Lançamentos válidos</div>
              <div className="indicador texto-sucesso">{resultado.resumo.lotesValidos}</div>
            </div>
            <div>
              <div className="indicador-rotulo">Lotes rejeitados</div>
              <div className={`indicador ${resultado.resumo.lotesInvalidos ? 'texto-perigo' : ''}`}>{resultado.resumo.lotesInvalidos}</div>
            </div>
            <div>
              <div className="indicador-rotulo">Valor a importar</div>
              <div className="indicador">{formatarMoeda(resultado.resumo.valorImportavel)}</div>
            </div>
          </div>
          {resultado.lotes.some((l) => !l.valido) && (
            <ListaErros
              titulo="Problemas encontrados (os lotes com erro NÃO serão importados):"
              erros={resultado.lotes.filter((l) => !l.valido).flatMap((l) => l.erros.filter((e) => !e.startsWith('Lote rejeitado')).concat(l.erros.filter((e) => e.startsWith('Lote rejeitado'))))}
            />
          )}
          <div className="acoes" style={{ marginBottom: 8 }}>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Filtrar linhas">
              <option value="todas">Todas as linhas</option>
              <option value="erros">Só linhas com erro</option>
              <option value="validas">Só linhas válidas</option>
            </select>
            <span className="espaco" />
            <button className="primario" disabled={!resultado.resumo.lotesValidos} onClick={importar}>
              Importar {resultado.resumo.lotesValidos} lançamento(s) válido(s)
            </button>
          </div>
          <div className="tabela-container" style={{ maxHeight: 480 }}>
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  {formato === 'PARTIDA' && <th>Lote</th>}
                  <th>Data</th>
                  {formato === 'SIMPLES' ? (
                    <>
                      <th>Débito</th>
                      <th>Crédito</th>
                    </>
                  ) : (
                    <>
                      <th>Conta</th>
                      <th>D/C</th>
                    </>
                  )}
                  <th className="num">Valor</th>
                  <th>Histórico</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {resultado.linhas
                  .filter((l) => {
                    const temErro = l.erros.length > 0 || errosLote.has(l.linha);
                    return filtro === 'todas' || (filtro === 'erros' ? temErro : !temErro);
                  })
                  .map((l) => {
                    const doLote = errosLote.get(l.linha) ?? [];
                    const temErro = l.erros.length > 0 || doLote.length > 0;
                    return (
                      <tr key={l.linha} className={temErro ? 'linha-erro' : ''}>
                        <td>{l.linha}</td>
                        {formato === 'PARTIDA' && <td>{l.lote}</td>}
                        <td>{l.data ? formatarData(l.data) : String(l.brutos.data ?? '')}</td>
                        {formato === 'SIMPLES' ? (
                          <>
                            <td>{l.contaDebito ? `${l.contaDebito.codigo} ${l.contaDebito.nome}` : String(l.brutos.contaDebito ?? '')}</td>
                            <td>{l.contaCredito ? `${l.contaCredito.codigo} ${l.contaCredito.nome}` : String(l.brutos.contaCredito ?? '')}</td>
                          </>
                        ) : (
                          <>
                            <td>{l.conta ? `${l.conta.codigo} ${l.conta.nome}` : String(l.brutos.conta ?? '')}</td>
                            <td>{l.dc ?? String(l.brutos.dc ?? '')}</td>
                          </>
                        )}
                        <td className="num">{l.valor !== undefined ? formatarMoeda(l.valor) : String(l.brutos.valor ?? '')}</td>
                        <td>{l.historico}</td>
                        <td>
                          {temErro ? (
                            <ul style={{ margin: 0, paddingLeft: 16 }} className="texto-perigo">
                              {[...l.erros, ...doLote.filter((e) => !l.erros.length || !e.startsWith('Lote rejeitado'))].map((e, i) => (
                                <li key={i}>{e}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="etiqueta sucesso">ok</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Historico() {
  const { empresa, confirmar } = useApp();
  const acao = useAcao();
  const importacoes = useLiveQuery(async () => (await db.importacoes.where('empresaId').equals(empresa!.id!).toArray()).sort((a, b) => (a.data < b.data ? 1 : -1)), [empresa?.id], []);
  return (
    <div className="tabela-container">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Arquivo</th>
            <th>Formato</th>
            <th>Usuário</th>
            <th className="num">Lançamentos</th>
            <th className="num">Rejeitadas</th>
            <th className="num">Valor</th>
            <th>Situação</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {importacoes.map((i) => (
            <tr key={i.id} className={i.desfeita ? 'inativa' : ''}>
              <td>{formatarDataHora(i.data)}</td>
              <td>{i.arquivo}</td>
              <td>{NOMES_FORMATO[i.formato]}</td>
              <td>{i.usuario}</td>
              <td className="num">{i.lancamentoIds.length}</td>
              <td className="num">{i.qtdLinhasRejeitadas}</td>
              <td className="num">{formatarMoeda(i.valorTotal)}</td>
              <td>{i.desfeita ? <span className="etiqueta">desfeita {formatarDataHora(i.desfeitaEm)}</span> : <span className="etiqueta sucesso">ativa</span>}</td>
              <td>
                {!i.desfeita && (
                  <button
                    className="pequeno perigo"
                    onClick={async () => {
                      if (
                        await confirmar({
                          titulo: 'Desfazer importação',
                          mensagem: `Excluir os ${i.lancamentoIds.length} lançamento(s) importados de "${i.arquivo}"?`,
                          perigo: true,
                          textoConfirmar: 'Desfazer',
                        })
                      )
                        await acao(() => desfazerImportacao(i.id!), 'Importação desfeita.');
                    }}
                  >
                    Desfazer lote inteiro
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!importacoes.length && (
            <tr>
              <td colSpan={9} className="vazio">
                Nenhuma importação ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
