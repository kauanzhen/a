import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CabecalhoPagina, Campo, ExigeEmpresa, ListaErros } from '../../components/ui';
import { db } from '../../db/db';
import { useAcao, useApp } from '../../hooks/app';
import { formatarData, formatarDataHora } from '../../lib/date';
import { normalizarCNPJ } from '../../lib/documentos';
import { formatarMoeda, interpretarMoeda } from '../../lib/money';
import { carregarContextoImportacao, importarLotes } from '../importacao/importacaoService';
import { localizarConta } from '../planoContas/indiceContas';
import { gerarContextoContabil, montarPromptCompleto } from './contextoIA';
import { interpretarLoteIA, rascunhoDaSugestao, validarLoteIA, type LoteIA } from './formatoLote';
import { MODELOS_CLAUDE, MODELO_PADRAO, sugerirLancamentosComClaude } from './claudeApi';
import {
  ARQUIVO_CONTEXTO,
  baixarArquivo,
  escolherPasta,
  esquecerPasta,
  garantirPermissao,
  gravarContextoNaPasta,
  listarLotesPendentes,
  moverLote,
  navegadorSuportaPastas,
  obterPastaSalva,
  type LotePendente,
} from './pastaIntegracao';
import { MENSAGENS_EXEMPLO } from './exemplos';

type Aba = 'mensagens' | 'pasta' | 'arquivos' | 'configurar';

interface Revisao {
  lote: LoteIA;
  fonte: string;
  /** nome do arquivo na pasta de integração (para mover depois) */
  arquivoPasta?: string;
  aprovadas: string[];
  tratadas: string[];
}

const CHAVE_SESSAO = 'contabil-escola:revisaoIA';

function lerRevisaoSessao(): Revisao | null {
  try {
    const t = sessionStorage.getItem(CHAVE_SESSAO);
    return t ? (JSON.parse(t) as Revisao) : null;
  } catch {
    return null;
  }
}
function gravarRevisaoSessao(r: Revisao | null) {
  try {
    if (r) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(r));
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    /* sem armazenamento de sessão: a revisão só não sobrevive à navegação */
  }
}

export function AssistenteIAPage() {
  return (
    <ExigeEmpresa>
      <Conteudo />
    </ExigeEmpresa>
  );
}

