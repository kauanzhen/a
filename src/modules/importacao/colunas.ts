import type { FormatoImportacao } from '../../db/types';

export type Campo = 'lote' | 'data' | 'contaDebito' | 'contaCredito' | 'conta' | 'dc' | 'valor' | 'historico' | 'documento' | 'centroCusto';

export interface DefinicaoCampo {
  campo: Campo;
  rotulo: string;
  obrigatorio: boolean;
  sinonimos: string[];
}

export type Mapeamento = Partial<Record<Campo, number>>;

/** Colunas aceitas em cada formato e os nomes alternativos reconhecidos automaticamente. */
export const CAMPOS_POR_FORMATO: Record<FormatoImportacao, DefinicaoCampo[]> = {
  SIMPLES: [
    { campo: 'data', rotulo: 'Data', obrigatorio: true, sinonimos: ['data', 'dt', 'data lancamento', 'data do lancamento', 'date'] },
    { campo: 'contaDebito', rotulo: 'Conta Débito', obrigatorio: true, sinonimos: ['conta debito', 'debito', 'cta debito', 'conta deb', 'deb', 'conta devedora', 'd'] },
    { campo: 'contaCredito', rotulo: 'Conta Crédito', obrigatorio: true, sinonimos: ['conta credito', 'credito', 'cta credito', 'conta cred', 'cred', 'conta credora', 'c'] },
    { campo: 'valor', rotulo: 'Valor', obrigatorio: true, sinonimos: ['valor', 'vlr', 'valor r$', 'montante', 'quantia', 'value'] },
    { campo: 'historico', rotulo: 'Histórico', obrigatorio: true, sinonimos: ['historico', 'hist', 'descricao', 'complemento', 'memo'] },
    { campo: 'documento', rotulo: 'Documento', obrigatorio: false, sinonimos: ['documento', 'doc', 'nf', 'nota fiscal', 'numero documento', 'n documento'] },
    { campo: 'centroCusto', rotulo: 'Centro de Custo', obrigatorio: false, sinonimos: ['centro de custo', 'centro custo', 'cc', 'c custo', 'ccusto'] },
  ],
  PARTIDA: [
    { campo: 'lote', rotulo: 'Lote', obrigatorio: true, sinonimos: ['lote', 'numero lote', 'lancamento', 'n lancamento', 'grupo', 'id'] },
    { campo: 'data', rotulo: 'Data', obrigatorio: true, sinonimos: ['data', 'dt', 'data lancamento', 'date'] },
    { campo: 'conta', rotulo: 'Conta', obrigatorio: true, sinonimos: ['conta', 'cta', 'codigo conta', 'conta contabil', 'classificacao', 'reduzido'] },
    { campo: 'dc', rotulo: 'D/C', obrigatorio: true, sinonimos: ['d/c', 'dc', 'd c', 'natureza', 'tipo', 'debito/credito', 'deb/cred'] },
    { campo: 'valor', rotulo: 'Valor', obrigatorio: true, sinonimos: ['valor', 'vlr', 'valor r$', 'montante'] },
    { campo: 'historico', rotulo: 'Histórico', obrigatorio: true, sinonimos: ['historico', 'hist', 'descricao', 'complemento'] },
    { campo: 'documento', rotulo: 'Documento', obrigatorio: false, sinonimos: ['documento', 'doc', 'nf', 'nota fiscal'] },
    { campo: 'centroCusto', rotulo: 'Centro de Custo', obrigatorio: false, sinonimos: ['centro de custo', 'centro custo', 'cc', 'ccusto'] },
  ],
  IA_JSON: [],
};

export function normalizarCabecalho(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[º°ª]/g, '')
    .replace(/[_\-.:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Procura, nas primeiras linhas, a que parece ser o cabeçalho (permite título acima da tabela). */
export function localizarLinhaCabecalho(linhas: unknown[][]): number {
  const todos = new Set(
    [...CAMPOS_POR_FORMATO.SIMPLES, ...CAMPOS_POR_FORMATO.PARTIDA].flatMap((c) => c.sinonimos.filter((s) => s.length > 1)),
  );
  let melhor = 0;
  let melhorPontos = -1;
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const pontos = (linhas[i] ?? []).filter((c) => todos.has(normalizarCabecalho(c))).length;
    if (pontos > melhorPontos) {
      melhor = i;
      melhorPontos = pontos;
    }
  }
  return melhor;
}

export function detectarFormato(cabecalhos: unknown[]): Exclude<FormatoImportacao, 'IA_JSON'> {
  const n = cabecalhos.map(normalizarCabecalho);
  const temDebCred = n.some((h) => CAMPOS_POR_FORMATO.SIMPLES[1].sinonimos.includes(h)) && n.some((h) => CAMPOS_POR_FORMATO.SIMPLES[2].sinonimos.includes(h));
  const temDC = n.some((h) => CAMPOS_POR_FORMATO.PARTIDA[3].sinonimos.includes(h));
  if (temDC && !temDebCred) return 'PARTIDA';
  return 'SIMPLES';
}

/** Sugere qual coluna da planilha corresponde a cada campo (índice da coluna ou -1). */
export function sugerirMapeamento(cabecalhos: unknown[], formato: FormatoImportacao): Mapeamento {
  const n = cabecalhos.map(normalizarCabecalho);
  const usados = new Set<number>();
  const mapa: Mapeamento = {};
  for (const def of CAMPOS_POR_FORMATO[formato]) {
    let idx = -1;
    for (const sin of def.sinonimos) {
      idx = n.findIndex((h, i) => h === sin && !usados.has(i));
      if (idx >= 0) break;
    }
    if (idx < 0) {
      idx = n.findIndex((h, i) => !usados.has(i) && h.length > 2 && def.sinonimos.some((s) => s.length > 3 && h.includes(s)));
    }
    if (idx >= 0) usados.add(idx);
    mapa[def.campo] = idx;
  }
  return mapa;
}

export function camposFaltantes(mapa: Mapeamento, formato: FormatoImportacao): DefinicaoCampo[] {
  return CAMPOS_POR_FORMATO[formato].filter((d) => d.obrigatorio && (mapa[d.campo] === undefined || mapa[d.campo]! < 0));
}
