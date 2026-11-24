import { describe, expect, it } from 'vitest';
import { SistemaArquivosMemoria } from './sistemaArquivos';
import { ErroConflito, Repositorio } from './repositorio';
import { analisarImportacao, exportar, importar, lerPacote } from './exportacao';
import { interpretarRodape } from './configuracoes';
import { novaEmpresa, novoAto, opcoesAtoPadrao } from '../dados/fabricas';
import { exemplo } from '../dados/exemplos';

function criar(data = new Date(2026, 10, 3, 10, 0, 0)) {
  const fs = new SistemaArquivosMemoria(() => data.getTime());
  let agora = data;
  const repo = new Repositorio(fs, () => agora);
  return { fs, repo, mudarData: (d: Date) => (agora = d) };
}

describe('inicialização da pasta de dados', () => {
  it('cria configurações e a biblioteca inicial (um arquivo por cláusula)', async () => {
    const { fs, repo } = criar();
    const r = await repo.inicializar();
    expect(r.nova).toBe(true);
    expect(r.clausulasCriadas).toBeGreaterThan(15);
    expect(await fs.modificadoEm('configuracoes.json')).not.toBeNull();
    expect(await fs.modificadoEm('clausulas/capital-social.json')).not.toBeNull();
    const segunda = await repo.inicializar();
    expect(segunda.nova).toBe(false);
    expect(segunda.clausulasCriadas).toBe(0);
  });
  it('atualiza a biblioteca: cria blocos novos, revisa os não editados e não toca nos editados', async () => {
    const { fs, repo } = criar();
    await repo.inicializar();
    // simula uma pasta da versão anterior: falta um bloco, um bloco antigo não editado e um editado pelo usuário
    await fs.excluir('clausulas/ratificacao.json');
    const duracao = JSON.parse((await fs.lerTexto('clausulas/duracao.json'))!.texto);
    await fs.gravar('clausulas/duracao.json', JSON.stringify({ ...duracao, corpo: 'texto antigo do sistema' }));
    const foro = JSON.parse((await fs.lerTexto('clausulas/foro.json'))!.texto);
    const editado = { ...foro, corpo: 'texto do usuário', versao: 2, historico: [{ ...foro, versao: 1, salvo_em: '' }] };
    await fs.gravar('clausulas/foro.json', JSON.stringify(editado));
    const r = await repo.inicializar();
    expect(r.clausulasCriadas).toBe(1);
    expect(r.clausulasAtualizadas).toBe(1);
    const d2 = JSON.parse((await fs.lerTexto('clausulas/duracao.json'))!.texto);
    expect(d2.corpo).toContain('[se consolidacao]');
    expect(d2.versao).toBe(2);
    expect(d2.historico[0].corpo).toBe('texto antigo do sistema');
    expect(JSON.parse((await fs.lerTexto('clausulas/foro.json'))!.texto).corpo).toBe('texto do usuário');
  });
  it('avisa quando a pasta parece ser de outro programa', async () => {
    const { fs, repo } = criar();
    expect(await repo.pastaPareceEstranha()).toBe(false);
    await fs.gravar('planilha.xlsx', 'x');
    expect(await repo.pastaPareceEstranha()).toBe(true);
  });
});

describe('gravação por empresa, backup e conflito', () => {
  it('grava, faz backup da versão anterior e detecta alteração por outra pessoa', async () => {
    const { fs, repo } = criar();
    const e = novaEmpresa('ltda');
    e.atos.push(novoAto('abertura', null, opcoesAtoPadrao()));
    const caminho = repo.novoCaminhoEmpresa(e, 'Padaria Bom Pão LTDA');
    expect(caminho).toMatch(/^empresas\/padaria-bom-pao-ltda-[a-z0-9]{8}\.json$/);

    const m1 = await repo.salvarEmpresa(e, caminho, null);
    expect((await fs.listar('backups')).length).toBe(0);

    e.atos[0].dados_depois.razao_social = 'PADARIA BOM PÃO LTDA';
    const m2 = await repo.salvarEmpresa(e, caminho, m1);
    expect(m2).toBeGreaterThan(m1);
    const backups = await fs.listar('backups/2026-11-03');
    expect(backups.length).toBe(1);
    expect(backups[0].nome).toMatch(/^empresas__padaria-bom-pao-ltda-.*\.json$/);

    // outra pessoa grava no meio
    await fs.alterarPorFora(caminho, JSON.stringify({ ...e, atualizada_em: 'outra pessoa' }));
    await expect(repo.salvarEmpresa(e, caminho, m2)).rejects.toBeInstanceOf(ErroConflito);
    // nada foi sobrescrito
    expect((await fs.lerTexto(caminho))!.texto).toContain('outra pessoa');
  });

  it('não grava por cima de arquivo que já existe quando se esperava arquivo novo', async () => {
    const { repo } = criar();
    await repo.gravarJson('empresas/x.json', { a: 1 });
    await expect(repo.gravarJson('empresas/x.json', { a: 2 }, { modificadoEmEsperado: null })).rejects.toBeInstanceOf(ErroConflito);
  });

  it('apaga backups com mais de 30 dias e mantém os recentes', async () => {
    const { fs, repo, mudarData } = criar();
    await fs.gravar('backups/2026-09-01/a.json', '{}');
    await fs.gravar('backups/2026-10-20/b.json', '{}');
    mudarData(new Date(2026, 10, 3));
    expect(await repo.limparBackupsAntigos()).toBe(1);
    expect((await fs.listar('backups')).map((e) => e.nome)).toEqual(['2026-10-20']);
  });

  it('exclusão guarda cópia em backups', async () => {
    const { fs, repo } = criar();
    await repo.gravarJson('empresas/y.json', { a: 1 });
    await repo.excluirEmpresa('empresas/y.json');
    expect(await fs.modificadoEm('empresas/y.json')).toBeNull();
    expect((await fs.listar('backups/2026-11-03')).length).toBe(1);
  });
});

