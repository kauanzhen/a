import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { limparBanco } from '../../test/ambiente';
import { criarEmpresaExemplo } from '../inicio/empresaExemplo';
import { gerarContextoContabil } from './contextoIA';
import { interpretarLoteIA, SCHEMA_LOTE, validarLoteIA } from './formatoLote';
import { carregarContextoImportacao } from '../importacao/importacaoService';

const PASTA_SKILL = resolve(__dirname, '../../../.claude/skills/lancamentos-contabeis');
const ler = (rel: string) => readFileSync(resolve(PASTA_SKILL, rel), 'utf8');

type Validador = (lote: unknown, contexto?: unknown) => { erros: string[]; avisos: string[] };
async function validadorDaSkill(): Promise<Validador> {
  const caminho: string = resolve(PASTA_SKILL, 'scripts/validar-lote.mjs');
  return (await import(caminho)).validarLote as Validador;
}

let empresaId: number;
beforeEach(async () => {
  await limparBanco();
  empresaId = await criarEmpresaExemplo();
});

describe('skill lancamentos-contabeis', () => {
  it('o schema documentado em formato-lote.md é igual ao do sistema', () => {
    const doc = ler('referencias/formato-lote.md');
    const bloco = doc.slice(doc.lastIndexOf('```json') + 7, doc.lastIndexOf('```'));
    expect(JSON.parse(bloco)).toEqual(JSON.parse(JSON.stringify(SCHEMA_LOTE)));
  });

  it('o lote de exemplo é válido no script da skill e no sistema', async () => {
    const lote = JSON.parse(ler('exemplos/lote-exemplo.json'));
    const contexto = JSON.parse(JSON.stringify(await gerarContextoContabil(empresaId)));
    const validar = await validadorDaSkill();
    expect(validar(lote, contexto)).toEqual({ erros: [], avisos: [] });

    const { lote: normalizado, erros } = interpretarLoteIA(lote);
    expect(erros).toEqual([]);
    const r = validarLoteIA(normalizado!, await carregarContextoImportacao(empresaId));
    expect(r.sugestoes.map((s) => [s.lancamento.id, s.valido, s.erros])).toEqual([
      ['L1', true, []],
      ['L2', true, []],
      ['L3', true, []],
      ['L4', true, []],
    ]);
  });

  it('o script da skill aponta os mesmos erros que o sistema', async () => {
    const lote = JSON.parse(ler('exemplos/lote-exemplo.json'));
    lote.lancamentos[0].partidas[1].valor = 3400; // desbalanceia
    lote.lancamentos[1].partidas[0].conta = '1.1.3.01'; // sintética
    lote.lancamentos[2].data = '2027-01-10'; // sem período
    lote.lancamentos[3].partidas.push({ conta: '5.1.1.01.0001', tipo: 'D', valor: 1, centroCusto: '', historico: '' });
    lote.lancamentos[3].partidas[1].valor = 4001;
    const contexto = JSON.parse(JSON.stringify(await gerarContextoContabil(empresaId)));
    const { erros, avisos } = (await validadorDaSkill())(lote, contexto);
    expect(erros.join('\n')).toMatch(/L1: desbalanceado/);
    expect(erros.join('\n')).toMatch(/L2, partida 1: conta "1.1.3.01" não existe/);
    expect(erros.join('\n')).toMatch(/L4, partida 3: a conta 5.1.1.01.0001 .* exige centroCusto/);
    expect(avisos.join('\n')).toMatch(/L3: 2027-01-10 não está em período aberto/);

    const r = validarLoteIA(interpretarLoteIA(lote).lote!, await carregarContextoImportacao(empresaId));
    expect(r.sugestoes.map((s) => s.valido)).toEqual([false, false, false, false]);
  });

  it('SKILL.md tem frontmatter com nome e descrição', () => {
    const md = ler('SKILL.md');
    expect(md).toMatch(/^---\nname: lancamentos-contabeis\ndescription: .+\n---\n/);
  });
});
