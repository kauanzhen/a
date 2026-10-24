import type { Centavos } from '../lib/money';
import type { DataISO } from '../lib/date';

export type Regime = 'SIMPLES' | 'PRESUMIDO' | 'REAL';

export const NOMES_REGIME: Record<Regime, string> = {
  SIMPLES: 'Simples Nacional',
  PRESUMIDO: 'Lucro Presumido',
  REAL: 'Lucro Real',
};

export interface Endereco {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
}

export interface Empresa {
  id?: number;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  cnae: string;
  descricaoCnae?: string;
  endereco: Endereco;
  regime: Regime;
  mascaraPlano: string;
  /** dia/mês de início do exercício social (padrão 01/01) */
  inicioExercicioMes: number;
  criadaEm: string;
}

export type StatusExercicio = 'ABERTO' | 'ENCERRADO';

export interface Exercicio {
  id?: number;
  empresaId: number;
  descricao: string;
  inicio: DataISO;
  fim: DataISO;
  status: StatusExercicio;
}

export type StatusPeriodo = 'ABERTO' | 'FECHADO';

export interface Periodo {
  id?: number;
  empresaId: number;
  exercicioId: number;
  /** "AAAA-MM" */
  competencia: string;
  inicio: DataISO;
  fim: DataISO;
  status: StatusPeriodo;
  fechadoEm?: string;
  fechadoPor?: string;
}

export type GrupoConta = 'ATIVO' | 'PASSIVO' | 'PL' | 'RECEITA' | 'CUSTO' | 'DESPESA';

export const NOMES_GRUPO: Record<GrupoConta, string> = {
  ATIVO: 'Ativo',
  PASSIVO: 'Passivo',
  PL: 'Patrimônio Líquido',
  RECEITA: 'Receita',
  CUSTO: 'Custo',
  DESPESA: 'Despesa',
};

export type Natureza = 'D' | 'C';
export type TipoConta = 'S' | 'A';

export interface Conta {
  id?: number;
  empresaId: number;
  /** Código de classificação formatado pela máscara, ex.: "1.1.1.01.0001" */
  codigo: string;
  /** Código reduzido (só contas analíticas), facilita a digitação */
  reduzido?: number;
  nome: string;
  tipo: TipoConta;
  natureza: Natureza;
  nivel: number;
  grupo: GrupoConta;
  contaReferencial?: string;
  exigeCentroCusto: boolean;
  ativa: boolean;
}

