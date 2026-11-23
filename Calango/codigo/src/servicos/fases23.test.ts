import { describe, expect, it } from 'vitest';
import { buscarNaBiblioteca as buscar } from '../test/abertura';
import { DOC_ABERTURA, DOC_ALTERACAO, DOC_DISTRATO, DOC_TRANSF_EI_LTDA, DOC_TRANSF_LTDA_EI, LTDA } from '../tipos/ltda';
import { EI } from '../tipos/ei';
import {
  aplicarMovimentosNoAto,
  comAto,
  documentosPossiveis,
  iniciarAbertura,
  iniciarAtoExistente,
  marcarGerado,
  marcarRegistrado,
  revisarAto,
  tipoParaAto,
} from './atos';
import { configuracoesPadrao } from '../armazenamento/configuracoes';
import { exemplo } from '../dados/exemplos';
import { novaEmpresa, novaPessoa } from '../dados/fabricas';
import { CLASSE_UNICA, type Ato, type DadosEmpresa, type Empresa } from '../dados/tipos';
import { textoDoDocumento } from '../motor/montagem';
import { ordinalClausula } from '../gramatica/ordinais';
import type { DefinicaoDocumento } from '../tipos/definicoes';

const cfg = configuracoesPadrao();
cfg.padroes = { cidade: 'Barueri', uf: 'SP' };

function local(ato: Ato): Ato {
  return { ...ato, opcoes: { ...ato.opcoes, local_cidade: 'Barueri', local_uf: 'SP', data_ato: '2026-11-23' } };
}

/** Abre e registra uma empresa a partir de um exemplo (simula a Fase 1). */
function empresaRegistrada(dados: DadosEmpresa): Empresa {
  const { empresa, ato } = iniciarAbertura(DOC_ABERTURA, LTDA, buscar, cfg);
  const a = local({ ...ato, dados_depois: dados });
  const r = revisarAto(a, DOC_ABERTURA, LTDA, buscar);
  expect(r.pendencias.filter((p) => p.nivel === 'erro')).toEqual([]);
  const gerado = marcarGerado(a, r.documento, 'abertura.docx');
  return marcarRegistrado(comAto(empresa, gerado), a.id, { data: '2026-11-20', numero: '3521234', nire: '35200000001', cnpj: '11.222.333/0001-81' });
}

function revisar(e: Empresa, ato: Ato, def: DefinicaoDocumento) {
  return revisarAto(ato, def, tipoParaAto(e, ato), buscar);
}

function registrar(e: Empresa, ato: Ato, def: DefinicaoDocumento): Empresa {
  const r = revisar(e, ato, def);
  expect(r.pendencias.filter((p) => p.nivel === 'erro')).toEqual([]);
  return marcarRegistrado(comAto(e, marcarGerado(ato, r.documento, 'x.docx')), ato.id, { data: '2026-12-10', numero: '99', nire: '', cnpj: '' });
}

const PROIBIDOS = [/\((a|as|o|os|ra)\)/i, /R\$\s*R\$/, /CPF º/, /XXX/, /\[[A-ZÁ-Ú][^\]]*\]/];
function semErrosTipicos(texto: string) {
  for (const re of PROIBIDOS) expect(texto, `não deveria conter ${re}`).not.toMatch(re);
}

