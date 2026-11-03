// Documento de exemplo para a tela de configurações (usa a biblioteca inicial,
// para mostrar como fica a página sem depender dos dados do usuário).

import { bibliotecaInicial } from '../biblioteca/inicial';
import { montarDocumento, type DocumentoMontado } from '../motor/montagem';
import { DOC_ABERTURA, LTDA } from '../tipos/ltda';
import { exemplo } from '../dados/exemplos';
import { opcoesAtoPadrao } from '../dados/fabricas';
import { selecaoPadrao } from '../servicos/atos';

let cache: DocumentoMontado | null = null;

export function gerarAbertura(): DocumentoMontado {
  if (cache) return cache;
  const bib = bibliotecaInicial();
  const buscar = (id: string) => bib.find((c) => c.id === id);
  cache = montarDocumento({
    definicao: DOC_ABERTURA,
    selecao: selecaoPadrao(DOC_ABERTURA, buscar, 'pluripessoal'),
    contexto: { dados: exemplo('dois-socios'), tipo: LTDA, opcoes: opcoesAtoPadrao('Barueri', 'SP') },
    buscarClausula: buscar,
  });
  return cache;
}
