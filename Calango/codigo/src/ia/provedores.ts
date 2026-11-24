// Envio dos documentos ao provedor de IA escolhido e leitura da resposta.
// Claude: biblioteca oficial da Anthropic. Gemini: API REST do Google.
// O navegador fala direto com o provedor; não há servidor do Calango no meio.

import Anthropic from '@anthropic-ai/sdk';
import { INSTRUCOES_SISTEMA, instrucoesLeitura } from './prompt';
import { ErroIA, ESQUEMA_RESPOSTA, PROVEDORES, type ArquivoParaLeitura, type ConfigIA, type ProvedorIA } from './tipos';

export interface OpcoesEnvio {
  signal?: AbortSignal;
  /** Só para testes: substitui o fetch do navegador. */
  fetch?: typeof fetch;
}

const TEMPO_LIMITE_MS = 180_000;

/**
 * Modelos Claude que aceitam o recurso de "fallback" no servidor: se o modelo
 * recusar o pedido, a Anthropic repete o mesmo pedido em outro modelo
 * recomendado, dentro da mesma chamada.
 */
const CLAUDE_COM_FALLBACK = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-fable-5-2', 'claude-sonnet-5-5']);

/** Modelos Claude que aceitam o ajuste de esforço (output_config.effort). */
function claudeAceitaEsforco(modelo: string): boolean {
  return /^claude-(opus|sonnet|fable|mythos|haiku)-5/.test(modelo) || /^claude-opus-4-[5-8]/.test(modelo) || /^claude-sonnet-4-6/.test(modelo);
}

function conferirConfig(cfg: ConfigIA): asserts cfg is ConfigIA & { provedor: ProvedorIA } {
  if (!cfg.provedor) throw new ErroIA('configuracao', 'Nenhum serviço de IA está configurado. Vá em Configurações → Leitura de documentos por IA e escolha o Claude ou o Gemini.');
  if (!cfg.chave.trim()) throw new ErroIA('configuracao', 'Falta a chave de API. Vá em Configurações → Leitura de documentos por IA e cole a chave.');
  if (!cfg.modelo.trim()) throw new ErroIA('configuracao', 'Falta o nome do modelo. Vá em Configurações → Leitura de documentos por IA e preencha o modelo.');
}

/** Envia os arquivos e devolve o JSON (ainda não conferido) da resposta. */
export async function lerDocumentos(cfg: ConfigIA, arquivos: ArquivoParaLeitura[], op: OpcoesEnvio = {}): Promise<unknown> {
  conferirConfig(cfg);
  if (!arquivos.length) throw new ErroIA('arquivo', 'Escolha pelo menos um arquivo (foto ou PDF do documento).');
  const texto = cfg.provedor === 'claude' ? await lerComClaude(cfg, arquivos, op) : await lerComGemini(cfg, arquivos, op);
  return interpretarJSON(texto);
}

