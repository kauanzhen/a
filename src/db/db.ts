import Dexie, { type EntityTable } from 'dexie';
import type {
  CentroCusto,
  ConfigItem,
  Conta,
  Empresa,
  Exercicio,
  HistoricoPadrao,
  Importacao,
  Lancamento,
  ModeloLancamento,
  Periodo,
  RegistroAuditoria,
  TabelaFiscal,
} from './types';

export const NOME_BANCO = 'contabil-escola';
export const VERSAO_ESQUEMA = 1;

export class ContabilDB extends Dexie {
  empresas!: EntityTable<Empresa, 'id'>;
  exercicios!: EntityTable<Exercicio, 'id'>;
  periodos!: EntityTable<Periodo, 'id'>;
  contas!: EntityTable<Conta, 'id'>;
  centrosCusto!: EntityTable<CentroCusto, 'id'>;
  historicos!: EntityTable<HistoricoPadrao, 'id'>;
  lancamentos!: EntityTable<Lancamento, 'id'>;
  modelos!: EntityTable<ModeloLancamento, 'id'>;
  importacoes!: EntityTable<Importacao, 'id'>;
  auditoria!: EntityTable<RegistroAuditoria, 'id'>;
  tabelasFiscais!: EntityTable<TabelaFiscal, 'id'>;
  config!: EntityTable<ConfigItem, 'chave'>;

  constructor(nome = NOME_BANCO) {
    super(nome);
    this.version(VERSAO_ESQUEMA).stores({
      empresas: '++id, cnpj',
      exercicios: '++id, empresaId, [empresaId+inicio]',
      periodos: '++id, empresaId, exercicioId, [empresaId+competencia]',
      contas: '++id, empresaId, [empresaId+codigo], [empresaId+reduzido]',
      centrosCusto: '++id, empresaId, [empresaId+codigo]',
      historicos: '++id, empresaId, [empresaId+codigo]',
      lancamentos: '++id, empresaId, [empresaId+data], [empresaId+numero], *contaIds, importacaoId, estornoDeId',
      modelos: '++id, empresaId',
      importacoes: '++id, empresaId',
      auditoria: '++id, empresaId, data, entidade',
      tabelasFiscais: '++id, tipo, vigenciaInicio',
      config: 'chave',
    });
  }
}

export const db = new ContabilDB();

/** Nome de todas as tabelas (usado pelo backup/restauração). */
export function nomesTabelas(): string[] {
  return db.tables.map((t) => t.name);
}
