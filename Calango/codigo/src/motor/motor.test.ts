import { describe, expect, it } from 'vitest';
import { exemplo } from '../dados/exemplos';
import { opcoesAtoPadrao } from '../dados/fabricas';
import { LTDA } from '../tipos/ltda';
import { avaliarCorpo, textoDosTrechos, type SaidaBloco } from './avaliador';
import type { ContextoAvaliacao } from './catalogo';
import { regrasPadrao, type Clausula, type ConteudoClausula } from './clausula';
import { camposDoCorpo } from './campos';
import { analisarExpressao, avaliarExpressao } from './expressao';
import { montarDocumento, textoDoDocumento } from './montagem';
import { analisarCorpo } from './sintaxe';

const QUALIF: ConteudoClausula = {
  titulo_interno: 'Qualificação',
  titulo_secao: '',
  tipo_bloco: 'texto',
  tags: [],
  documentos: [],
  tipo_societario: ['ltda'],
  natureza: 'fixa',
  regras: regrasPadrao(),
  corpo: '{{pessoa.nome}}, {{pessoa.nacionalidade}}, {inscrito|inscrita : pessoa} no CPF nº {{pessoa.cpf}}',
  observacoes: '',
};

function ctx(id: string): ContextoAvaliacao {
  return {
    dados: exemplo(id),
    tipo: LTDA,
    opcoes: { ...opcoesAtoPadrao('Barueri', 'SP'), data_ato: '2026-11-03' },
    buscarClausula: (bid) => (bid === 'qualificacao-pessoa-fisica' ? QUALIF : undefined),
    profundidade: 0,
  };
}

const linhas = (s: SaidaBloco[]) =>
  s.map((x) => (x.tipo === 'linha' ? `${x.marcador}${x.marcador ? ' ' : ''}${textoDosTrechos(x.trechos)}` : x.tipo));

describe('sintaxe', () => {
  it('aponta [fim] faltando e sobrando', () => {
    expect(analisarCorpo('[se unipessoal]\ntexto').erros[0].mensagem).toMatch(/sem o \[fim\]/);
    expect(analisarCorpo('texto\n[fim]').erros[0].mensagem).toMatch(/\[fim\] sem/);
    expect(analisarCorpo('a [se unipessoal]b').erros[0].mensagem).toMatch(/sem o \[fim\]/);
  });
  it('colchetes que não são comandos ficam como texto', () => {
    const r = avaliarCorpo('art. 3º [inciso I] da lei', ctx('um-socio'));
    expect(linhas(r.saida)).toEqual(['art. 3º [inciso I] da lei']);
  });
  it('expressões', () => {
    const x = analisarExpressao('pluripessoal e não enquadramento = EPP');
    expect(avaliarExpressao(x, (n) => (n === 'pluripessoal' ? true : 'ME'))).toBe(true);
    expect(() => analisarExpressao('a b')).toThrow(/Sobrou texto/);
  });
});

describe('concordância e condições', () => {
  const corpo = '{O sócio declara|A sócia declara|Os sócios declaram|As sócias declaram : socios} [se unipessoal]sozinho[senão]juntos[fim].';
  it('um homem', () => {
    expect(linhas(avaliarCorpo(corpo, ctx('um-socio')).saida)).toEqual(['O sócio declara sozinho.']);
  });
  it('uma mulher', () => {
    expect(linhas(avaliarCorpo(corpo, ctx('uma-socia')).saida)).toEqual(['A sócia declara sozinho.']);
  });
  it('grupo misto -> masculino plural', () => {
    expect(linhas(avaliarCorpo(corpo, ctx('dois-socios')).saida)).toEqual(['Os sócios declaram juntos.']);
  });
  it('só mulheres -> feminino plural', () => {
    expect(linhas(avaliarCorpo(corpo, ctx('duas-socias')).saida)).toEqual(['As sócias declaram juntos.']);
  });
  it('vocabulário do tipo societário', () => {
    expect(linhas(avaliarCorpo('{vocab.membro : socios} e {{vocab.ato_constitutivo}}', ctx('duas-socias')).saida)).toEqual([
      'sócias e contrato social',
    ]);
  });
  it('condição em bloco com senão se', () => {
    const c = '[se enquadramento = EPP]\nEPP\n[senão se enquadramento = ME]\nME\n[senão]\nnada\n[fim]';
    expect(linhas(avaliarCorpo(c, ctx('um-socio')).saida)).toEqual(['ME']);
  });
});