function Conteudo() {
  const local = useLocation();
  const [aba, setAba] = useState<Aba>('mensagens');
  const [revisao, setRevisaoEstado] = useState<Revisao | null>(lerRevisaoSessao);
  const setRevisao = (r: Revisao | null) => {
    setRevisaoEstado(r);
    gravarRevisaoSessao(r);
  };

  // voltou do editor depois de corrigir uma sugestão
  useEffect(() => {
    const tratada = (local.state as { sugestaoTratada?: string } | null)?.sugestaoTratada;
    if (tratada && revisao && !revisao.tratadas.includes(tratada)) {
      setRevisao({ ...revisao, tratadas: [...revisao.tratadas, tratada], aprovadas: revisao.aprovadas.filter((a) => a !== tratada) });
    }
  }, [local.state]);

  function abrirRevisao(lote: LoteIA, fonte: string, arquivoPasta?: string) {
    setRevisao({ lote, fonte, arquivoPasta, aprovadas: [], tratadas: [] });
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Assistente IA — mensagens e e-mails em lançamentos"
        descricao="O Claude lê mensagens, e-mails, extratos e documentos e SUGERE os lançamentos. Você revisa, corrige e aprova — nada é gravado sem a sua aprovação."
      >
        <Link className="botao" to="/ajuda#ia">
          Como funciona
        </Link>
      </CabecalhoPagina>

      {revisao ? (
        <RevisaoLote revisao={revisao} setRevisao={setRevisao} />
      ) : (
        <>
          <div className="abas">
            {(
              [
                ['mensagens', 'Colar mensagens'],
                ['pasta', 'Pasta do Cowork'],
                ['arquivos', 'Arquivos'],
                ['configurar', 'Configurar API'],
              ] as [Aba, string][]
            ).map(([k, v]) => (
              <button key={k} className={aba === k ? 'ativa' : ''} onClick={() => setAba(k)}>
                {v}
              </button>
            ))}
          </div>
          {aba === 'mensagens' && <ColarMensagens aoRevisar={abrirRevisao} irConfigurar={() => setAba('configurar')} />}
          {aba === 'pasta' && <PastaCowork aoRevisar={abrirRevisao} />}
          {aba === 'arquivos' && <Arquivos aoRevisar={abrirRevisao} />}
          {aba === 'configurar' && <ConfigurarAPI />}
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Colar mensagens

function useConfigIA() {
  const cfg = useLiveQuery(async () => {
    const [k, m] = await Promise.all([db.config.get('anthropicApiKey'), db.config.get('modeloClaude')]);
    return { apiKey: (k?.valor as string | undefined) ?? '', modelo: (m?.valor as string | undefined) ?? MODELO_PADRAO };
  }, []);
  return cfg;
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function ColarMensagens(props: { aoRevisar: (l: LoteIA, fonte: string) => void; irConfigurar: () => void }) {
  const { empresa, avisar } = useApp();
  const cfg = useConfigIA();
  const [texto, setTexto] = useState('');
  const [resposta, setResposta] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [promptVisivel, setPromptVisivel] = useState('');
  const abortar = useRef<AbortController | null>(null);

  async function enviarAPI() {
    if (!texto.trim()) return setErros(['Cole ao menos uma mensagem.']);
    setErros([]);
    setEnviando(true);
    abortar.current = new AbortController();
    try {
      const contexto = await gerarContextoContabil(empresa!.id!);
      const r = await sugerirLancamentosComClaude({ apiKey: cfg!.apiKey, modelo: cfg!.modelo, contexto, texto, sinal: abortar.current.signal });
      avisar(`Claude respondeu com ${r.lote.lancamentos.length} sugestão(ões) · ${r.tokensEntrada} tokens de entrada, ${r.tokensSaida} de saída.`, 'sucesso');
      props.aoRevisar(r.lote, `Mensagens coladas · ${r.modeloUsado} via API · ${formatarDataHora(new Date().toISOString())}`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErros([(e as Error).message]);
    } finally {
      setEnviando(false);
    }
  }

  async function copiarPrompt() {
    if (!texto.trim()) return setErros(['Cole ao menos uma mensagem.']);
    const prompt = montarPromptCompleto(await gerarContextoContabil(empresa!.id!), texto);
    if (await copiar(prompt)) {
      avisar('Prompt copiado! Cole no Claude (claude.ai, app ou Cowork) e depois cole a resposta JSON aqui embaixo.', 'sucesso');
      setPromptVisivel('');
    } else {
      setPromptVisivel(prompt);
    }
  }

  function revisarResposta() {
    const { lote, erros: e } = interpretarLoteIA(resposta);
    if (!lote) return setErros(e);
    setErros(e);
    props.aoRevisar(lote, `Resposta colada · ${formatarDataHora(new Date().toISOString())}`);
  }

  return (
    <>
      <div className="aviso alerta">
        Uso educacional: cole apenas mensagens <strong>fictícias</strong> ou sem dados pessoais. No modo API o texto é enviado à Anthropic usando a sua chave.
      </div>
      <div className="cartao">
        <div className="cabecalho-pagina" style={{ marginBottom: 8 }}>
          <h2>1. Cole as mensagens, e-mails ou extratos</h2>
          <button className="pequeno" onClick={() => setTexto(MENSAGENS_EXEMPLO)}>
            Usar mensagens de exemplo
          </button>
        </div>
        <textarea
          rows={12}
          style={{ width: '100%' }}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={'Ex.:\n--- E-mail da imobiliária, 05/03/2026 ---\nRecebemos o aluguel de março, R$ 3.500,00, pago por TED.\n\n--- WhatsApp do fornecedor ---\nSegue a NF 2045, total R$ 12.000,00…'}
        />
        <p className="texto-2">Separe cada mensagem com uma linha (ex.: “--- E-mail ---”) e inclua remetente e data quando tiver.</p>
        <ListaErros erros={erros} />
        <div className="acoes">
          {cfg?.apiKey ? (
            enviando ? (
              <button onClick={() => abortar.current?.abort()}>Cancelar envio…</button>
            ) : (
              <button className="primario" onClick={enviarAPI}>
                Analisar com o Claude (API)
              </button>
            )
          ) : (
            <button onClick={props.irConfigurar} title="Configure sua chave de API para usar o modo direto">
              Configurar chave de API para analisar aqui
            </button>
          )}
          <button onClick={copiarPrompt}>Copiar prompt para o Claude/Cowork</button>
        </div>
        {enviando && <p className="texto-2">Enviando ao Claude e aguardando a resposta estruturada…</p>}
        {promptVisivel && (
          <Campo rotulo="Não consegui copiar automaticamente — selecione e copie o prompt:">
            <textarea rows={8} readOnly value={promptVisivel} onFocus={(e) => e.target.select()} />
          </Campo>
        )}
      </div>
      <div className="cartao">
        <h2>2. (Modo copiar/colar) Cole aqui a resposta do Claude</h2>
        <p className="texto-2">Aceita o JSON puro ou a resposta inteira com o bloco ```json.</p>
        <textarea rows={8} style={{ width: '100%' }} className="mono" value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder='{"lancamentos": [...], "naoLancados": [...]}' />
        <div className="acoes" style={{ marginTop: 8 }}>
          <button className="primario" disabled={!resposta.trim()} onClick={revisarResposta}>
            Revisar sugestões
          </button>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Pasta do Cowork

function PastaCowork(props: { aoRevisar: (l: LoteIA, fonte: string, arquivo?: string) => void }) {
  const { empresa, avisar } = useApp();
  const acao = useAcao();
  const [pasta, setPasta] = useState<FileSystemDirectoryHandle | undefined>();
  const [permitido, setPermitido] = useState(false);
  const [lotes, setLotes] = useState<LotePendente[] | null>(null);
  const suporta = navegadorSuportaPastas();

  useEffect(() => {
    (async () => {
      const p = await obterPastaSalva();
      setPasta(p);
      if (p) setPermitido(await garantirPermissao(p, false));
    })();
  }, []);

  async function atualizarContexto(p = pasta) {
    if (!p) return;
    await gravarContextoNaPasta(p, await gerarContextoContabil(empresa!.id!));
  }

  async function verificar(p = pasta) {
    if (!p) return;
    setLotes(await listarLotesPendentes(p));
  }

  async function escolher() {
    const p = await acao(escolherPasta);
    if (!p) return;
    setPasta(p);
    setPermitido(true);
    await acao(() => atualizarContexto(p), 'Pasta preparada: contexto gravado em contexto/contexto-contabil.json.');
    await verificar(p);
  }

  async function permitir() {
    if (pasta && (await garantirPermissao(pasta, true))) {
      setPermitido(true);
      await verificar();
    } else avisar('Permissão negada pelo navegador.', 'erro');
  }

  if (!suporta) {
    return (
      <div className="cartao">
        <h2>Pasta compartilhada não disponível neste navegador</h2>
        <p>
          A integração por pasta usa a File System Access API (Chrome, Edge, Brave, Opera). Neste navegador use a aba <strong>Arquivos</strong>: baixe o
          contexto, entregue ao Claude e envie de volta o lote JSON que ele gerar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="cartao">
        <h2>Como funciona com o Claude Cowork</h2>
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          <li>Escolha (ou crie) uma pasta no seu computador — ex.: <code>Documentos/contabil-escola</code>. O sistema grava nela o contexto contábil.</li>
          <li>
            No Cowork, dê acesso a essa pasta e instale a skill <code>lancamentos-contabeis</code> (veja <code>docs/MANUAL-IA.md</code>).
          </li>
          <li>
            Peça ao Claude, por exemplo: <em>“Leia meus e-mails desta semana sobre pagamentos e notas fiscais e gere os lançamentos na pasta contabil-escola.”</em>
          </li>
          <li>O Claude grava o lote em <code>entrada/</code>. Clique em “Verificar lotes”, revise e aprove.</li>
        </ol>
      </div>
      <div className="cartao">
        <div className="acoes">
          <button className="primario" onClick={escolher}>
            {pasta ? 'Trocar pasta' : 'Escolher pasta de integração'}
          </button>
          {pasta && !permitido && <button onClick={permitir}>Permitir acesso à pasta “{pasta.name}”</button>}
          {pasta && permitido && (
            <>
              <button onClick={() => acao(() => atualizarContexto(), 'Contexto atualizado na pasta.')}>Atualizar contexto na pasta</button>
              <button onClick={() => acao(() => verificar())}>Verificar lotes</button>
            </>
          )}
          {pasta && (
            <button
              className="link"
              onClick={async () => {
                await esquecerPasta();
                setPasta(undefined);
                setLotes(null);
              }}
            >
              Esquecer pasta
            </button>
          )}
        </div>
        {pasta && (
          <p className="texto-2">
            Pasta: <strong>{pasta.name}</strong> · contexto em <code>contexto/{ARQUIVO_CONTEXTO}</code> · lotes em <code>entrada/</code>. Atualize o contexto sempre
            que mudar o plano de contas ou fechar períodos.
          </p>
        )}
      </div>
      {lotes && (
        <div className="cartao">
          <h2>Lotes aguardando revisão ({lotes.length})</h2>
          {!lotes.length && <p className="texto-2">Nenhum arquivo .json em entrada/.</p>}
          {lotes.map((l) => {
            const { lote, erros } = interpretarLoteIA(l.conteudo);
            return (
              <div key={l.nome} className="sugestao">
                <div className="topo-sugestao">
                  <strong>{l.nome}</strong>
                  <span className="texto-2">{formatarDataHora(new Date(l.modificadoEm).toISOString())}</span>
                  {lote ? <span className="etiqueta info">{lote.lancamentos.length} sugestão(ões)</span> : <span className="etiqueta perigo">inválido</span>}
                  {lote?.geradoPor && <span className="texto-2">{lote.geradoPor}</span>}
                  <span className="espaco" />
                  {lote && (
                    <button className="pequeno primario" onClick={() => props.aoRevisar(lote, `Pasta ${pasta!.name}/entrada/${l.nome}`, l.nome)}>
                      Revisar
                    </button>
                  )}
                  <button className="pequeno" onClick={() => acao(async () => (await moverLote(pasta!, l.nome, 'descartados'), await verificar()), 'Lote movido para descartados/.')}>
                    Descartar
                  </button>
                </div>
                {erros.length > 0 && <ListaErros erros={erros} titulo="Problemas no arquivo:" />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Arquivos

function Arquivos(props: { aoRevisar: (l: LoteIA, fonte: string) => void }) {
  const { empresa } = useApp();
  const [erros, setErros] = useState<string[]>([]);
  return (
    <div className="grade">
      <div className="cartao">
        <h2>Baixar o contexto contábil</h2>
        <p>
          Arquivo <code>{ARQUIVO_CONTEXTO}</code> com a empresa, o plano de contas (analíticas), centros de custo, históricos padrão, períodos abertos e o formato
          de resposta. Entregue ao Claude junto com as mensagens.
        </p>
        <button
          className="primario"
          onClick={async () => baixarArquivo(ARQUIVO_CONTEXTO, JSON.stringify(await gerarContextoContabil(empresa!.id!), null, 2))}
        >
          Baixar contexto-contabil.json
        </button>
      </div>
      <div className="cartao">
        <h2>Enviar um lote gerado pelo Claude</h2>
        <p>Arquivo JSON no formato “contabil-escola/lote-lancamentos”.</p>
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const { lote, erros: er } = interpretarLoteIA(await f.text());
            setErros(er);
            if (lote) props.aoRevisar(lote, `Arquivo ${f.name}`);
          }}
        />
        <ListaErros erros={erros} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Configurar API

function ConfigurarAPI() {
  const acao = useAcao();
  const cfg = useConfigIA();
  const [chave, setChave] = useState('');
  return (
    <div className="cartao" style={{ maxWidth: 760 }}>
      <h2>Modo direto: chamar o Claude pela API</h2>
      <p>
        Opcional. Com uma chave de API da Anthropic (crie em <code>platform.claude.com</code>), o sistema envia as mensagens coladas direto ao Claude, sem
        copiar/colar. Sem chave, use o modo copiar/colar ou a pasta do Cowork.
      </p>
      <div className="aviso alerta">
        A chave fica guardada <strong>só neste navegador</strong> (IndexedDB), não vai para o backup e é enviada apenas para a API da Anthropic. Qualquer
        pessoa com acesso a este navegador pode usá-la: use uma chave com limite de gastos e remova quando terminar.
      </div>
      <div className="form-grade">
        <Campo rotulo="Chave de API" className="col-8" dica={cfg?.apiKey ? `Configurada (termina em …${cfg.apiKey.slice(-4)})` : 'Não configurada'}>
          <input type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} placeholder="sk-ant-…" />
        </Campo>
        <Campo rotulo="Modelo" className="col-4">
          <select value={cfg?.modelo ?? MODELO_PADRAO} onChange={(e) => acao(() => db.config.put({ chave: 'modeloClaude', valor: e.target.value }).then(() => undefined), 'Modelo salvo.')}>
            {MODELOS_CLAUDE.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="acoes" style={{ marginTop: 12 }}>
        <button
          className="primario"
          disabled={!chave.trim()}
          onClick={async () => {
            await acao(() => db.config.put({ chave: 'anthropicApiKey', valor: chave.trim() }).then(() => undefined), 'Chave salva neste navegador.');
            setChave('');
          }}
        >
          Salvar chave
        </button>
        {cfg?.apiKey && (
          <button className="perigo" onClick={() => acao(() => db.config.delete('anthropicApiKey'), 'Chave removida.')}>
            Remover chave
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Revisão e aprovação

function RevisaoLote({ revisao, setRevisao }: { revisao: Revisao; setRevisao: (r: Revisao | null) => void }) {
  const { empresa, confirmar } = useApp();
  const acao = useAcao();
  const navegar = useNavigate();
  const ctx = useLiveQuery(() => carregarContextoImportacao(empresa!.id!), [empresa?.id]);
  const resultado = useMemo(() => (ctx ? validarLoteIA(revisao.lote, ctx) : null), [ctx, revisao.lote]);
  const iniciou = useRef(false);

  // aprovação padrão: válidas com confiança alta ou média
  useEffect(() => {
    if (!resultado || iniciou.current || revisao.aprovadas.length || revisao.tratadas.length) return;
    iniciou.current = true;
    setRevisao({ ...revisao, aprovadas: resultado.sugestoes.filter((s) => s.valido && s.lancamento.confianca !== 'baixa').map((s) => s.lancamento.id) });
  }, [resultado, revisao, setRevisao]);

  if (!resultado || !ctx) return <div className="vazio">Validando sugestões…</div>;

  const outraEmpresa = revisao.lote.empresaCnpj && normalizarCNPJ(revisao.lote.empresaCnpj) !== normalizarCNPJ(empresa!.cnpj);
  const aprovadas = resultado.sugestoes.filter((s) => s.valido && revisao.aprovadas.includes(s.lancamento.id) && !revisao.tratadas.includes(s.lancamento.id));
  const alternar = (id: string) =>
    setRevisao({ ...revisao, aprovadas: revisao.aprovadas.includes(id) ? revisao.aprovadas.filter((x) => x !== id) : [...revisao.aprovadas, id] });

  async function lancar() {
    const lotesValidacao = new Map(resultado!.validacao.lotes.map((l) => [l.chave, l]));
    const rascunhos = aprovadas.map((s) => lotesValidacao.get(s.lancamento.id)!.rascunho!);
    const imp = await acao(
      () =>
        importarLotes(empresa!.id!, rascunhos, {
          arquivo: revisao.fonte,
          formato: 'IA_JSON',
          linhasLidas: resultado!.sugestoes.length,
          linhasImportadas: rascunhos.length,
          linhasRejeitadas: resultado!.sugestoes.length - rascunhos.length - revisao.tratadas.length,
        }),
      `${rascunhos.length} lançamento(s) gravado(s) a partir das sugestões.`,
    );
    if (!imp) return;
    if (revisao.arquivoPasta) {
      const pasta = await obterPastaSalva();
      if (pasta && (await garantirPermissao(pasta, true))) await acao(() => moverLote(pasta, revisao.arquivoPasta!, 'processados'));
    }
    setRevisao(null);
    navegar('/lancamentos');
  }

  async function descartar() {
    if (!(await confirmar({ titulo: 'Descartar revisão', mensagem: 'Descartar todas as sugestões deste lote?', perigo: true, textoConfirmar: 'Descartar' }))) return;
    if (revisao.arquivoPasta) {
      const pasta = await obterPastaSalva();
      if (pasta && (await garantirPermissao(pasta, true))) await acao(() => moverLote(pasta, revisao.arquivoPasta!, 'descartados'));
    }
    setRevisao(null);
  }

  const corConfianca = { alta: 'sucesso', media: 'aviso', baixa: 'perigo' } as const;
  const nomeConfianca = { alta: 'alta', media: 'média', baixa: 'baixa' } as const;

  return (
    <>
      <div className="cartao">
        <div className="cabecalho-pagina" style={{ marginBottom: 0 }}>
          <div>
            <h2>Revisão das sugestões</h2>
            <p>
              {revisao.fonte}
              {revisao.lote.geradoPor ? ` · ${revisao.lote.geradoPor}` : ''}
              {revisao.lote.geradoEm ? ` · gerado em ${formatarDataHora(revisao.lote.geradoEm)}` : ''}
            </p>
          </div>
          <div className="acoes">
            <button onClick={descartar}>Descartar lote</button>
            <button className="primario" disabled={!aprovadas.length} onClick={lancar}>
              Lançar {aprovadas.length} aprovada(s)
            </button>
          </div>
        </div>
      </div>
      {outraEmpresa && (
        <div className="aviso perigo">
          Atenção: este lote foi gerado para o CNPJ {revisao.lote.empresaCnpj}, mas a empresa selecionada é {empresa!.cnpj}. Confira antes de lançar.
        </div>
      )}
      <div className="aviso info">
        Marque as sugestões que quer lançar. Sugestões com erro não podem ser lançadas direto — use “Corrigir no editor”. Confiança: <strong>alta</strong> = dados
        explícitos; <strong>média</strong> = houve inferência; <strong>baixa</strong> = informação incompleta (não vem marcada).
      </div>

      {resultado.sugestoes.map((s) => {
        const l = s.lancamento;
        const tratada = revisao.tratadas.includes(l.id);
        return (
          <div key={l.id} className={`sugestao ${s.valido ? '' : 'invalida'}`} style={tratada ? { opacity: 0.55 } : undefined}>
            <div className="topo-sugestao">
              <label className="check">
                <input type="checkbox" disabled={!s.valido || tratada} checked={revisao.aprovadas.includes(l.id) && s.valido && !tratada} onChange={() => alternar(l.id)} />
                <strong>
                  {l.id} · {formatarData(l.data) || l.data} · {l.historico}
                </strong>
              </label>
              {l.documento && <span className="texto-2">{l.documento}</span>}
              <span className={`etiqueta ${corConfianca[l.confianca]}`}>confiança {nomeConfianca[l.confianca]}</span>
              {tratada ? (
                <span className="etiqueta sucesso">corrigida e salva no editor</span>
              ) : s.valido ? (
                <span className="etiqueta sucesso">válida</span>
              ) : (
                <span className="etiqueta perigo">com erro</span>
              )}
              <span className="espaco" />
              {!tratada && (
                <button
                  className="pequeno"
                  onClick={() =>
                    navegar('/lancamentos/novo', {
                      state: { rascunho: rascunhoDaSugestao(l, ctx), origem: 'IA', voltarPara: '/assistente', idSugestao: l.id },
                    })
                  }
                >
                  Corrigir no editor
                </button>
              )}
            </div>
            <div className="tabela-container" style={{ marginTop: 8 }}>
              <table>
                <tbody>
                  {l.partidas.map((p, i) => {
                    const conta = localizarConta(p.conta, ctx.indice, ctx.mascara);
                    const valor = interpretarMoeda(p.valor);
                    return (
                      <tr key={i}>
                        <td style={{ width: 30 }}>
                          <strong>{p.tipo}</strong>
                        </td>
                        <td className="mono" style={{ width: 130 }}>
                          {p.conta}
                        </td>
                        <td>{conta ? conta.nome : <span className="texto-perigo">conta não encontrada</span>}</td>
                        <td>{p.centroCusto && `CC ${p.centroCusto}`}</td>
                        <td className="num">{valor !== null ? formatarMoeda(valor) : String(p.valor)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(l.origem.referencia || l.origem.trecho) && (
              <div style={{ marginTop: 6 }}>
                <span className="texto-2">
                  Fonte ({l.origem.tipo}): {l.origem.referencia}
                </span>
                {l.origem.trecho && <blockquote>{l.origem.trecho}</blockquote>}
              </div>
            )}
            {l.justificativa && <p style={{ margin: '4px 0' }}>Justificativa: {l.justificativa}</p>}
            {l.duvidas.length > 0 && (
              <div className="aviso alerta" style={{ margin: '6px 0 0' }}>
                <strong>Dúvidas para você confirmar:</strong>
                <ul>
                  {l.duvidas.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {s.erros.length > 0 && <ListaErros erros={s.erros} titulo="Erros de validação:" />}
          </div>
        );
      })}

      {revisao.lote.naoLancados.length > 0 && (
        <div className="cartao">
          <h2>Mensagens sem lançamento ({revisao.lote.naoLancados.length})</h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {revisao.lote.naoLancados.map((n, i) => (
              <li key={i}>
                <strong>{n.referencia || 'Mensagem'}</strong>: {n.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
