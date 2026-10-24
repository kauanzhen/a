import * as XLSX from 'xlsx';
import type { CentroCusto, Conta, Lancamento } from '../../db/types';
import { formatarData } from '../../lib/date';
import { centavosParaReais } from '../../lib/money';

export interface AbaLida {
  nome: string;
  linhas: unknown[][];
}

/**
 * Lê .xlsx/.xls/.ods/.csv. Para CSV, os valores ficam como texto (raw) para não
 * confundir datas brasileiras (dd/mm) com o padrão americano.
 */
export function lerPlanilha(conteudo: ArrayBuffer, nomeArquivo: string): AbaLida[] {
  const ehTexto = /\.(csv|txt)$/i.test(nomeArquivo);
  const wb = ehTexto
    ? XLSX.read(new TextDecoder('utf-8').decode(conteudo), { type: 'string', raw: true })
    : XLSX.read(conteudo, { type: 'array', cellDates: false });
  return wb.SheetNames.map((nome) => ({
    nome,
    linhas: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], { header: 1, raw: true, defval: '', blankrows: false }),
  }));
}

function baixar(wb: XLSX.WorkBook, nomeArquivo: string) {
  XLSX.writeFile(wb, nomeArquivo, { compression: true });
}

function aba(linhas: unknown[][], larguras?: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  if (larguras) ws['!cols'] = larguras.map((wch) => ({ wch }));
  return ws;
}

/** Monta a planilha-modelo (xlsx) com abas de exemplo, instruções e o plano de contas da empresa. */
export function montarPlanilhaModelo(contas: Conta[], centros: CentroCusto[]): XLSX.WorkBook {
  const analiticas = contas.filter((c) => c.tipo === 'A' && c.ativa);
  const acha = (nome: RegExp) => analiticas.find((c) => nome.test(c.nome))?.codigo ?? '';
  const caixa = acha(/^Caixa Geral/i);
  const banco = acha(/^Banco Exemplo/i);
  const capital = acha(/^Capital Subscrito/i);
  const aluguel = acha(/^Aluguéis$/i);
  const salarios = acha(/^Salários e Ordenados$/i);
  const salariosPagar = acha(/^Salários e Ordenados a Pagar/i);
  const inss = acha(/^INSS a Recolher/i);
  const cc = centros[0]?.codigo ?? '';

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    aba(
      [
        ['Data', 'Conta Débito', 'Conta Crédito', 'Valor', 'Histórico', 'Documento', 'Centro de Custo'],
        ['02/01/2026', banco, capital, 50000, 'Integralização de capital social em moeda corrente', 'Contrato social', ''],
        ['05/01/2026', caixa, banco, 2000, 'Saque bancário para o caixa', 'Cheque 000001', ''],
        ['10/01/2026', aluguel, banco, 3500, 'Pagamento de aluguel ref. 01/2026', 'Recibo 01/2026', cc],
      ],
      [12, 16, 16, 12, 50, 18, 16],
    ),
    'Lançamentos',
  );
  XLSX.utils.book_append_sheet(
    wb,
    aba(
      [
        ['Lote', 'Data', 'Conta', 'D/C', 'Valor', 'Histórico', 'Documento', 'Centro de Custo'],
        ['1', '31/01/2026', salarios, 'D', 2500, 'Folha de pagamento ref. 01/2026', 'Folha 01/2026', cc],
        ['1', '31/01/2026', salariosPagar, 'C', 2300, 'Folha de pagamento ref. 01/2026', 'Folha 01/2026', ''],
        ['1', '31/01/2026', inss, 'C', 200, 'Folha de pagamento ref. 01/2026', 'Folha 01/2026', ''],
      ],
      [8, 12, 16, 6, 12, 50, 18, 16],
    ),
    'Por partida',
  );
  XLSX.utils.book_append_sheet(
    wb,
    aba(
      [
        ['INSTRUÇÕES — Importação de lançamentos (dados FICTÍCIOS, uso educacional)'],
        [''],
        ['Formato 1 — aba "Lançamentos": uma linha por lançamento simples (1 débito e 1 crédito).'],
        ['  Colunas: Data | Conta Débito | Conta Crédito | Valor | Histórico | Documento | Centro de Custo'],
        ['Formato 2 — aba "Por partida": uma linha por partida; linhas com o mesmo Lote formam um lançamento composto.'],
        ['  Colunas: Lote | Data | Conta | D/C | Valor | Histórico | Documento | Centro de Custo'],
        ['  Em cada lote, a soma dos débitos deve ser IGUAL à soma dos créditos, e todas as linhas devem ter a mesma data.'],
        [''],
        ['Regras gerais'],
        ['  • Data: dd/mm/aaaa (ou célula de data do Excel). O período precisa existir e estar ABERTO.'],
        ['  • Conta: código de classificação com pontos (1.1.1.01.0001), só os dígitos (111010001) ou o código reduzido (ex.: 1).'],
        ['  • Só contas ANALÍTICAS e ativas recebem lançamentos (veja a aba "Plano de contas").'],
        ['  • Valor: número positivo, ex.: 1234,56 ou 1.234,56 (em reais).'],
        ['  • D/C: D (débito) ou C (crédito).'],
        ['  • Centro de custo: código ou nome; obrigatório nas contas marcadas "Exige CC".'],
        ['  • Os nomes das colunas podem ser diferentes: a tela de importação permite mapear as colunas.'],
        ['  • Linhas com erro aparecem destacadas na pré-visualização; você pode importar só os lotes válidos.'],
        ['  • A importação inteira pode ser desfeita depois em "Importação Excel > Histórico".'],
      ],
      [110],
    ),
    'Instruções',
  );
  XLSX.utils.book_append_sheet(
    wb,
    aba(
      [
        ['Código', 'Reduzido', 'Nome', 'Tipo', 'Natureza', 'Grupo', 'Exige CC'],
        ...contas.map((c) => [c.codigo, c.reduzido ?? '', c.nome, c.tipo === 'A' ? 'Analítica' : 'Sintética', c.natureza, c.grupo, c.exigeCentroCusto ? 'S' : 'N']),
      ],
      [16, 9, 55, 10, 9, 10, 9],
    ),
    'Plano de contas',
  );
  XLSX.utils.book_append_sheet(wb, aba([['Código', 'Nome'], ...centros.map((c) => [c.codigo, c.nome])], [10, 30]), 'Centros de custo');
  return wb;
}

