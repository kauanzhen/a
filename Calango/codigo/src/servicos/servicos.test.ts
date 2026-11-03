import { describe, expect, it } from 'vitest';
import { BIBLIOTECA_TESTE, buscarNaBiblioteca } from '../test/abertura';
import { DOC_ABERTURA, LTDA } from '../tipos/ltda';
import { camposDoAto, iniciarAbertura, marcarGerado, marcarRegistrado, revisarAto, selecaoPadrao, temErros } from './atos';
import { configuracoesPadrao } from '../armazenamento/configuracoes';
import { exemplo } from '../dados/exemplos';
import { aplicarEdicao, criarClausula, duplicarClausula, idUnico } from '../biblioteca/edicao';
import { extrairConteudo } from '../motor/clausula';

describe('conjunto padrão de cláusulas', () => {
  it('carrega blocos com condição que não depende da situação (decidida na montagem)', () => {
    const uni = selecaoPadrao(DOC_ABERTURA, buscarNaBiblioteca, 'unipessoal');
    const ids = uni.corpo.map((i) => i.clausula_id);
    expect(ids).toContain('capital-social');
    expect(ids).toContain('paragrafo-administrador-nao-socio');
  });
  it('campos exigidos não incluem CNPJ/NIRE na abertura', () => {
    const sel = selecaoPadrao(DOC_ABERTURA, buscarNaBiblioteca, 'pluripessoal');
    const campos = camposDoAto(sel, buscarNaBiblioteca, LTDA);
    expect(campos.has('empresa.razao_social')).toBe(true);
    expect(campos.has('pessoa.cpf')).toBe(true);
    expect(campos.has('capital.quotas')).toBe(true);
    expect(campos.has('fechamento.local_data')).toBe(true);
    expect(campos.has('empresa.cnpj')).toBe(false);
    expect(campos.has('empresa.nire')).toBe(false);
  });
});

describe('fluxo do ato de abertura', () => {
  it('rascunho vazio tem pendências; com dados completos, nenhuma', () => {
    const cfg = configuracoesPadrao();
    cfg.padroes = { cidade: 'Barueri', uf: 'SP' };
    const { empresa, ato } = iniciarAbertura(DOC_ABERTURA, LTDA, buscarNaBiblioteca, cfg);
    expect(ato.dados_depois.foro).toEqual({ cidade: 'Barueri', uf: 'SP' });
    const vazio = revisarAto(ato, DOC_ABERTURA, LTDA, buscarNaBiblioteca);
    expect(temErros(vazio.pendencias)).toBe(true);
    expect(vazio.pendencias[0].mensagem).toBe('Informe a razão social da empresa.');

    ato.dados_depois = exemplo('dois-socios');
    ato.opcoes.data_ato = '2026-11-03';
    const cheio = revisarAto(ato, DOC_ABERTURA, LTDA, buscarNaBiblioteca);
    expect(cheio.pendencias.filter((p) => p.nivel === 'erro')).toEqual([]);

    // gerar e registrar
    const gerado = marcarGerado(ato, cheio.documento, 'x.docx');
    expect(gerado.status).toBe('gerado');
    const e2 = { ...empresa, atos: [gerado] };
    expect(e2.vigente).toBeNull();
    const registrada = marcarRegistrado(e2, ato.id, { data: '2026-11-20', numero: '123', nire: '35212345678', cnpj: '11.222.333/0001-81' });
    expect(registrada.vigente!.razao_social).toBe('EXEMPLO COMÉRCIO E SERVIÇOS LTDA');
    expect(registrada.vigente!.nire).toBe('35212345678');
    expect(registrada.vigente!.data_registro).toBe('2026-11-20');
    expect(registrada.atos[0].status).toBe('registrado');
  });
  it('não registra ato que ainda é rascunho', () => {
    const { empresa, ato } = iniciarAbertura(DOC_ABERTURA, LTDA, buscarNaBiblioteca, configuracoesPadrao());
    expect(() => marcarRegistrado(empresa, ato.id, { data: '', numero: '', nire: '', cnpj: '' })).toThrow(/Gere o documento/);
  });
  it('avisa quando a situação escolhida não bate com os sócios cadastrados', () => {
    const { ato } = iniciarAbertura(DOC_ABERTURA, LTDA, buscarNaBiblioteca, configuracoesPadrao(), 'unipessoal');
    ato.dados_depois = exemplo('dois-socios');
    const r = revisarAto(ato, DOC_ABERTURA, LTDA, buscarNaBiblioteca);
    expect(r.pendencias.some((p) => /unipessoal, mas cadastrou mais de um sócio/.test(p.mensagem))).toBe(true);
  });
});

describe('edição da biblioteca com versões', () => {
  const ids = new Set(BIBLIOTECA_TESTE.map((c) => c.id));
  it('nova versão guarda a anterior no histórico e recalcula os campos', () => {
    const foro = buscarNaBiblioteca('foro')!;
    const novo = { ...extrairConteudo(foro), corpo: 'Foro da comarca de {{foro.cidade_uf}}, data {{ato.data_por_extenso}}.' };
    const v2 = aplicarEdicao(foro, novo, LTDA, buscarNaBiblioteca, '2026-11-04T00:00:00.000Z');
    expect(v2.versao).toBe(2);
    expect(v2.historico).toHaveLength(1);
    expect(v2.historico[0].corpo).toBe(foro.corpo);
    expect(v2.campos_exigidos).toEqual(['fechamento.foro', 'fechamento.local_data']);
    // sem mudança, sem nova versão
    expect(aplicarEdicao(v2, extrairConteudo(v2), LTDA, buscarNaBiblioteca)).toBe(v2);
  });
  it('ids únicos, criação e duplicação', () => {
    expect(idUnico('Foro', ids)).toBe('foro-2');
    const c = criarClausula({ ...extrairConteudo(buscarNaBiblioteca('foro')!), titulo_interno: 'Meu foro' }, ids, LTDA, buscarNaBiblioteca);
    expect(c.id).toBe('meu-foro');
    expect(c.origem).toBe('usuario');
    const d = duplicarClausula(buscarNaBiblioteca('sede')!, ids, LTDA, buscarNaBiblioteca);
    expect(d.titulo_interno).toBe('Sede (cópia)');
    expect(d.versao).toBe(1);
  });
});
