import { describe, expect, it } from 'vitest';
import { cnpjValido, cpfValido, formatarCNAE, formatarCPF } from './documentos';
import { percentualParaQuotas, situacao, totalQuotasEsperado, valorParaQuotas } from './quotas';
import { EXEMPLOS, exemplo } from './exemplos';
import { validarDados, validarPessoa } from './validacao';
import { todosOsCampos } from './campos';
import { LTDA } from '../tipos/ltda';
import { enderecoCompleto, noEndereco } from './formatacao';
import { novaPessoa } from './fabricas';

describe('documentos', () => {
  it('CPF', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('111.444.777-35')).toBe(true);
    expect(cpfValido('123.456.789-09')).toBe(true);
    expect(cpfValido('935.411.347-80')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(formatarCPF('52998224725')).toBe('529.982.247-25');
  });
  it('CNPJ', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
  });
  it('CNAE', () => {
    expect(formatarCNAE('7490104')).toBe('74.90-1-04');
  });
});

describe('quotas', () => {
  it('converte valor em quotas e bloqueia valor quebrado', () => {
    expect(valorParaQuotas(500000, 100)).toEqual({ ok: true, quotas: 5000 });
    const r = valorParaQuotas(500050, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.abaixo).toBe(5000);
      expect(r.acima).toBe(5001);
    }
  });
  it('converte percentual em quotas e bloqueia percentual que não dá quota inteira', () => {
    // capital de R$ 10.000,00, quotas de R$ 1,00
    expect(percentualParaQuotas(5000, 1000000, 100)).toEqual({ ok: true, quotas: 5000 });
    // capital de R$ 100,00 com quotas de R$ 1,00: 33,33% = 33,33 quotas -> bloqueia
    const r = percentualParaQuotas(3333, 10000, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.abaixo).toBe(33);
      expect(r.acima).toBe(34);
    }
  });
  it('total esperado = capital ÷ valor unitário', () => {
    const d = exemplo('dois-socios');
    expect(totalQuotasEsperado(d)).toBe(10500);
    d.capital.valor_quota_centavos = 1000; // R$ 10,00 -> 1.050 quotas
    expect(totalQuotasEsperado(d)).toBe(1050);
    d.capital.valor_quota_centavos = 333;
    expect(totalQuotasEsperado(d)).toBeNull();
  });
  it('situação derivada do quadro', () => {
    expect(situacao(exemplo('um-socio'))).toBe('unipessoal');
    expect(situacao(exemplo('dois-socios'))).toBe('pluripessoal');
  });
});

describe('validação', () => {
  const campos = todosOsCampos();
  campos.delete('empresa.cnpj');
  campos.delete('empresa.nire');
  campos.delete('empresa.data_registro');
  campos.delete('fechamento.local_data');

  it('os exemplos são válidos (sem erros)', () => {
    for (const ex of EXEMPLOS) {
      const erros = validarDados(ex.dados(), campos, { tipo: LTDA }).filter((p) => p.nivel === 'erro');
      expect(erros, ex.nome).toEqual([]);
    }
  });
  it('exige regime de bens para casado', () => {
    const p = novaPessoa({ nome: 'X', genero: 'M', estado_civil: 'casado' });
    const r = validarPessoa(p, new Set(['pessoa.estado_civil']));
    expect(r.map((x) => x.mensagem).join(' ')).toMatch(/regime de bens/);
  });
  it('acusa soma das quotas diferente do capital', () => {
    const d = exemplo('dois-socios');
    d.participacoes[0].quotas.ordinarias = 1000;
    const r = validarDados(d, campos, { tipo: LTDA });
    expect(r.some((x) => /menor que o capital/.test(x.mensagem))).toBe(true);
  });
  it('acusa mais de um CNAE principal', () => {
    const d = exemplo('dois-socios');
    d.cnaes[1].tipo = 'principal';
    const r = validarDados(d, campos, { tipo: LTDA });
    expect(r.some((x) => /exatamente um CNAE principal/.test(x.mensagem))).toBe(true);
  });
  it('classes distintas geram o aviso do advogado', () => {
    const r = validarDados(exemplo('classes'), campos, { tipo: LTDA });
    expect(r.some((x) => x.nivel === 'aviso' && /advogado/.test(x.mensagem))).toBe(true);
  });
});

describe('endereços', () => {
  it('com preposição conforme o logradouro', () => {
    const d = exemplo('dois-socios');
    expect(enderecoCompleto(d.sede)).toBe('Rua Campos Sales, nº 300, sala 5, bairro Centro, Barueri/SP, CEP 06401-000');
    expect(noEndereco(d.sede)).toMatch(/^na Rua/);
    const ana = exemplo('duas-socias').pessoas[1];
    expect(noEndereco(ana.endereco)).toMatch(/^no Largo/);
  });
});
