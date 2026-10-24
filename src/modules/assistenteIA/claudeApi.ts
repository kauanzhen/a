import Anthropic from '@anthropic-ai/sdk';
import { INSTRUCOES_ASSISTENTE, contextoComoTexto, type ContextoContabil } from './contextoIA';
import { SCHEMA_LOTE, interpretarLoteIA, type LoteIA } from './formatoLote';

export const MODELOS_CLAUDE = [
  { id: 'claude-opus-5-5', nome: 'Claude Opus 5.5 (padrão — mais preciso)' },
  { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5 (mais rápido)' },
  { id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5 (mais econômico)' },
] as const;

export const MODELO_PADRAO = MODELOS_CLAUDE[0].id;

export interface ResultadoClaude {
  lote: LoteIA;
  erros: string[];
  modeloUsado: string;
  tokensEntrada: number;
  tokensSaida: number;
}

/**
 * Envia o texto (mensagens, e-mails...) ao Claude direto do navegador, usando a chave de API
 * do próprio usuário, e recebe o lote de lançamentos sugeridos em JSON (saída estruturada).
 *
 * Observações:
 *  - `dangerouslyAllowBrowser`: o SDK bloqueia uso no navegador porque a chave fica exposta
 *    ao código da página. Aqui a chave é do próprio usuário e fica só neste navegador.
 *  - `fallbacks: "default"`: se o modelo recusar por política, o servidor tenta outro modelo
 *    automaticamente (beta server-side-fallback).
 */
export async function sugerirLancamentosComClaude(opcoes: {
  apiKey: string;
  modelo: string;
  contexto: ContextoContabil;
  texto: string;
  sinal?: AbortSignal;
}): Promise<ResultadoClaude> {
  const client = new Anthropic({ apiKey: opcoes.apiKey, dangerouslyAllowBrowser: true });
  let resposta;
  try {
    resposta = await client.beta.messages.create(
      {
        model: opcoes.modelo,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA_LOTE as unknown as Record<string, unknown> } },
        system: [
          { type: 'text', text: INSTRUCOES_ASSISTENTE },
          { type: 'text', text: `=== CONTEXTO CONTÁBIL ===\n${contextoComoTexto(opcoes.contexto)}`, cache_control: { type: 'ephemeral' } },
        ],
        messages: [
          {
            role: 'user',
            content: `Analise as mensagens abaixo e devolva o lote de lançamentos sugeridos.\n<mensagens>\n${opcoes.texto.trim()}\n</mensagens>`,
          },
        ],
      },
      { signal: opcoes.sinal },
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Chave de API inválida. Confira em Configurações > Assistente IA.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('A chave não tem permissão para este modelo.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Limite de uso da API atingido. Aguarde um pouco e tente de novo.');
    if (e instanceof Anthropic.BadRequestError) throw new Error(`A API recusou a requisição: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Sem conexão com a API do Claude. Verifique a internet.');
    if (e instanceof Anthropic.APIError) throw new Error(`Erro da API (${e.status}): ${e.message}`);
    throw e;
  }

  if (resposta.stop_reason === 'refusal') {
    throw new Error(`O modelo recusou o pedido${resposta.stop_details?.explanation ? `: ${resposta.stop_details.explanation}` : '.'}`);
  }
  if (resposta.stop_reason === 'max_tokens') {
    throw new Error('A resposta ficou longa demais e foi cortada. Envie menos mensagens por vez.');
  }
  const texto = resposta.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const { lote, erros } = interpretarLoteIA(texto);
  if (!lote) throw new Error(erros.join('\n') || 'A resposta não trouxe um lote válido.');
  lote.geradoPor = `Claude (${resposta.model}) via API`;
  return {
    lote,
    erros,
    modeloUsado: resposta.model,
    tokensEntrada: resposta.usage.input_tokens + (resposta.usage.cache_read_input_tokens ?? 0) + (resposta.usage.cache_creation_input_tokens ?? 0),
    tokensSaida: resposta.usage.output_tokens,
  };
}