describe('exportar e importar', () => {
  it('leva tudo de uma pasta para outra', async () => {
    const a = criar();
    await a.repo.inicializar();
    const e = novaEmpresa('ltda');
    e.vigente = exemplo('dois-socios');
    await a.repo.salvarEmpresa(e, a.repo.novoCaminhoEmpresa(e, e.vigente.razao_social), null);
    await a.repo.gravarImagem('logo.png', new Uint8Array([137, 80, 78, 71]));

    const pacote = lerPacote(JSON.stringify(await exportar(a.repo, 'tudo')));
    expect(pacote.clausulas!.length).toBeGreaterThan(15);
    expect(pacote.empresas!.length).toBe(1);

    const b = criar();
    const itens = await analisarImportacao(b.repo, pacote);
    expect(itens.some((i) => i.tipo === 'empresa' && !i.existe)).toBe(true);
    const r = await importar(b.repo, pacote, new Set(itens.map((i) => i.chave)));
    expect(r.erros).toEqual([]);
    const empresas = (await b.repo.listarEmpresas()).lidas;
    expect(empresas[0].dados.vigente!.razao_social).toBe('EXEMPLO COMÉRCIO E SERVIÇOS LTDA');
    expect(await b.repo.lerImagem('logo.png')).toEqual(new Uint8Array([137, 80, 78, 71]));

    // importar de novo marca como "já existe" e substitui com backup
    const denovo = await analisarImportacao(b.repo, pacote);
    expect(denovo.find((i) => i.tipo === 'empresa')!.existe).toBe(true);
  });
  it('não leva a chave de API da IA no pacote e mantém a chave da pasta de destino', async () => {
    const a = criar();
    await a.repo.inicializar();
    const cfgA = await a.repo.carregarConfiguracoes();
    await a.repo.salvarConfiguracoes({ ...cfgA.dados, ia: { provedor: 'claude', modelo: 'claude-opus-5-5', chave: 'sk-ant-segredo-A' } }, cfgA.modificadoEm);
    const texto = JSON.stringify(await exportar(a.repo, 'tudo'));
    expect(texto).not.toContain('sk-ant-segredo-A');
    const pacote = lerPacote(texto);
    expect(pacote.configuracoes!.ia).toEqual({ provedor: 'claude', modelo: 'claude-opus-5-5', chave: '' });

    const b = criar();
    await b.repo.inicializar();
    const cfgB = await b.repo.carregarConfiguracoes();
    await b.repo.salvarConfiguracoes({ ...cfgB.dados, ia: { provedor: 'gemini', modelo: 'x', chave: 'chave-B' } }, cfgB.modificadoEm);
    const r = await importar(b.repo, pacote, new Set(['configuracoes']));
    expect(r.erros).toEqual([]);
    expect((await b.repo.carregarConfiguracoes()).dados.ia).toEqual({ provedor: 'claude', modelo: 'claude-opus-5-5', chave: 'chave-B' });
  });
  it('recusa arquivo que não é do Calango', () => {
    expect(() => lerPacote('{"x":1}')).toThrow(/não é uma exportação do Calango/);
    expect(() => lerPacote('nada')).toThrow(/JSON válido/);
  });
});

describe('rodapé', () => {
  it('campos, número de página e trechos opcionais', () => {
    const r = interpretarRodape('{razao_social}[ — CNPJ {cnpj}] — Página {pagina} de {total_paginas}', {
      razao_social: 'X LTDA',
      cnpj: '',
      nire: '',
      titulo_ato: '',
    });
    expect(r).toEqual([
      [{ tipo: 'texto', texto: 'X LTDA — Página ' }, { tipo: 'pagina' }, { tipo: 'texto', texto: ' de ' }, { tipo: 'total_paginas' }],
    ]);
    const r2 = interpretarRodape('{titulo_ato}|CNPJ {cnpj}', { razao_social: '', cnpj: '11', nire: '', titulo_ato: 'Contrato' });
    expect(r2).toEqual([[{ tipo: 'texto', texto: 'Contrato' }], [{ tipo: 'texto', texto: 'CNPJ 11' }]]);
  });
});