export function baixarPlanilhaModelo(contas: Conta[], centros: CentroCusto[]) {
  baixar(montarPlanilhaModelo(contas, centros), 'modelo-importacao-lancamentos.xlsx');
}

/** Exporta lançamentos no formato "uma linha por partida" — pode ser reimportado. */
export function montarPlanilhaLancamentos(lancamentos: Lancamento[], contas: Map<number, Conta>, centros: Map<number, CentroCusto>): XLSX.WorkBook {
  const linhas: unknown[][] = [['Lote', 'Data', 'Conta', 'D/C', 'Valor', 'Histórico', 'Documento', 'Centro de Custo', 'Nome da conta', 'Nº lançamento']];
  for (const l of lancamentos) {
    for (const p of l.partidas) {
      const conta = contas.get(p.contaId);
      linhas.push([
        l.lote || String(l.numero),
        formatarData(l.data),
        conta?.codigo ?? '',
        p.tipo,
        centavosParaReais(p.valor),
        p.historico ?? [l.historico, l.complemento].filter(Boolean).join(' '),
        l.documento ?? '',
        p.centroCustoId ? (centros.get(p.centroCustoId)?.codigo ?? '') : '',
        conta?.nome ?? '',
        l.numero,
      ]);
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aba(linhas, [8, 12, 16, 6, 12, 50, 18, 12, 40, 10]), 'Lançamentos');
  return wb;
}

export function baixarLancamentos(lancamentos: Lancamento[], contas: Map<number, Conta>, centros: Map<number, CentroCusto>, nome = 'lancamentos.xlsx') {
  baixar(montarPlanilhaLancamentos(lancamentos, contas, centros), nome);
}

export function baixarPlanoContas(contas: Conta[], nome = 'plano-de-contas.xlsx') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    aba(
      [
        ['Código', 'Nome', 'Tipo', 'Natureza', 'Grupo', 'Conta Referencial', 'Exige CC', 'Reduzido', 'Ativa'],
        ...contas.map((c) => [c.codigo, c.nome, c.tipo, c.natureza, c.grupo, c.contaReferencial ?? '', c.exigeCentroCusto ? 'S' : 'N', c.reduzido ?? '', c.ativa ? 'S' : 'N']),
      ],
      [16, 55, 6, 9, 10, 16, 9, 9, 6],
    ),
    'Plano de contas',
  );
  baixar(wb, nome);
}