/** Numeração sem buracos: cada trecho (alteração, consolidação...) recomeça em PRIMEIRA. */
function numeracaoPorTrecho(texto: string): string[][] {
  const trechos: string[][] = [];
  for (const m of texto.matchAll(/CLÁUSULA ([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+):/g)) {
    if (m[1] === 'PRIMEIRA') trechos.push([]);
    trechos[trechos.length - 1].push(m[1]);
  }
  for (const t of trechos) t.forEach((o, i) => expect(o).toBe(ordinalClausula(i + 1)));
  return trechos;
}

const NOVA_SEDE = { logradouro: 'Avenida Sebastião Davino dos Reis', numero: '672', complemento: 'sala 3', bairro: 'Vila Porto', cidade: 'Barueri', uf: 'SP', cep: '06412-000' };

function anaNova() {
  const ana = exemplo('duas-socias').pessoas.find((p) => p.id === 'ex-ana')!;
  return novaPessoa({ ...ana, id: 'nova-ana' });
}

describe('FASE 2 — CRITÉRIO DE ACEITE: alteração com mudança de endereço, aumento de capital e entrada de sócio', () => {
  const e1 = empresaRegistrada(exemplo('dois-socios'));
  const inicio = iniciarAtoExistente(e1, DOC_ALTERACAO, buscar, cfg);
  let alt = inicio.ato;
  alt.dados_depois.sede = { ...NOVA_SEDE };
  alt.dados_depois.pessoas.push(anaNova());
  alt.movimentos = [
    { id: 'm1', tipo: 'aumento', socio_id: 'ex-joao', classe_id: CLASSE_UNICA, quotas: 2000 },
    { id: 'm2', tipo: 'aumento', socio_id: 'nova-ana', classe_id: CLASSE_UNICA, quotas: 3000 },
  ];
  alt = local(aplicarMovimentosNoAto(alt));
  const r = revisar(inicio.empresa, alt, DOC_ALTERACAO);
  const texto = textoDoDocumento(r.documento);

  it('o registro da abertura guardou a numeração do contrato vigente', () => {
    expect(e1.vigente!.numeracao_clausulas.sede).toBe(2);
    expect(e1.vigente!.numeracao_clausulas['capital-social']).toBe(5);
    expect(e1.vigente!.clausulas_vigentes).toContain('paragrafo-aumento-capital');
  });
  it('sem pendências', () => expect(r.pendencias.filter((p) => p.nivel === 'erro')).toEqual([]));
  it('sem "(a)", lacunas ou erros típicos', () => semErrosTipicos(texto));
  it('numeração: alterações de PRIMEIRA a QUINTA (com ratificação) e consolidação recomeçando em PRIMEIRA', () => {
    const t = numeracaoPorTrecho(texto);
    expect(t).toHaveLength(2);
    expect(t[0]).toHaveLength(5);
    expect(t[1].length).toBeGreaterThanOrEqual(13);
  });
  it('título e preâmbulo com os sócios atuais e a sócia que entra', () => {
    expect(texto).toContain('1ª ALTERAÇÃO CONTRATUAL DA SOCIEDADE EXEMPLO COMÉRCIO E SERVIÇOS LTDA');
    expect(texto).toContain('CNPJ 11.222.333/0001-81 — NIRE 35200000001');
    expect(texto).toMatch(/Sr\. JOÃO DA SILVA PEREIRA, .*CEP 06401-000 e\n/);
    expect(texto).toMatch(/Sra\. ANA BEATRIZ LIMA, brasileira, .* convivente em união estável sob o regime de separação total de bens/);
    expect(texto).toContain(
      'Únicos sócios da sociedade EXEMPLO COMÉRCIO E SERVIÇOS LTDA, com sede na Rua Campos Sales, nº 300, sala 5, bairro Centro, Barueri/SP, CEP 06401-000, com seu contrato social arquivado na Junta Comercial do Estado de São Paulo sob o NIRE nº 35200000001, em 20/11/2026, e inscrita no CNPJ sob o nº 11.222.333/0001-81, resolvem, com o ingresso da sócia ANA BEATRIZ LIMA, acima qualificada, na melhor forma de direito, efetivar a presente alteração contratual',
    );
  });
  it('cláusulas de alteração (anterior → novo), citando a cláusula do contrato vigente', () => {
    expect(texto).toContain(
      'CLÁUSULA PRIMEIRA: Neste ato é alterado o endereço da sede da sociedade, previsto na Cláusula Segunda do contrato social, de Rua Campos Sales, nº 300, sala 5, bairro Centro, Barueri/SP, CEP 06401-000 para Avenida Sebastião Davino dos Reis, nº 672, sala 3, bairro Vila Porto, Barueri/SP, CEP 06412-000.',
    );
    expect(texto).toContain(
      'CLÁUSULA SEGUNDA: Neste ato, o capital social, previsto na Cláusula Quinta do contrato social, é aumentado de R$ 10.500,00 (dez mil e quinhentos reais) para R$ 15.500,00 (quinze mil e quinhentos reais), com a criação de 5.000 (cinco mil) quotas, no valor de R$ 1,00 (um real) cada uma, totalmente subscritas e integralizadas, neste ato, em moeda corrente do País, da seguinte forma:',
    );
    expect(texto).toContain('a) JOÃO DA SILVA PEREIRA subscreve 2.000 (duas mil) quotas, no valor de R$ 2.000,00 (dois mil reais);');
    expect(texto).toContain('b) ANA BEATRIZ LIMA subscreve 3.000 (três mil) quotas, no valor de R$ 3.000,00 (três mil reais).');
    expect(texto).toContain('CLÁUSULA TERCEIRA: Ingressa na sociedade, neste ato, a sócia ANA BEATRIZ LIMA, qualificada no preâmbulo deste instrumento.');
    expect(texto).toContain('CLÁUSULA QUARTA: Em razão das alterações acima, o capital social de R$ 15.500,00 (quinze mil e quinhentos reais), dividido em 15.500 (quinze mil e quinhentas) quotas, passa a ser distribuído da seguinte forma:');
    expect(texto).toContain('CLÁUSULA QUINTA: Permanecem inalteradas as demais cláusulas');
  });
  it('consolidação automática com os dados novos', () => {
    const consolidacao = texto.slice(texto.indexOf('CONSOLIDAÇÃO DO CONTRATO SOCIAL'));
    expect(consolidacao).toContain('Únicos sócios da sociedade EXEMPLO COMÉRCIO E SERVIÇOS LTDA, resolvem consolidar o contrato social');
    expect(consolidacao).not.toContain('efetivar a presente alteração');
    expect(consolidacao).toContain('CLÁUSULA PRIMEIRA: A sociedade adotará o seguinte nome empresarial: EXEMPLO COMÉRCIO E SERVIÇOS LTDA.');
    expect(consolidacao).toContain('CLÁUSULA SEGUNDA: A sociedade terá sua sede no seguinte endereço: Avenida Sebastião Davino dos Reis, nº 672');
    expect(consolidacao).toContain('CLÁUSULA TERCEIRA: A empresa iniciou suas atividades em 01/12/2026');
    expect(consolidacao).toContain('O capital social é de R$ 15.500,00 (quinze mil e quinhentos reais), dividido em 15.500 (quinze mil e quinhentas) quotas');
    expect(consolidacao).toContain('JOÃO DA SILVA PEREIRA | 46,77% | 7.250 | R$ 7.250,00');
    expect(consolidacao).toContain('ANA BEATRIZ LIMA | 19,35% | 3.000 | R$ 3.000,00');
    expect(consolidacao).toContain('TOTAL | 100% | 15.500 | R$ 15.500,00');
    expect(consolidacao).toContain('A responsabilidade dos sócios é restrita');
    expect(consolidacao).not.toMatch(/sócio único|unipessoal/);
  });
  it('fechamento e assinaturas de todos os que participam', () => {
    expect(texto).toContain('E por estarem assim justos e contratados, assinam o presente instrumento');
    for (const nome of ['JOÃO DA SILVA PEREIRA', 'MARIA APARECIDA SOUZA', 'ANA BEATRIZ LIMA']) {
      expect(texto).toContain(`______________________________\n${nome}\nCPF:`);
    }
  });
  it('ao registrar, o cadastro vigente recebe os dados novos e a nova numeração', () => {
    const e2 = registrar(inicio.empresa, alt, DOC_ALTERACAO);
    expect(e2.vigente!.numero_ultima_alteracao).toBe(1);
    expect(e2.vigente!.sede.logradouro).toBe('Avenida Sebastião Davino dos Reis');
    expect(e2.vigente!.capital.valor_centavos).toBe(1550000);
    expect(e2.vigente!.participacoes.map((p) => p.pessoa_id)).toEqual(['ex-joao', 'ex-maria', 'nova-ana']);
    expect(e2.vigente!.numeracao_clausulas.sede).toBe(2);
    // a próxima alteração já sai como "2ª"
    const proxima = iniciarAtoExistente(e2, DOC_ALTERACAO, buscar, cfg);
    proxima.ato.dados_depois.enquadramento = 'EPP';
    const t2 = textoDoDocumento(revisar(proxima.empresa, local(proxima.ato), DOC_ALTERACAO).documento);
    expect(t2).toContain('2ª ALTERAÇÃO CONTRATUAL DA SOCIEDADE');
    expect(t2).toContain('Neste ato, a sociedade altera o seu enquadramento de Microempresa – ME para Empresa de Pequeno Porte – EPP');
    expect(t2).toContain('(art. 3º, II, da LC nº 123/2006)');
  });
});

describe('FASE 2 — cessão de todas as quotas: sai uma sócia e entra um sócio', () => {
  const e1 = empresaRegistrada(exemplo('dois-socios'));
  const { empresa, ato } = iniciarAtoExistente(e1, DOC_ALTERACAO, buscar, cfg);
  const carlos = novaPessoa({ ...exemplo('tres-socios-adm-externo').pessoas.find((p) => p.id === 'ex-carlos')!, id: 'novo-carlos' });
  ato.dados_depois.pessoas.push(carlos);
  ato.movimentos = [{ id: 'c1', tipo: 'cessao', cedente_id: 'ex-maria', cessionario_id: 'novo-carlos', classe_id: CLASSE_UNICA, quotas: 5250, preco_centavos: 600000 }];
  ato.dados_depois.administracao = { administradores: ['ex-joao'], forma: 'isolada' };
  ato.dados_depois.pro_labore = ['ex-joao'];
  const alt = local(aplicarMovimentosNoAto(ato));
  const r = revisar(empresa, alt, DOC_ALTERACAO);
  const texto = textoDoDocumento(r.documento);

  it('sem pendências e sem erros típicos', () => {
    expect(r.pendencias.filter((p) => p.nivel === 'erro')).toEqual([]);
    semErrosTipicos(texto);
    numeracaoPorTrecho(texto);
  });
  it('cessão, saída e entrada com concordância', () => {
    expect(texto).toContain(
      'A sócia MARIA APARECIDA SOUZA cede e transfere, neste ato, 5.250 (cinco mil duzentas e cinquenta) quotas de sua titularidade, no valor de R$ 5.250,00 (cinco mil duzentos e cinquenta reais), ao sócio ingressante CARLOS EDUARDO MENDES, pelo preço de R$ 6.000,00 (seis mil reais), dando plena, geral e irrevogável quitação, e retirando-se da sociedade.',
    );
    expect(texto).toContain('Ingressa na sociedade, neste ato, o sócio CARLOS EDUARDO MENDES');
    expect(texto).toContain('Retira-se da sociedade, neste ato, a sócia MARIA APARECIDA SOUZA, que dá à sociedade e aos demais sócios plena, geral e irrevogável quitação');
    expect(texto).toContain('que cabia aos sócios JOÃO DA SILVA PEREIRA e MARIA APARECIDA SOUZA, passa a caber ao sócio JOÃO DA SILVA PEREIRA.');
  });
  it('quem sai assina o ato, mas não está na consolidação', () => {
    const consolidacao = texto.slice(texto.indexOf('CONSOLIDAÇÃO DO CONTRATO SOCIAL'), texto.indexOf('E por estarem'));
    expect(consolidacao).not.toContain('MARIA APARECIDA SOUZA');
    expect(consolidacao).toContain('CARLOS EDUARDO MENDES | 50% | 5.250');
    expect(texto).toContain('______________________________\nMARIA APARECIDA SOUZA');
  });
  it('não deixa ceder mais quotas do que a pessoa tem', () => {
    const ruim = { ...alt, movimentos: [{ ...alt.movimentos[0], quotas: 9999 }] };
    const r2 = revisar(empresa, ruim, DOC_ALTERACAO);
    expect(r2.pendencias.some((p) => p.nivel === 'erro' && /não pode ceder/.test(p.mensagem))).toBe(true);
  });
});

describe('FASE 2 — situações de erro', () => {
  it('alteração sem nenhuma mudança é bloqueada', () => {
    const e1 = empresaRegistrada(exemplo('dois-socios'));
    const { empresa, ato } = iniciarAtoExistente(e1, DOC_ALTERACAO, buscar, cfg);
    const r = revisar(empresa, local(ato), DOC_ALTERACAO);
    expect(r.pendencias.some((p) => p.nivel === 'erro' && /Nenhuma alteração foi feita/.test(p.mensagem))).toBe(true);
  });
  it('empresa cadastrada à mão (sem numeração conhecida) pede o número da cláusula citada', () => {
    const e = novaEmpresa('ltda');
    e.vigente = { ...exemplo('dois-socios'), cnpj: '11.222.333/0001-81', nire: '35200000001' };
    const { empresa, ato } = iniciarAtoExistente(e, DOC_ALTERACAO, buscar, cfg);
    ato.dados_depois.sede = { ...NOVA_SEDE };
    const r = revisar(empresa, local(ato), DOC_ALTERACAO);
    expect(r.pendencias.map((p) => p.mensagem)).toContain('Falta preencher: número da cláusula “Sede” no contrato vigente.');
    ato.dados_antes!.numeracao_clausulas = { sede: 3 };
    const r2 = revisar(empresa, local(ato), DOC_ALTERACAO);
    expect(textoDoDocumento(r2.documento)).toContain('previsto na Cláusula Terceira do contrato social');
  });
  it('só permite um documento em andamento por empresa', () => {
    const e1 = empresaRegistrada(exemplo('dois-socios'));
    const { empresa } = iniciarAtoExistente(e1, DOC_ALTERACAO, buscar, cfg);
    expect(documentosPossiveis(empresa).every((d) => !!d.motivo)).toBe(true);
  });
});

describe('FASE 3 — distrato', () => {
  it('pluripessoal, sem bens e sem haveres', () => {
    const e1 = empresaRegistrada(exemplo('dois-socios'));
    const { empresa, ato } = iniciarAtoExistente(e1, DOC_DISTRATO, buscar, cfg);
    ato.distrato = { data_encerramento: '2026-11-30', liquidacao: 'sem_haveres', partilha_descricao: '', responsavel_ativo_passivo_id: 'ex-joao', responsavel_livros_id: 'ex-maria' };
    const a = local(ato);
    const r = revisar(empresa, a, DOC_DISTRATO);
    const texto = textoDoDocumento(r.documento);
    expect(r.pendencias.filter((p) => p.nivel === 'erro')).toEqual([]);
    semErrosTipicos(texto);
    expect(numeracaoPorTrecho(texto)[0]).toHaveLength(6); // o modelo tinha duas "QUINTAS"
    expect(texto).toContain('DISTRATO DE SOCIEDADE LIMITADA\nEXEMPLO COMÉRCIO E SERVIÇOS LTDA\nCNPJ: 11.222.333/0001-81\nNIRE: 35200000001');
    expect(texto).toContain('Únicos sócios da sociedade limitada EXEMPLO COMÉRCIO E SERVIÇOS LTDA, sediada na Rua Campos Sales');
    expect(texto).toContain('na melhor forma de direito e de comum acordo, resolvem, por não mais interessar a continuidade da sociedade, dissolver e extinguir a sociedade');
    expect(texto).toContain('CLÁUSULA PRIMEIRA: A sociedade encerrou suas operações e atividades em 30/11/2026.');
    expect(texto).toContain('CLÁUSULA SEGUNDA: Procedida a liquidação da sociedade, não há bens a restituir.');
    expect(texto).toContain('CLÁUSULA TERCEIRA: Os sócios dão entre si e à sociedade plena, geral e irrevogável quitação, para nada mais reclamarem um do outro');
    expect(texto).toContain('CLÁUSULA QUARTA: Procedida a liquidação da sociedade, os sócios nada recebem a título de haveres');
    expect(texto).toContain('CLÁUSULA QUINTA: A responsabilidade pelo ativo e passivo porventura supervenientes fica a cargo do ex-sócio JOÃO DA SILVA PEREIRA.');
    expect(texto).toMatch(/CLÁUSULA SEXTA: A sócia MARIA APARECIDA SOUZA, brasileira, .*, se compromete, também, a manter em boa guarda os livros/);
    expect(texto).toContain('E por estarem assim justos e acertados, assinam o presente instrumento de Distrato Social');
    const extinta = registrar(empresa, a, DOC_DISTRATO);
    expect(extinta.extinta_em).toBe('2026-12-10');
    expect(documentosPossiveis(extinta).every((d) => d.motivo === 'A empresa está extinta (distrato registrado).')).toBe(true);
  });
  it('unipessoal, com partilha de haveres', () => {
    const e1 = empresaRegistrada(exemplo('uma-socia'));
    const { empresa, ato } = iniciarAtoExistente(e1, DOC_DISTRATO, buscar, cfg);
    ato.distrato = { data_encerramento: '2026-11-30', liquidacao: 'partilha', partilha_descricao: 'o saldo de R$ 2.000,00 em conta corrente fica para a sócia', responsavel_ativo_passivo_id: 'ex-maria', responsavel_livros_id: 'ex-maria' };
    const r = revisar(empresa, local(ato), DOC_DISTRATO);
    const texto = textoDoDocumento(r.documento);
    expect(r.pendencias.filter((p) => p.nivel === 'erro')).toEqual([]);
    semErrosTipicos(texto);
    expect(texto).toContain('DISTRATO DE SOCIEDADE LIMITADA UNIPESSOAL');
    expect(texto).toContain('Única sócia da sociedade limitada');
    expect(texto).not.toContain('não há bens a restituir');
    expect(texto).toContain('A sócia dá à sociedade plena, geral e irrevogável quitação, para nada mais reclamar, seja a que título for');
    expect(texto).toContain('o saldo remanescente é partilhado da seguinte forma: o saldo de R$ 2.000,00 em conta corrente fica para a sócia.');
    expect(texto).toContain('fica a cargo da ex-sócia MARIA APARECIDA SOUZA.');
    expect(texto).toContain('E por estar assim justa e acertada, assina o presente instrumento de Distrato Social');
  });
  it('sem os responsáveis escolhidos, aponta a pendência', () => {
    const e1 = empresaRegistrada(exemplo('dois-socios'));
    const { empresa, ato } = iniciarAtoExistente(e1, DOC_DISTRATO, buscar, cfg);
    const r = revisar(empresa, local(ato), DOC_DISTRATO);
    const msgs = r.pendencias.map((p) => p.mensagem);
    expect(msgs).toContain('Escolha o responsável pelo ativo e passivo supervenientes.');
    expect(msgs).toContain('Informe a data de encerramento das atividades.');
  });
});

describe('FASE 3 — transformações', () => {
  it('LTDA unipessoal (sócia) → Empresário Individual', () => {
    const e1 = empresaRegistrada(exemplo('uma-socia'));
    expect(documentosPossiveis(e1).find((d) => d.def.id === 'transformacao_ltda_ei')!.motivo).toBeUndefined();
    const { empresa, ato } = iniciarAtoExistente(e1, DOC_TRANSF_LTDA_EI, buscar, cfg);
    ato.dados_depois.razao_social = 'MARIA APARECIDA SOUZA';
    const a = local(ato);
    expect(tipoParaAto(empresa, a).id).toBe('ei');
    const r = revisar(empresa, a, DOC_TRANSF_LTDA_EI);
    const texto = textoDoDocumento(r.documento);
    expect(r.pendencias.filter((p) => p.nivel === 'erro')).toEqual([]);
    semErrosTipicos(texto);
    const trechos = numeracaoPorTrecho(texto);
    expect(trechos).toHaveLength(2);
    expect(texto).toContain('ALTERAÇÃO POR TRANSFORMAÇÃO DE SOCIEDADE EMPRESÁRIA LIMITADA EM EMPRESÁRIO INDIVIDUAL');
    expect(texto).toMatch(/Sra\. MARIA APARECIDA SOUZA, brasileira, .*, única sócia da sociedade EXEMPLO COMÉRCIO E SERVIÇOS LTDA, estabelecida na Rua Campos Sales/);
    expect(texto).toContain('ora transforma seu registro de SOCIEDADE EMPRESÁRIA LIMITADA, passando a constituir o tipo jurídico EMPRESÁRIO INDIVIDUAL');
    expect(texto).toContain('CLÁUSULA PRIMEIRA: Fica transformada a Sociedade Empresária Limitada em Empresário Individual');
    expect(texto).toContain('CLÁUSULA SEGUNDA: O Empresário Individual adotará o nome empresarial MARIA APARECIDA SOUZA.');
    expect(texto).toContain('Para tanto, passa a transcrever, na íntegra, o INSTRUMENTO DE INSCRIÇÃO');
    const inscricao = texto.slice(texto.indexOf('INSTRUMENTO DE INSCRIÇÃO DE EMPRESÁRIO INDIVIDUAL'));
    expect(inscricao).toContain('passa a constituir-se como Empresário Individual');
    expect(inscricao).toContain('CLÁUSULA PRIMEIRA: O Empresário Individual adotará a seguinte firma: MARIA APARECIDA SOUZA, e tem sua sede na Rua Campos Sales');
    expect(inscricao).toContain('O capital é de R$ 10.500,00 (dez mil e quinhentos reais), totalmente integralizado em moeda corrente do País.');
    expect(inscricao).toContain('A empresária declara que o movimento da receita bruta anual da empresa não excederá o limite fixado no inciso I do art. 3º');
    expect(inscricao).toContain('não está impedida de exercer atividade empresária');
    expect(inscricao).not.toMatch(/quotas/);
    expect(texto).toContain('E por estar assim justa e contratada, assina o presente instrumento');
    const depois = registrar(empresa, a, DOC_TRANSF_LTDA_EI);
    expect(depois.tipo_societario).toBe('ei');
    expect(depois.vigente!.razao_social).toBe('MARIA APARECIDA SOUZA');
  });

  it('Empresário Individual → LTDA unipessoal', () => {
    const e = novaEmpresa('ei');
    const base = exemplo('uma-socia');
    e.vigente = {
      ...base,
      razao_social: 'MARIA APARECIDA SOUZA',
      cnpj: '11.222.333/0001-81',
      nire: '35100000001',
      quotas: { modo: '', classes: [] },
      capital: { ...base.capital, valor_centavos: 2000000 },
      participacoes: [{ pessoa_id: 'ex-maria', quotas: {} }],
      administracao: { administradores: [], forma: 'isolada' },
      pro_labore: [],
    };
    expect(documentosPossiveis(e).map((d) => d.def.id)).toEqual(['transformacao_ei_ltda']);
    const { empresa, ato } = iniciarAtoExistente(e, DOC_TRANSF_EI_LTDA, buscar, cfg);
    ato.dados_depois.razao_social = 'SOUZA PAPELARIA LTDA';
    const a = local(ato);
    expect(tipoParaAto(empresa, a).id).toBe('ltda');
    const r = revisar(empresa, a, DOC_TRANSF_EI_LTDA);
    const texto = textoDoDocumento(r.documento);
    expect(r.pendencias.filter((p) => p.nivel === 'erro')).toEqual([]);
    semErrosTipicos(texto);
    expect(numeracaoPorTrecho(texto)).toHaveLength(2);
    expect(texto).toContain('CONTRATO SOCIAL POR TRANSFORMAÇÃO DE EMPRESÁRIO INDIVIDUAL\nMARIA APARECIDA SOUZA — CNPJ 11.222.333/0001-81');
    expect(texto).toMatch(/Sra\. MARIA APARECIDA SOUZA, .*, titular da empresa MARIA APARECIDA SOUZA, estabelecida na Rua Campos Sales/);
    expect(texto).toContain('fazendo uso do que permite o § 3º do art. 968 da Lei nº 10.406/2002');
    expect(texto).toContain('CLÁUSULA PRIMEIRA: Fica transformado o Empresário Individual em Sociedade Limitada Unipessoal');
    expect(texto).toContain('CLÁUSULA SEGUNDA: A sociedade, constituída sob a forma de sociedade limitada unipessoal, adotará o nome empresarial SOUZA PAPELARIA LTDA');
    expect(texto).toContain('§ 1º do art. 1.052 do Código Civil');
    const contrato = texto.slice(texto.indexOf('CONTRATO SOCIAL POR TRANSFORMAÇÃO DE EMPRESÁRIO INDIVIDUAL EM SOCIEDADE'));
    expect(contrato).toContain('única sócia da sociedade SOUZA PAPELARIA LTDA, que se regerá, doravante, pelo presente contrato social');
    expect(contrato).toContain('CLÁUSULA PRIMEIRA: A sociedade adotará o seguinte nome empresarial: SOUZA PAPELARIA LTDA.');
    expect(contrato).toContain('A empresa iniciou suas atividades em 01/12/2026');
    expect(contrato).toContain('A sociedade empresária limitada unipessoal tem como objeto social');
    expect(contrato).toContain('O capital social é de R$ 20.000,00 (vinte mil reais), dividido em 20.000 (vinte mil) quotas no valor de R$ 1,00 (um real) cada uma');
    expect(contrato).toContain('MARIA APARECIDA SOUZA | 100% | 20.000 | R$ 20.000,00');
    expect(contrato).toContain('A administração da sociedade caberá à sócia MARIA APARECIDA SOUZA');
    expect(contrato).toContain('cabendo à sócia única os lucros ou perdas apurados');
    const depois = registrar(empresa, a, DOC_TRANSF_EI_LTDA);
    expect(depois.tipo_societario).toBe('ltda');
    expect(depois.vigente!.numeracao_clausulas.sede).toBe(2);
    expect(documentosPossiveis(depois).map((d) => d.def.id)).toContain('alteracao');
  });

  it('o tipo Empresário Individual aceita um único titular', () => {
    expect(EI.max_membros).toBe(1);
    expect(EI.vocabulario.membro[0]).toBe('titular');
  });
});
