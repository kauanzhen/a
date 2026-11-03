// Ajuda para os testes: monta a abertura padrão com a biblioteca inicial.
import { bibliotecaInicial } from '../biblioteca/inicial';
import { montarDocumento, type DocumentoMontado } from '../motor/montagem';
import { DOC_ABERTURA, LTDA } from '../tipos/ltda';
import { opcoesAtoPadrao } from '../dados/fabricas';
import type { DadosEmpresa, ItemSelecao } from '../dados/tipos';

export const BIBLIOTECA_TESTE = bibliotecaInicial('2026-11-03T00:00:00.000Z');
export const buscarNaBiblioteca = (id: string) => BIBLIOTECA_TESTE.find((c) => c.id === id);

export function selecaoPadraoAbertura(): Record<string, ItemSelecao[]> {
  const selecao: Record<string, ItemSelecao[]> = {};
  for (const [area, ids] of Object.entries(DOC_ABERTURA.padrao)) {
    selecao[area] = ids.map((id) => ({ clausula_id: id, versao: 1, ativa: true }));
  }
  return selecao;
}

export function gerarAbertura(dados: DadosEmpresa): DocumentoMontado {
  return montarDocumento({
    definicao: DOC_ABERTURA,
    selecao: selecaoPadraoAbertura(),
    contexto: { dados, tipo: LTDA, opcoes: { ...opcoesAtoPadrao('Barueri', 'SP'), data_ato: '2026-11-03' } },
    buscarClausula: buscarNaBiblioteca,
  });
}
