import { describe, expect, it } from 'vitest';
import { camposDaClausula } from '../motor/campos';
import { textoDoDocumento } from '../motor/montagem';
import { BIBLIOTECA_TESTE, buscarNaBiblioteca, gerarAbertura } from '../test/abertura';
import { DOC_ABERTURA, LTDA } from '../tipos/ltda';
import { exemplo } from '../dados/exemplos';
import { ordinalClausula } from '../gramatica/ordinais';

const biblioteca = BIBLIOTECA_TESTE;
const buscar = buscarNaBiblioteca;

/** Formas proibidas no documento final (seção 7.1 e 13 da especificação). */
const PROIBIDOS = [
  /\(a\)/i,
  /\(as\)/i,
  /\(o\)/i,
  /\(os\)/i,
  /\(ra\)/i,
  /\(s\)/i,
  /R\$\s*R\$/,
  /CPF º/,
  /titular/i,
  /XXX/,
  /Barueri\/SP, CEP: X/,
];

function conferirTexto(texto: string) {
  for (const re of PROIBIDOS) expect(texto, `não deveria conter ${re}`).not.toMatch(re);
}

function conferirNumeracao(texto: string) {
  const achados = [...texto.matchAll(/CLÁUSULA ([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+):/g)].map((m) => m[1]);
  expect(achados.length).toBeGreaterThan(5);
  achados.forEach((o, i) => expect(o).toBe(ordinalClausula(i + 1)));
}

describe('biblioteca inicial', () => {
  it('todas as cláusulas têm texto válido e campos derivados sem erro', () => {
    for (const c of biblioteca) {
      const r = camposDaClausula(c, LTDA, buscar);
      expect(r.erros, c.id).toEqual([]);
    }
  });
  it('os ids do documento de abertura existem na biblioteca', () => {
    for (const ids of Object.values(DOC_ABERTURA.padrao)) for (const id of ids) expect(buscar(id), id).toBeTruthy();
  });
});

describe('CRITÉRIO DE ACEITE — abertura LTDA com 2 sócios (homem e mulher)', () => {
  const doc = gerarAbertura(exemplo('dois-socios'));
  const texto = textoDoDocumento(doc);

  it('sem pendências', () => expect(doc.pendencias).toEqual([]));
  it('sem "(a)" nem erros típicos dos modelos', () => conferirTexto(texto));
  it('numeração correta e sem buracos', () => conferirNumeracao(texto));
  it('nada de texto de unipessoal', () => {
    expect(texto).not.toMatch(/sócio único|sócia única|unipessoal/i);
  });
  it('concordância no plural masculino (grupo misto)', () => {
    expect(texto).toContain('Resolvem, em comum acordo, constituir uma sociedade limitada');
    expect(texto).toContain('Os sócios declaram que a sociedade se enquadra como Microempresa – ME');
    expect(texto).toContain('A responsabilidade dos sócios é restrita ao valor de suas quotas');
    expect(texto).toContain('E por estarem assim justos e contratados, assinam o presente instrumento');
    expect(texto).toContain('Junta Comercial do Estado de São Paulo');
  });
  it('qualificação com gênero de cada pessoa', () => {
    expect(texto).toContain(
      'Sr. JOÃO DA SILVA PEREIRA, brasileiro, maior, natural de São Paulo/SP, nascido em 15/02/1980, casado sob o regime de comunhão parcial de bens, empresário, portador da cédula de identidade RG nº 12.345.678-9 SSP/SP, inscrito no CPF nº 529.982.247-25, residente e domiciliado na Rua das Palmeiras, nº 120, apto 32, bairro Centro, Barueri/SP, CEP 06401-000 e',
    );
    expect(texto).toContain(
      'Sra. MARIA APARECIDA SOUZA, brasileira, maior, natural de Osasco/SP, nascida em 01/07/1985, solteira, administradora - CRA-SP 123456, portadora da cédula de identidade RG nº 23.456.789-0 SSP/SP, inscrita no CPF nº 111.444.777-35, residente e domiciliada na Avenida Brasil, nº 2000, bairro Jardim América, Osasco/SP, CEP 06010-000.',
    );
  });
  it('valores por extenso corretos', () => {
    expect(texto).toContain(
      'O capital social é de R$ 10.500,00 (dez mil e quinhentos reais), dividido em 10.500 (dez mil e quinhentas) quotas no valor de R$ 1,00 (um real) cada uma',
    );
    expect(texto).toContain('JOÃO DA SILVA PEREIRA | 50% | 5.250 | R$ 5.250,00');
    expect(texto).toContain('TOTAL | 100% | 10.500 | R$ 10.500,00');
    expect(texto).toContain('Barueri/SP, 3 de novembro de 2026.');
  });
  it('administração com dois administradores', () => {
    expect(texto).toContain(
      'A administração da sociedade caberá aos sócios JOÃO DA SILVA PEREIRA e MARIA APARECIDA SOUZA, que a exercerão isoladamente, com os poderes e atribuições de:',
    );
    expect(texto).toContain('Os administradores JOÃO DA SILVA PEREIRA e MARIA APARECIDA SOUZA declaram, sob as penas da lei, não estarem incursos');
  });
  it('parágrafos rotulados (Primeiro, Segundo, Terceiro e Único)', () => {
    expect(texto).toContain('Parágrafo Primeiro: A responsabilidade');
    expect(texto).toContain('Parágrafo Terceiro: O capital social poderá ser aumentado');
    expect(texto).toContain('Parágrafo Único: Fica a sociedade empresária limitada autorizada');
  });
});

describe('CRITÉRIO DE ACEITE — abertura LTDA unipessoal com sócia mulher', () => {
  const doc = gerarAbertura(exemplo('uma-socia'));
  const texto = textoDoDocumento(doc);

  it('sem pendências', () => expect(doc.pendencias).toEqual([]));
  it('sem "(a)" nem erros típicos dos modelos', () => conferirTexto(texto));
  it('numeração correta e sem buracos', () => conferirNumeracao(texto));
  it('concordância no feminino singular e texto de unipessoal', () => {
    expect(texto).toContain('CONTRATO SOCIAL DE SOCIEDADE LIMITADA UNIPESSOAL');
    expect(texto).toContain('Resolve constituir uma sociedade limitada unipessoal');
    expect(texto).toContain('A sócia declara que a sociedade se enquadra');
    expect(texto).toContain('A responsabilidade da sócia é restrita');
    expect(texto).toContain('A administração da sociedade caberá à sócia MARIA APARECIDA SOUZA, com os poderes');
    expect(texto).toContain('A administradora MARIA APARECIDA SOUZA declara, sob as penas da lei, não estar incursa');
    expect(texto).toContain('cabendo à sócia única os lucros ou perdas apurados');
    expect(texto).toContain('assinada pela sócia única.');
    expect(texto).toContain('Falecendo ou interditada a sócia única, a empresa continuará');
    expect(texto).toContain('E por estar assim justa e contratada, assina o presente instrumento');
    expect(texto).not.toMatch(/\bsócios\b|\bResolvem\b/);
  });
  it('quadro societário com 100%', () => {
    expect(texto).toContain('MARIA APARECIDA SOUZA | 100% | 10.500 | R$ 10.500,00');
  });
});

describe('outras situações', () => {
  it('três sócios com administrador não sócio', () => {
    const doc = gerarAbertura(exemplo('tres-socios-adm-externo'));
    const texto = textoDoDocumento(doc);
    expect(doc.pendencias).toEqual([]);
    conferirTexto(texto);
    conferirNumeracao(texto);
    expect(texto).toContain('caberá aos administradores CARLOS EDUARDO MENDES e JOÃO DA SILVA PEREIRA, que a exercerão em conjunto');
    expect(texto).toMatch(/CARLOS EDUARDO MENDES, brasileiro, .* fica designado administrador não sócio da sociedade\./);
    expect(texto).toContain('Administrador não sócio');
  });
  it('classes distintas: descrição das classes e coluna por classe', () => {
    const doc = gerarAbertura(exemplo('classes'));
    const texto = textoDoDocumento(doc);
    expect(doc.pendencias).toEqual([]);
    conferirTexto(texto);
    expect(texto).toContain('dividido em 10.500 (dez mil e quinhentas) quotas, totalmente subscritas');
    expect(texto).toContain('a) Classe A: 7.500 (sete mil e quinhentas) quotas, no valor unitário de R$ 1,00 (um real), com direito a voto pleno;');
    expect(texto).toContain(
      'b) Classe B: 3.000 (três mil) quotas, no valor unitário de R$ 1,00 (um real), sem direito a voto, com preferência na distribuição de lucros (prioritária: prioridade no recebimento de dividendos), com prioridade no reembolso do capital em caso de liquidação da sociedade.',
    );
    expect(texto).toContain('SÓCIO | QUOTAS Classe A | QUOTAS Classe B | TOTAL DE QUOTAS | PERCENTUAL | VALOR (R$)');
    expect(texto).toContain('MARIA APARECIDA SOUZA | 1.500 | 3.000 | 4.500 | 42,86% | R$ 4.500,00');
  });
  it('dados faltando viram pendências em vez de texto errado', () => {
    const d = exemplo('dois-socios');
    d.pessoas[0].cpf = '';
    d.foro = { cidade: '', uf: '' };
    const doc = gerarAbertura(d);
    const msgs = doc.pendencias.map((p) => p.mensagem);
    expect(msgs).toContain('Falta preencher: CPF (JOÃO DA SILVA PEREIRA).');
    expect(msgs).toContain('Falta preencher: Foro (Cidade/UF).');
  });
});
