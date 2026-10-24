/**
 * Formato de troca entre o sistema e um assistente de IA (Claude no Cowork, no app,
 * no Claude Code ou via API): o "lote de lançamentos sugeridos" em JSON.
 *
 * O assistente NUNCA grava nada sozinho: o lote passa pelo mesmo validador da importação
 * Excel e o usuário aprova, um a um, o que entra na contabilidade.
 */
import type { FormatoImportacao } from '../../db/types';
import { validarImportacao, type ContextoImportacao, type ResultadoValidacao } from '../importacao/validador';
import type { Mapeamento } from '../importacao/colunas';

export const IDENTIFICADOR_LOTE = 'contabil-escola/lote-lancamentos';
export const VERSAO_LOTE = 1;

export type Confianca = 'alta' | 'media' | 'baixa';
export type TipoOrigem = 'email' | 'mensagem' | 'documento' | 'extrato' | 'outro';

export interface PartidaIA {
  conta: string;
  tipo: 'D' | 'C';
  valor: number | string;
  centroCusto: string;
  historico: string;
}

export interface LancamentoIA {
  id: string;
  data: string;
  documento: string;
  historico: string;
  partidas: PartidaIA[];
  origem: { tipo: TipoOrigem; referencia: string; trecho: string };
  confianca: Confianca;
  justificativa: string;
  duvidas: string[];
}

export interface LoteIA {
  formato?: string;
  versao?: number;
  empresaCnpj?: string;
  geradoPor?: string;
  geradoEm?: string;
  lancamentos: LancamentoIA[];
  naoLancados: { referencia: string; motivo: string }[];
}

/** JSON Schema do lote (usado nas saídas estruturadas da API e documentado na skill). */
export const SCHEMA_LOTE = {
  type: 'object',
  additionalProperties: false,
  required: ['lancamentos', 'naoLancados'],
  properties: {
    lancamentos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'data', 'documento', 'historico', 'partidas', 'origem', 'confianca', 'justificativa', 'duvidas'],
        properties: {
          id: { type: 'string', description: 'Identificador do lançamento dentro do lote, ex.: "L1".' },
          data: { type: 'string', description: 'Data do fato contábil no formato AAAA-MM-DD.' },
          documento: { type: 'string', description: 'Número do documento (NF, boleto, recibo) ou "" se não houver.' },
          historico: { type: 'string', description: 'Histórico claro em português, ex.: "Pagamento de aluguel ref. 03/2026".' },
          partidas: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['conta', 'tipo', 'valor', 'centroCusto', 'historico'],
              properties: {
                conta: { type: 'string', description: 'Código de classificação de uma conta ANALÍTICA do contexto, ex.: "1.1.1.02.0001".' },
                tipo: { type: 'string', enum: ['D', 'C'] },
                valor: { type: 'number', description: 'Valor em reais, positivo, com até 2 casas decimais.' },
                centroCusto: { type: 'string', description: 'Código do centro de custo, ou "" se não se aplica.' },
                historico: { type: 'string', description: 'Histórico próprio da partida, ou "" para usar o do lançamento.' },
              },
            },
          },
          origem: {
            type: 'object',
            additionalProperties: false,
            required: ['tipo', 'referencia', 'trecho'],
            properties: {
              tipo: { type: 'string', enum: ['email', 'mensagem', 'documento', 'extrato', 'outro'] },
              referencia: { type: 'string', description: 'Remetente/assunto/data ou nome do arquivo de onde o fato foi tirado.' },
              trecho: { type: 'string', description: 'Trecho curto (até 200 caracteres) que comprova o fato.' },
            },
          },
          confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          justificativa: { type: 'string', description: 'Por que estas contas e este regime (competência/caixa).' },
          duvidas: { type: 'array', items: { type: 'string' }, description: 'Pontos que o usuário precisa confirmar.' },
        },
      },
    },
    naoLancados: {
      type: 'array',
      description: 'Mensagens que não geraram lançamento (sem fato contábil ou sem informação suficiente).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['referencia', 'motivo'],
        properties: { referencia: { type: 'string' }, motivo: { type: 'string' } },
      },
    },
  },
} as const;

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/**
 * Lê o JSON (texto ou objeto) e normaliza para LoteIA. Aceita o JSON puro ou dentro de um
 * bloco ```json ... ``` (útil quando o usuário cola a resposta de um chat).
 * Retorna erros de ESTRUTURA; as regras contábeis são verificadas depois pelo validador.
 */
