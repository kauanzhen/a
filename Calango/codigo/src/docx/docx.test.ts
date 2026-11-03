import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { writeFileSync, mkdirSync } from 'node:fs';
import { gerarDocxBytes, nomeArquivoDocx, tamanhoImagemCabecalho } from './gerarDocx';
import { configuracoesPadrao } from '../armazenamento/configuracoes';
import { gerarAbertura } from '../test/abertura';
import { exemplo } from '../dados/exemplos';

// PNG 1x1 transparente
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

/** Para conferir visualmente: CALANGO_SAIDA=/pasta npm test */
function salvarSePedido(nome: string, bytes: Uint8Array) {
  const pasta = process.env.CALANGO_SAIDA;
  if (!pasta) return;
  mkdirSync(pasta, { recursive: true });
  writeFileSync(`${pasta}/${nome}`, bytes);
}

async function abrir(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const ler = async (n: string) => (await zip.file(n)?.async('string')) ?? '';
  return { zip, ler };
}

function textoXml(xml: string): string {
  return xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

describe('geração do .docx', () => {
  it('abertura com 2 sócios: estilos nomeados, rodapé com páginas, sem hyperlinks e sem "(a)"', async () => {
    const doc = gerarAbertura(exemplo('dois-socios'));
    const cfg = configuracoesPadrao();
    cfg.cabecalho.texto = 'ESCRITÓRIO EXEMPLO DE CONTABILIDADE';
    cfg.cabecalho.ocultar_primeira_pagina = true;
    const bytes = await gerarDocxBytes({
      documento: doc,
      configuracoes: cfg,
      camposRodape: { razao_social: 'EXEMPLO COMÉRCIO E SERVIÇOS LTDA', cnpj: '', nire: '', titulo_ato: doc.titulo },
      usarCabecalho: true,
      imagemCabecalho: { dados: PNG, tipo: 'png', largura: 2000, altura: 350 },
    });
    const { zip, ler } = await abrir(bytes);
    const documento = await ler('word/document.xml');
    const estilos = await ler('word/styles.xml');
    const texto = textoXml(documento);

    expect(texto).toContain('CLÁUSULA PRIMEIRA: A sociedade adotará o seguinte nome empresarial');
    expect(texto).toContain('dez mil e quinhentas');
    expect(texto).not.toMatch(/\((a|as|o|os|ra)\)/i);
    expect(documento).not.toContain('w:hyperlink');
    expect(documento).not.toContain('w:numPr'); // numeração nunca é lista automática do Word
    for (const nome of ['Título do Ato', 'Título de Seção', 'Cláusula', 'Parágrafo', 'Tabela', 'Assinatura']) {
      expect(estilos).toContain(`w:val="${nome}"`);
    }
    expect(documento).toContain('<w:titlePg/>');
    const arquivos = Object.keys(zip.files);
    const rodapes = arquivos.filter((n) => /word\/footer\d+\.xml/.test(n));
    expect(rodapes.length).toBeGreaterThan(0);
    const rodape = await ler(rodapes[0]);
    expect(rodape).toContain('PAGE');
    expect(rodape).toContain('NUMPAGES');
    expect(textoXml(rodape)).toContain('EXEMPLO COMÉRCIO E SERVIÇOS LTDA — Página');
    expect(textoXml(rodape)).not.toContain('CNPJ'); // CNPJ vazio: trecho opcional some
    expect(arquivos.some((n) => n.startsWith('word/media/'))).toBe(true);

    salvarSePedido('abertura-dois-socios.docx', bytes);
  });

  it('abertura unipessoal com sócia', async () => {
    const doc = gerarAbertura(exemplo('uma-socia'));
    const bytes = await gerarDocxBytes({
      documento: doc,
      configuracoes: configuracoesPadrao(),
      camposRodape: { razao_social: 'X', cnpj: '', nire: '', titulo_ato: doc.titulo },
      usarCabecalho: false,
    });
    const { ler } = await abrir(bytes);
    const texto = textoXml(await ler('word/document.xml'));
    expect(texto).toContain('CONTRATO SOCIAL DE SOCIEDADE LIMITADA UNIPESSOAL');
    expect(texto).toContain('A sócia declara');
    expect(texto).not.toMatch(/\((a|as|o|os|ra)\)/i);
    salvarSePedido('abertura-unipessoal-socia.docx', bytes);
  });

  it('nome do arquivo e imagem do cabeçalho', () => {
    expect(nomeArquivoDocx('2026-11-03', 'Contrato social de abertura', 'PADARIA BOM PÃO LTDA')).toBe(
      '2026-11-03 - Contrato social de abertura - PADARIA BOM PÃO LTDA.docx',
    );
    expect(nomeArquivoDocx('2026-11-03', 'X', 'A/B: C')).toBe('2026-11-03 - X - A-B- C.docx');
    // 2000x350 cabe em 15 cm de largura de texto, mantendo a proporção
    const t = tamanhoImagemCabecalho(2000, 350, 15);
    expect(t.largura).toBe(567);
    expect(Math.abs(t.largura / t.altura - 2000 / 350)).toBeLessThan(0.05);
    // imagem muito alta é limitada a 3 cm de altura
    const alta = tamanhoImagemCabecalho(500, 500, 15);
    expect(alta.altura).toBe(113);
  });
});