describe('repetições', () => {
  it('em bloco, com separador, último e final', () => {
    const c = '[para cada socio em socios separador=";" ultimo=" e" final="."]\n{{socio.nome}}\n[fim]';
    const r = avaliarCorpo(c, ctx('tres-socios-adm-externo'));
    expect(linhas(r.saida)).toEqual(['JOÃO DA SILVA PEREIRA;', 'MARIA APARECIDA SOUZA e', 'ANA BEATRIZ LIMA.']);
  });
  it('na mesma linha', () => {
    const c = 'CNAEs: [para cada cnae em cnaes separador=", " ultimo=" e "]{{cnae.codigo}}[fim].';
    expect(linhas(avaliarCorpo(c, ctx('um-socio')).saida)).toEqual(['CNAEs: 47.61-0-03 e 82.19-9-01.']);
  });
  it('nomes em negrito', () => {
    const r = avaliarCorpo('Sócios: {{socios.nomes}}.', ctx('dois-socios'));
    const l = r.saida[0];
    expect(l.tipo === 'linha' && l.trechos.filter((t) => t.negrito).map((t) => t.texto)).toEqual([
      'JOÃO DA SILVA PEREIRA',
      'MARIA APARECIDA SOUZA',
    ]);
  });
  it('qualificação vem do bloco da biblioteca, com concordância', () => {
    const r = avaliarCorpo('[para cada socio em socios]\n{{socio.qualificacao}}\n[fim]', ctx('dois-socios'));
    expect(linhas(r.saida)).toEqual([
      'JOÃO DA SILVA PEREIRA, brasileiro, inscrito no CPF nº 529.982.247-25',
      'MARIA APARECIDA SOUZA, brasileira, inscrita no CPF nº 111.444.777-35',
    ]);
  });
  it('variável de item fora de repetição é erro', () => {
    const r = avaliarCorpo('{{socio.nome}}', ctx('um-socio'));
    expect(r.erros[0].mensagem).toMatch(/só pode ser usada dentro de uma repetição/);
  });
});

describe('tabelas', () => {
  it('quadro societário com coluna por classe', () => {
    const c = [
      '[tabela]',
      'Sócio | [para cada classe em classes] {{classe.nome}} | Valor',
      '[para cada socio em socios]',
      '{{socio.nome_simples}} | [para cada classe em classes] {{socio.quotas_na_classe}} | {{socio.valor}}',
      '[fim]',
      '**TOTAL** | [para cada classe em classes] {{classe.quotas}} | {{capital.valor}}',
      '[fim]',
    ].join('\n');
    const r = avaliarCorpo(c, ctx('classes'));
    const t = r.saida[0];
    expect(t.tipo).toBe('tabela');
    if (t.tipo !== 'tabela') return;
    const txt = t.linhas.map((l) => l.map(textoDosTrechos));
    expect(txt).toEqual([
      ['Sócio', 'Classe A', 'Classe B', 'Valor'],
      ['JOÃO DA SILVA PEREIRA', '6.000', '0', 'R$ 6.000,00'],
      ['MARIA APARECIDA SOUZA', '1.500', '3.000', 'R$ 4.500,00'],
      ['TOTAL', '7.500', '3.000', 'R$ 10.500,00'],
    ]);
  });
});

describe('lacunas', () => {
  it('dado faltando vira pendência e marcação no texto', () => {
    const c = ctx('um-socio');
    c.dados.razao_social = '';
    const r = avaliarCorpo('Nome: {{empresa.razao_social}}.', c);
    expect(r.pendencias[0].mensagem).toBe('Falta preencher: Razão social.');
    expect(linhas(r.saida)).toEqual(['Nome: [Razão social].']);
  });
});