export function interpretarLoteIA(entrada: unknown): { lote?: LoteIA; erros: string[] } {
  let obj: unknown = entrada;
  if (typeof entrada === 'string') {
    const bloco = entrada.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const textoJson = (bloco ? bloco[1] : entrada).trim();
    const inicio = textoJson.indexOf('{');
    const fim = textoJson.lastIndexOf('}');
    if (inicio < 0 || fim < inicio) return { erros: ['Não encontrei um objeto JSON no texto colado.'] };
    try {
      obj = JSON.parse(textoJson.slice(inicio, fim + 1));
    } catch (e) {
      return { erros: [`JSON inválido: ${(e as Error).message}`] };
    }
  }
  if (!ehObjeto(obj)) return { erros: ['O lote deve ser um objeto JSON.'] };
  const erros: string[] = [];
  if (obj.formato !== undefined && obj.formato !== IDENTIFICADOR_LOTE) erros.push(`Formato desconhecido: "${str(obj.formato)}".`);
  if (typeof obj.versao === 'number' && obj.versao > VERSAO_LOTE) erros.push(`Versão ${obj.versao} do lote é mais nova que a suportada (${VERSAO_LOTE}).`);
  if (!Array.isArray(obj.lancamentos)) {
    erros.push('Campo "lancamentos" ausente ou não é uma lista.');
    return { erros };
  }
  const ids = new Set<string>();
  const lancamentos: LancamentoIA[] = obj.lancamentos.map((l: unknown, i: number) => {
    const o = ehObjeto(l) ? l : {};
    let id = str(o.id).trim() || `L${i + 1}`;
    if (ids.has(id)) id = `${id}-${i + 1}`;
    ids.add(id);
    const origem = ehObjeto(o.origem) ? o.origem : {};
    const partidas = Array.isArray(o.partidas) ? o.partidas : [];
    if (!partidas.length) erros.push(`Lançamento ${id}: sem partidas.`);
    return {
      id,
      data: str(o.data),
      documento: str(o.documento),
      historico: str(o.historico),
      partidas: partidas.map((p: unknown) => {
        const q = ehObjeto(p) ? p : {};
        return {
          conta: str(q.conta),
          tipo: str(q.tipo).toUpperCase() as 'D' | 'C',
          valor: typeof q.valor === 'number' ? q.valor : str(q.valor),
          centroCusto: str(q.centroCusto),
          historico: str(q.historico),
        };
      }),
      origem: {
        tipo: (['email', 'mensagem', 'documento', 'extrato', 'outro'].includes(str(origem.tipo)) ? str(origem.tipo) : 'outro') as TipoOrigem,
        referencia: str(origem.referencia),
        trecho: str(origem.trecho),
      },
      confianca: (['alta', 'media', 'baixa'].includes(str(o.confianca)) ? str(o.confianca) : 'baixa') as Confianca,
      justificativa: str(o.justificativa),
      duvidas: Array.isArray(o.duvidas) ? o.duvidas.map(str).filter(Boolean) : [],
    };
  });
  const naoLancados = Array.isArray(obj.naoLancados)
    ? obj.naoLancados.map((n: unknown) => (ehObjeto(n) ? { referencia: str(n.referencia), motivo: str(n.motivo) } : { referencia: '', motivo: str(n) }))
    : [];
  return {
    lote: {
      formato: str(obj.formato) || IDENTIFICADOR_LOTE,
      versao: typeof obj.versao === 'number' ? obj.versao : VERSAO_LOTE,
      empresaCnpj: obj.empresaCnpj ? str(obj.empresaCnpj) : undefined,
      geradoPor: obj.geradoPor ? str(obj.geradoPor) : undefined,
      geradoEm: obj.geradoEm ? str(obj.geradoEm) : undefined,
      lancamentos,
      naoLancados,
    },
    erros,
  };
}

const CABECALHO = ['Lote', 'Data', 'Conta', 'D/C', 'Valor', 'Histórico', 'Documento', 'Centro de Custo'];
const MAPA_PARTIDA: Mapeamento = { lote: 0, data: 1, conta: 2, dc: 3, valor: 4, historico: 5, documento: 6, centroCusto: 7 };

/** Converte o lote em linhas "uma por partida" (linha 1 = cabeçalho, linha 2 em diante = partidas). */
export function loteParaLinhas(lote: LoteIA): unknown[][] {
  const linhas: unknown[][] = [CABECALHO];
  for (const l of lote.lancamentos) {
    for (const p of l.partidas) {
      linhas.push([l.id, l.data, p.conta, p.tipo, p.valor, p.historico || l.historico, l.documento, p.centroCusto]);
    }
  }
  return linhas;
}

export interface SugestaoValidada {
  lancamento: LancamentoIA;
  valido: boolean;
  erros: string[];
  /** linhas da validação (para mostrar erros por partida) */
  linhas: number[];
}

export interface ResultadoLoteIA {
  formato: FormatoImportacao;
  validacao: ResultadoValidacao;
  sugestoes: SugestaoValidada[];
}

/** Passa o lote pelo validador da importação e junta o resultado a cada sugestão. */
export function validarLoteIA(lote: LoteIA, ctx: ContextoImportacao): ResultadoLoteIA {
  const linhas = loteParaLinhas(lote);
  const validacao = validarImportacao(linhas, 0, MAPA_PARTIDA, 'PARTIDA', ctx);
  const porChave = new Map(validacao.lotes.map((l) => [l.chave, l]));
  const sugestoes = lote.lancamentos.map((lancamento) => {
    const v = porChave.get(lancamento.id);
    const errosLinhas = validacao.linhas
      .filter((lv) => v?.linhas.includes(lv.linha))
      .flatMap((lv) => lv.erros.map((e) => `Partida ${lv.linha - (v!.linhas[0] - 1)}: ${e}`));
    const erros = v ? [...errosLinhas, ...v.erros.filter((e) => !e.startsWith('Lote rejeitado'))] : ['Lançamento sem partidas.'];
    if (v?.rascunho) {
      v.rascunho.lote = undefined;
      v.rascunho.documento = lancamento.documento || undefined;
      v.rascunho.historico = lancamento.historico;
      v.rascunho.observacao = descreverOrigem(lancamento);
    }
    return { lancamento, valido: Boolean(v?.valido), erros, linhas: v?.linhas ?? [] };
  });
  return { formato: 'IA_JSON', validacao, sugestoes };
}

export function descreverOrigem(l: LancamentoIA): string {
  const partes = [
    `Sugerido por IA (confiança ${l.confianca}).`,
    l.origem.referencia && `Fonte (${l.origem.tipo}): ${l.origem.referencia}.`,
    l.justificativa && `Justificativa: ${l.justificativa}`,
  ];
  return partes.filter(Boolean).join(' ');
}