/** Confere a chave e devolve a lista de modelos que ela pode usar. */
export async function listarModelos(cfg: ConfigIA, op: OpcoesEnvio = {}): Promise<string[]> {
  if (!cfg.provedor) throw new ErroIA('configuracao', 'Escolha primeiro o serviço (Claude ou Gemini).');
  if (!cfg.chave.trim()) throw new ErroIA('configuracao', 'Cole a chave de API antes de testar.');
  if (cfg.provedor === 'claude') {
    try {
      const pagina = await clienteClaude(cfg, op).models.list({ limit: 100 }, { signal: op.signal });
      return pagina.data.map((m) => m.id);
    } catch (e) {
      throw traduzirErroClaude(e, cfg.modelo);
    }
  }
  const resp = await chamarGemini(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200`, { method: 'GET', headers: { 'x-goog-api-key': cfg.chave.trim() } }, op, cfg.modelo);
  const dados = (await resp.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  return (dados.models ?? [])
    .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter(Boolean);
}

// ---------------- Claude ----------------

function clienteClaude(cfg: ConfigIA, op: OpcoesEnvio): Anthropic {
  return new Anthropic({
    apiKey: cfg.chave.trim(),
    // O Calango roda só no navegador, sem servidor: a chamada sai direto
    // daqui. A chave é do próprio escritório e fica na pasta de dados dele.
    dangerouslyAllowBrowser: true,
    timeout: TEMPO_LIMITE_MS,
    maxRetries: 1,
    ...(op.fetch ? { fetch: op.fetch } : {}),
  });
}

async function lerComClaude(cfg: ConfigIA, arquivos: ArquivoParaLeitura[], op: OpcoesEnvio, comFormato = true, permitirFallback = true): Promise<string> {
  const modelo = cfg.modelo.trim();
  const blocos: Anthropic.Beta.BetaContentBlockParam[] = arquivos.map((a) =>
    a.tipo === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.base64 }, title: a.nome }
      : { type: 'image', source: { type: 'base64', media_type: a.tipo, data: a.base64 } },
  );
  blocos.push({ type: 'text', text: instrucoesLeitura(arquivos) });
  const comFallback = permitirFallback && CLAUDE_COM_FALLBACK.has(modelo);
  let resposta: Anthropic.Beta.BetaMessage;
  try {
    resposta = await clienteClaude(cfg, op).beta.messages.create(
      {
        model: modelo,
        max_tokens: 16000,
        system: INSTRUCOES_SISTEMA,
        messages: [{ role: 'user', content: blocos }],
        output_config: {
          ...(claudeAceitaEsforco(modelo) ? { effort: 'medium' as const } : {}),
          ...(comFormato ? { format: { type: 'json_schema' as const, schema: ESQUEMA_RESPOSTA as unknown as Record<string, unknown> } } : {}),
        },
        ...(comFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      },
      { signal: op.signal },
    );
  } catch (e) {
    // Modelo antigo sem "saída estruturada": repete pedindo o JSON só pelo texto.
    // Conta sem o recurso de fallback liberado: repete sem ele.
    if (comFallback && e instanceof Anthropic.BadRequestError && /anthropic-beta|fallback/i.test(e.message)) {
      return lerComClaude(cfg, arquivos, op, comFormato, false);
    }
    if (comFormato && e instanceof Anthropic.BadRequestError && /output_config|output format|json_schema|schema/i.test(e.message)) {
      return lerComClaude(cfg, arquivos, op, false, permitirFallback);
    }
    throw traduzirErroClaude(e, modelo);
  }
  if (resposta.stop_reason === 'refusal') {
    throw new ErroIA(
      'recusa',
      'O serviço de IA se recusou a ler estes arquivos. Confira se são mesmo documentos de identificação ou comprovantes de residência e tente de novo; se continuar, preencha os dados à mão.',
      resposta.stop_details?.explanation ?? '',
    );
  }
  if (resposta.stop_reason === 'max_tokens') {
    throw new ErroIA('resposta', 'A resposta do serviço de IA veio cortada. Tente de novo com menos arquivos de cada vez.');
  }
  const texto = resposta.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (!texto.trim()) throw new ErroIA('resposta', 'O serviço de IA não devolveu nenhum dado. Tente de novo.');
  return texto;
}

function traduzirErroClaude(e: unknown, modelo: string): ErroIA {
  if (e instanceof ErroIA) return e;
  const detalhe = e instanceof Error ? e.message : String(e);
  // Do mais específico para o mais geral (as classes de conexão herdam de APIError).
  if (e instanceof Anthropic.APIUserAbortError) return new ErroIA('cancelado', 'Leitura cancelada.');
  if (e instanceof Anthropic.APIConnectionTimeoutError) return erroTempo(detalhe);
  if (e instanceof Anthropic.APIConnectionError) return erroSemInternet('Anthropic', detalhe);
  if (e instanceof Anthropic.AuthenticationError) return erroChave('Claude', detalhe);
  if (e instanceof Anthropic.PermissionDeniedError)
    return new ErroIA('permissao', 'A chave do Claude não tem permissão para este pedido. Confira a conta e o espaço de trabalho (workspace) da chave em platform.claude.com.', detalhe);
  if (e instanceof Anthropic.NotFoundError) return erroModelo(modelo, detalhe);
  if (e instanceof Anthropic.RateLimitError) return erroLimite(detalhe);
  if (e instanceof Anthropic.InternalServerError) return erroServico('Anthropic', detalhe);
  if (e instanceof Anthropic.APIError) {
    if (e.status === 402) return erroCredito('Anthropic', detalhe);
    if (e.status === 413) return erroTamanho(detalhe);
    if (e.status === 400 && /credit|billing|saldo/i.test(detalhe)) return erroCredito('Anthropic', detalhe);
    if (e.status === 400 && /too large|exceeds|size/i.test(detalhe)) return erroTamanho(detalhe);
    return new ErroIA('outro', `O serviço do Claude recusou o pedido (código ${e.status ?? '?'}). Se você trocou o nome do modelo, confira se ele está certo.`, detalhe);
  }
  return new ErroIA('outro', 'Erro inesperado ao falar com o serviço de IA. Tente de novo.', detalhe);
}

// ---------------- Gemini ----------------

async function lerComGemini(cfg: ConfigIA, arquivos: ArquivoParaLeitura[], op: OpcoesEnvio, comFormato = true): Promise<string> {
  const modelo = cfg.modelo.trim().replace(/^models\//, '');
  const corpo = {
    systemInstruction: { parts: [{ text: INSTRUCOES_SISTEMA }] },
    contents: [
      {
        role: 'user',
        parts: [...arquivos.map((a) => ({ inline_data: { mime_type: a.tipo, data: a.base64 } })), { text: instrucoesLeitura(arquivos) }],
      },
    ],
    generationConfig: { responseMimeType: 'application/json', ...(comFormato ? { responseJsonSchema: ESQUEMA_RESPOSTA } : {}) },
  };
  let resp: Response;
  try {
    resp = await chamarGemini(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.chave.trim() }, body: JSON.stringify(corpo) },
      op,
      modelo,
    );
  } catch (e) {
    // Modelo que não aceita o esquema: repete pedindo o JSON só pelo texto.
    if (comFormato && e instanceof ErroIA && e.tipo === 'outro' && /schema/i.test(e.detalhe)) return lerComGemini(cfg, arquivos, op, false);
    throw e;
  }
  const dados = (await resp.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  if (dados.promptFeedback?.blockReason) {
    throw new ErroIA('recusa', 'O Gemini bloqueou a leitura destes arquivos. Confira se são mesmo documentos pessoais e tente de novo; se continuar, preencha os dados à mão.', dados.promptFeedback.blockReason);
  }
  const candidato = dados.candidates?.[0];
  if (!candidato) throw new ErroIA('resposta', 'O Gemini não devolveu nenhum dado. Tente de novo.');
  if (candidato.finishReason && ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(candidato.finishReason)) {
    throw new ErroIA('recusa', 'O Gemini interrompeu a leitura destes arquivos. Tente de novo; se continuar, preencha os dados à mão.', candidato.finishReason);
  }
  if (candidato.finishReason === 'MAX_TOKENS') throw new ErroIA('resposta', 'A resposta do Gemini veio cortada. Tente de novo com menos arquivos de cada vez.');
  const texto = (candidato.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  if (!texto.trim()) throw new ErroIA('resposta', 'O Gemini não devolveu nenhum dado. Tente de novo.');
  return texto;
}

async function chamarGemini(url: string, init: RequestInit, op: OpcoesEnvio, modelo: string): Promise<Response> {
  const f = op.fetch ?? fetch;
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(new DOMException('tempo', 'TimeoutError')), TEMPO_LIMITE_MS);
  const cancelar = () => controle.abort(op.signal?.reason);
  op.signal?.addEventListener('abort', cancelar);
  let resp: Response;
  try {
    resp = await f(url, { ...init, signal: controle.signal });
  } catch (e) {
    if (op.signal?.aborted) throw new ErroIA('cancelado', 'Leitura cancelada.');
    if (controle.signal.aborted) throw erroTempo(String(e));
    throw erroSemInternet('Google', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(tempo);
    op.signal?.removeEventListener('abort', cancelar);
  }
  if (resp.ok) return resp;
  let detalhe = '';
  let status = '';
  try {
    const j = (await resp.json()) as { error?: { message?: string; status?: string; details?: { reason?: string }[] } };
    detalhe = j.error?.message ?? '';
    status = [j.error?.status, ...(j.error?.details ?? []).map((d) => d.reason)].filter(Boolean).join(' ');
  } catch {
    /* corpo sem JSON */
  }
  const tudo = `${status} ${detalhe}`;
  if (/API_KEY_INVALID|API key not valid|API_KEY/i.test(tudo) || resp.status === 401) return Promise.reject(erroChave('Gemini', detalhe));
  if (resp.status === 403) return Promise.reject(new ErroIA('permissao', 'A chave do Gemini não tem permissão para este pedido. Confira em aistudio.google.com se a chave está ativa e se a "Generative Language API" está liberada no projeto.', detalhe));
  if (resp.status === 404) return Promise.reject(erroModelo(modelo, detalhe));
  if (resp.status === 429) return Promise.reject(erroLimite(detalhe));
  if (resp.status === 413 || /too large|exceeds|payload size/i.test(detalhe)) return Promise.reject(erroTamanho(detalhe));
  if (resp.status >= 500) return Promise.reject(erroServico('Google', detalhe));
  return Promise.reject(new ErroIA('outro', `O serviço do Gemini recusou o pedido (código ${resp.status}). Se você trocou o nome do modelo, confira se ele está certo.`, detalhe));
}

// ---------------- Mensagens comuns ----------------

function erroChave(servico: string, detalhe: string) {
  const p = PROVEDORES.find((x) => x.rotulo === servico);
  return new ErroIA('chave', `A chave de API do ${servico} foi recusada (inválida, apagada ou copiada pela metade). Gere uma nova em ${p?.ondeObterChave ?? 'site do provedor'} e cole em Configurações.`, detalhe);
}
function erroModelo(modelo: string, detalhe: string) {
  return new ErroIA('modelo', `O modelo "${modelo}" não existe ou não está liberado para esta chave. Em Configurações, clique em "Testar chave" para ver os modelos disponíveis e escolha um deles.`, detalhe);
}
function erroLimite(detalhe: string) {
  return new ErroIA('limite', 'O limite de uso da sua conta no serviço de IA foi atingido (muitos pedidos seguidos ou limite do plano). Espere um minuto e tente de novo; se continuar, confira o plano e os limites da conta.', detalhe);
}
function erroCredito(empresa: string, detalhe: string) {
  return new ErroIA('credito', `A conta na ${empresa} está sem crédito ou com problema de pagamento. Confira o faturamento (billing) da conta e tente de novo.`, detalhe);
}
function erroTamanho(detalhe: string) {
  return new ErroIA('tamanho', 'Os arquivos são grandes demais para enviar de uma vez. Envie menos arquivos, ou fotos/PDFs menores.', detalhe);
}
function erroSemInternet(empresa: string, detalhe: string) {
  return new ErroIA('sem_internet', `Não foi possível falar com o serviço da ${empresa}. Confira a conexão com a internet (ou se a rede do escritório bloqueia o endereço do serviço) e tente de novo.`, detalhe);
}
function erroTempo(detalhe: string) {
  return new ErroIA('tempo', 'O serviço de IA demorou demais para responder. Tente de novo, de preferência com menos arquivos.', detalhe);
}
function erroServico(empresa: string, detalhe: string) {
  return new ErroIA('servico', `O serviço da ${empresa} está com problema ou sobrecarregado agora. Espere alguns minutos e tente de novo.`, detalhe);
}

/** Lê o JSON da resposta, tolerando texto em volta ou cercas ```json. */
export function interpretarJSON(texto: string): unknown {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(limpo);
  } catch {
    const ini = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (ini >= 0 && fim > ini) {
      try {
        return JSON.parse(limpo.slice(ini, fim + 1));
      } catch {
        /* segue */
      }
    }
    throw new ErroIA('resposta', 'A resposta do serviço de IA veio num formato inesperado. Tente de novo.', texto.slice(0, 300));
  }
}