describe('campos exigidos (derivados do texto)', () => {
  it('inclui campos de pessoa usados no bloco de qualificação', () => {
    const r = camposDoCorpo('[para cada socio em socios]\n{{socio.qualificacao}}\n[fim]', LTDA, (id) =>
      id === 'qualificacao-pessoa-fisica' ? QUALIF : undefined,
    );
    expect(r.erros).toEqual([]);
    expect(r.campos).toEqual(expect.arrayContaining(['socios', 'pessoa.nome', 'pessoa.nacionalidade', 'pessoa.cpf', 'pessoa.genero']));
    expect(r.campos).not.toContain('pessoa.rg');
  });
  it('acusa variável desconhecida', () => {
    const r = camposDoCorpo('{{empresa.nada}}', LTDA, () => undefined);
    expect(r.erros[0].mensagem).toMatch(/desconhecida/);
  });
});

describe('montagem com numeração automática', () => {
  const mk = (id: string, tipo_bloco: Clausula['tipo_bloco'], corpo: string, extra: Partial<Clausula> = {}): Clausula => ({
    formato: 'calango/clausula',
    versao_formato: 1,
    id,
    titulo_interno: id,
    titulo_secao: '',
    tipo_bloco,
    tags: [],
    documentos: ['abertura'],
    tipo_societario: ['ltda'],
    natureza: 'normal',
    regras: regrasPadrao(),
    corpo,
    observacoes: '',
    campos_exigidos: [],
    versao: 1,
    historico: [],
    arquivada: false,
    origem: 'usuario',
    criada_em: '',
    atualizada_em: '',
    ...extra,
  });
  const biblioteca = [
    mk('a', 'clausula', 'Primeira cláusula.\n- alínea um;\n- alínea dois.', { titulo_secao: 'DA SEÇÃO' }),
    mk('so-uni', 'clausula', 'Só para unipessoal.', { regras: { ...regrasPadrao(), condicao_de_exibicao: 'unipessoal' } }),
    mk('b', 'clausula', 'Segunda cláusula.\n§ Parágrafo interno.'),
    mk('pb', 'paragrafo', 'Parágrafo avulso.'),
    mk('c', 'clausula', 'Terceira.'),
    mk('pc', 'paragrafo', 'Único parágrafo da terceira.'),
  ];
  const buscar = (id: string) => biblioteca.find((c) => c.id === id);
  const sel = (ids: string[]) => ids.map((id) => ({ clausula_id: id, versao: 1, ativa: true }));
  const definicao = {
    id: 't',
    nome: 'Teste',
    nome_arquivo: 'Teste',
    descricao: '',
    disponivel: true,
    empresa: 'nova' as const,
    areas: [{ id: 'corpo', nome: 'Corpo', numerada: true, estilo: 'texto' as const, editavel: true }],
    padrao: {},
  };

  it('pula a cláusula condicional sem deixar buraco na numeração', () => {
    const c = ctx('dois-socios');
    const doc = montarDocumento({
      definicao,
      selecao: { corpo: sel(['a', 'so-uni', 'b', 'pb', 'c', 'pc']) },
      contexto: { dados: c.dados, tipo: c.tipo, opcoes: c.opcoes },
      buscarClausula: buscar,
    });
    expect(textoDoDocumento(doc).split('\n')).toEqual([
      'DA SEÇÃO',
      'CLÁUSULA PRIMEIRA: Primeira cláusula.',
      'a) alínea um;',
      'b) alínea dois.',
      'CLÁUSULA SEGUNDA: Segunda cláusula.',
      'Parágrafo Primeiro: Parágrafo interno.',
      'Parágrafo Segundo: Parágrafo avulso.',
      'CLÁUSULA TERCEIRA: Terceira.',
      'Parágrafo Único: Único parágrafo da terceira.',
    ]);
    expect(doc.pendencias).toEqual([]);
  });
});