export interface CentroCusto {
  id?: number;
  empresaId: number;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export interface HistoricoPadrao {
  id?: number;
  empresaId: number;
  codigo: number;
  texto: string;
  ativo: boolean;
}

export interface Partida {
  contaId: number;
  tipo: Natureza;
  valor: Centavos;
  centroCustoId?: number;
  /** histórico próprio da partida (opcional; senão vale o do lançamento) */
  historico?: string;
}

export type OrigemLancamento = 'MANUAL' | 'IMPORTACAO' | 'IA' | 'ESTORNO' | 'MODELO' | 'COPIA' | 'SISTEMA';

export const NOMES_ORIGEM: Record<OrigemLancamento, string> = {
  MANUAL: 'Manual',
  IMPORTACAO: 'Importação Excel',
  IA: 'Assistente IA',
  ESTORNO: 'Estorno',
  MODELO: 'Lançamento-modelo',
  COPIA: 'Cópia',
  SISTEMA: 'Sistema',
};

export interface Lancamento {
  id?: number;
  empresaId: number;
  /** número sequencial por empresa */
  numero: number;
  lote: string;
  data: DataISO;
  competencia: string;
  documento?: string;
  historicoPadraoId?: number;
  historico: string;
  complemento?: string;
  /** observação interna (ex.: de onde o assistente de IA tirou o lançamento) */
  observacao?: string;
  partidas: Partida[];
  /** índice auxiliar (multiEntry) com as contas movimentadas */
  contaIds: number[];
  valorTotal: Centavos;
  origem: OrigemLancamento;
  importacaoId?: number;
  modeloId?: number;
  estornoDeId?: number;
  estornadoPorId?: number;
  criadoEm: string;
  criadoPor: string;
  alteradoEm?: string;
  alteradoPor?: string;
}

export interface ModeloLancamento {
  id?: number;
  empresaId: number;
  nome: string;
  historicoPadraoId?: number;
  historico: string;
  complemento?: string;
  documento?: string;
  /** valores podem ser 0 para preencher na hora */
  partidas: Partida[];
  recorrente: boolean;
  diaPadrao: number;
  ativo: boolean;
}

/** SIMPLES = uma linha por lançamento (débito/crédito); PARTIDA = uma linha por partida; IA_JSON = lote gerado pelo assistente de IA */
export type FormatoImportacao = 'SIMPLES' | 'PARTIDA' | 'IA_JSON';

export const NOMES_FORMATO: Record<FormatoImportacao, string> = {
  SIMPLES: 'Excel — uma linha por lançamento',
  PARTIDA: 'Excel — uma linha por partida',
  IA_JSON: 'Lote do assistente de IA (JSON)',
};

export interface Importacao {
  id?: number;
  empresaId: number;
  arquivo: string;
  formato: FormatoImportacao;
  data: string;
  usuario: string;
  qtdLinhasLidas: number;
  qtdLinhasImportadas: number;
  qtdLinhasRejeitadas: number;
  lancamentoIds: number[];
  valorTotal: Centavos;
  desfeita: boolean;
  desfeitaEm?: string;
  desfeitaPor?: string;
}

export type AcaoAuditoria =
  | 'CRIAR'
  | 'ALTERAR'
  | 'EXCLUIR'
  | 'INATIVAR'
  | 'ATIVAR'
  | 'FECHAR'
  | 'REABRIR'
  | 'ESTORNAR'
  | 'IMPORTAR'
  | 'DESFAZER'
  | 'RESTAURAR';

export interface DiferencaCampo {
  campo: string;
  de: unknown;
  para: unknown;
}

export interface RegistroAuditoria {
  id?: number;
  empresaId?: number;
  data: string;
  usuario: string;
  entidade: string;
  entidadeId?: number;
  acao: AcaoAuditoria;
  descricao: string;
  diferencas?: DiferencaCampo[];
  antes?: unknown;
  depois?: unknown;
}

// ----------------------------------------------------------------- Tabelas fiscais

export type TipoTabelaFiscal = 'INSS' | 'IRRF' | 'SALARIO_MINIMO' | 'ALIQUOTAS';

export const NOMES_TIPO_TABELA: Record<TipoTabelaFiscal, string> = {
  INSS: 'INSS do empregado (progressiva)',
  IRRF: 'IRRF mensal',
  SALARIO_MINIMO: 'Salário mínimo',
  ALIQUOTAS: 'Alíquotas e parâmetros',
};

export interface FaixaINSS {
  /** limite superior da faixa, em centavos */
  ate: Centavos;
  aliquota: number;
}

export interface DadosINSS {
  faixas: FaixaINSS[];
}

export interface FaixaIRRF {
  /** limite superior da faixa (null = acima da última) */
  ate: Centavos | null;
  aliquota: number;
  deducao: Centavos;
}

export interface RedutorIRRF {
  ativo: boolean;
  /** até este rendimento tributável a redução zera o imposto (limitada a valorMaximo) */
  limiteIsencao: Centavos;
  valorMaximo: Centavos;
  /** acima de limiteIsencao e até limiteFaixa: redução = constante - fator x rendimento */
  limiteFaixa: Centavos;
  constante: Centavos;
  fator: number;
  observacao?: string;
}

export interface DadosIRRF {
  faixas: FaixaIRRF[];
  deducaoDependente: Centavos;
  descontoSimplificado: Centavos;
  redutor?: RedutorIRRF;
}

export interface DadosSalarioMinimo {
  valor: Centavos;
}

export interface ItemAliquota {
  chave: string;
  descricao: string;
  valor: number;
  unidade: '%' | 'R$' | 'fator' | 'dias' | 'horas';
}

export interface DadosAliquotas {
  itens: ItemAliquota[];
}

export type DadosTabela = DadosINSS | DadosIRRF | DadosSalarioMinimo | DadosAliquotas;

export interface TabelaFiscal {
  id?: number;
  tipo: TipoTabelaFiscal;
  /** identifica conjuntos de alíquotas diferentes (ex.: "FOLHA", "PRESUMIDO") */
  conjunto: string;
  descricao: string;
  vigenciaInicio: DataISO;
  fonte?: string;
  verificarVigencia: boolean;
  dados: DadosTabela;
  alteradaEm?: string;
}

export interface ConfigItem {
  chave: string;
  valor: unknown;
}
