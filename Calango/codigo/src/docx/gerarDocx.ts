// Geração do arquivo .docx (Word) a partir do documento montado.
//
// - Página A4, margens, fonte, tamanho e espaçamento vindos das configurações.
// - Estilos NOMEADOS do Word (Título do Ato, Título de Seção, Cláusula,
//   Parágrafo, Alínea, Tabela, Assinatura...) — nada de formatação solta.
// - A numeração das cláusulas já vem como TEXTO do motor (nunca lista automática).
// - Cabeçalho com texto e/ou imagem (opção de esconder na primeira página).
// - Rodapé com texto livre e campos (página X de Y, razão social, CNPJ...).
// - Nenhum hyperlink é gerado.

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphStyleOptions,
} from 'docx';
import type { Alinhamento, CamposRodape, Configuracoes } from '../armazenamento/configuracoes';
import { interpretarRodape } from '../armazenamento/configuracoes';
import type { DocumentoMontado, ElementoDoc } from '../motor/montagem';
import type { Trecho } from '../motor/catalogo';
import type { EstiloParagrafo } from '../tipos/definicoes';
import { nomeArquivoSeguro } from '../lib/texto';

export interface ImagemCabecalho {
  dados: Uint8Array;
  tipo: 'png' | 'jpg';
  /** Tamanho original em pixels. */
  largura: number;
  altura: number;
}

export interface OpcoesDocx {
  documento: DocumentoMontado;
  configuracoes: Configuracoes;
  camposRodape: CamposRodape;
  usarCabecalho: boolean;
  imagemCabecalho?: ImagemCabecalho | null;
}

/** Tamanho recomendado da imagem de cabeçalho (faixa de ~17 × 3 cm). */
export const CABECALHO_RECOMENDADO = { largura: 2000, altura: 350, larguraCm: 17, alturaCm: 3 };

const A4 = { larguraCm: 21, alturaCm: 29.7 };
const cmParaTwip = (cm: number) => Math.round((cm / 2.54) * 1440);
const cmParaPx = (cm: number) => (cm / 2.54) * 96;

function alinhamento(a: Alinhamento) {
  return a === 'esquerda' ? AlignmentType.LEFT : a === 'direita' ? AlignmentType.RIGHT : AlignmentType.CENTER;
}

// Nome do estilo no Word para cada estilo do motor.
const ESTILOS: Record<EstiloParagrafo | 'linha_assinatura' | 'tabela', { id: string; nome: string }> = {
  titulo: { id: 'CalangoTitulo', nome: 'Título do Ato' },
  titulo_secao: { id: 'CalangoTituloSecao', nome: 'Título de Seção' },
  clausula: { id: 'CalangoClausula', nome: 'Cláusula' },
  paragrafo: { id: 'CalangoParagrafo', nome: 'Parágrafo' },
  alinea: { id: 'CalangoAlinea', nome: 'Alínea' },
  item: { id: 'CalangoItem', nome: 'Item de Lista' },
  texto: { id: 'CalangoTexto', nome: 'Texto' },
  fechamento: { id: 'CalangoFechamento', nome: 'Fechamento' },
  assinatura: { id: 'CalangoAssinatura', nome: 'Assinatura' },
  linha_assinatura: { id: 'CalangoLinhaAssinatura', nome: 'Linha de Assinatura' },
  tabela: { id: 'CalangoTabela', nome: 'Tabela' },
};

function estilosDoWord(cfg: Configuracoes): IParagraphStyleOptions[] {
  const apos = Math.round(cfg.pagina.espaco_apos_paragrafo_pt * 20);
  const linha = Math.round(cfg.pagina.espacamento_linhas * 240);
  const base = { spacing: { after: apos, line: linha, lineRule: LineRuleType.AUTO } };
  const just = { ...base, alignment: AlignmentType.JUSTIFIED };
  const tam = cfg.pagina.tamanho_pt * 2;
  return [
    { id: ESTILOS.titulo.id, name: ESTILOS.titulo.nome, basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { bold: true, size: tam + 2 }, paragraph: { ...base, alignment: AlignmentType.CENTER, keepNext: true } },
    { id: ESTILOS.titulo_secao.id, name: ESTILOS.titulo_secao.nome, basedOn: 'Normal', quickFormat: true,
      run: { bold: true }, paragraph: { spacing: { before: Math.round(apos * 1.5), after: Math.round(apos / 2), line: linha, lineRule: LineRuleType.AUTO }, keepNext: true, keepLines: true } },
    { id: ESTILOS.clausula.id, name: ESTILOS.clausula.nome, basedOn: 'Normal', quickFormat: true, paragraph: just },
    { id: ESTILOS.paragrafo.id, name: ESTILOS.paragrafo.nome, basedOn: 'Normal', quickFormat: true, paragraph: just },
    { id: ESTILOS.alinea.id, name: ESTILOS.alinea.nome, basedOn: 'Normal', quickFormat: true,
      paragraph: { ...just, indent: { left: cmParaTwip(0.75) } } },
    { id: ESTILOS.item.id, name: ESTILOS.item.nome, basedOn: 'Normal', quickFormat: true,
      paragraph: { ...just, indent: { left: cmParaTwip(1), hanging: cmParaTwip(0.4) } } },
    { id: ESTILOS.texto.id, name: ESTILOS.texto.nome, basedOn: 'Normal', quickFormat: true, paragraph: just },
    { id: ESTILOS.fechamento.id, name: ESTILOS.fechamento.nome, basedOn: 'Normal', quickFormat: true, paragraph: { ...just, keepNext: true } },
    { id: ESTILOS.assinatura.id, name: ESTILOS.assinatura.nome, basedOn: 'Normal', quickFormat: true,
      paragraph: { spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO }, alignment: AlignmentType.CENTER, keepNext: true, keepLines: true } },
    { id: ESTILOS.linha_assinatura.id, name: ESTILOS.linha_assinatura.nome, basedOn: ESTILOS.assinatura.id, quickFormat: true,
      paragraph: { spacing: { before: 960, after: 0 }, alignment: AlignmentType.CENTER, keepNext: true, keepLines: true } },
    { id: ESTILOS.tabela.id, name: ESTILOS.tabela.nome, basedOn: 'Normal', quickFormat: true,
      run: { size: Math.max(tam - 2, 14) }, paragraph: { spacing: { before: 40, after: 40, line: 240, lineRule: LineRuleType.AUTO } } },
  ];
}

function runs(trechos: Trecho[]): TextRun[] {
  return trechos.map(
    (t) => new TextRun({ text: t.texto, bold: t.negrito || undefined, highlight: t.pendente ? 'yellow' : undefined }),
  );
}

const NUMERICO = /^[\d.,%\sR$]+$/;

function larguraColunas(linhas: Trecho[][][], larguraTotal: number): number[] {
  const n = Math.max(...linhas.map((l) => l.length));
  const pesos = Array.from({ length: n }, (_, i) => {
    const max = Math.max(...linhas.map((l) => (l[i] ? l[i].map((t) => t.texto).join('').length : 0)));
    return Math.min(Math.max(max, 6), 60);
  });
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  return pesos.map((p) => Math.floor((p / soma) * larguraTotal));
}

function tabela(linhas: Trecho[][][], larguraTotal: number): Table {
  const larguras = larguraColunas(linhas, larguraTotal);
  const borda = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
  return new Table({
    width: { size: larguraTotal, type: WidthType.DXA },
    columnWidths: larguras,
    borders: { top: borda, bottom: borda, left: borda, right: borda, insideHorizontal: borda, insideVertical: borda },
    rows: linhas.map((linha, i) => {
      const cabecalho = i === 0;
      // Tabelas pequenas ficam inteiras na mesma página.
      const manterComProxima = linhas.length <= 15 && i < linhas.length - 1;
      return new TableRow({
        tableHeader: cabecalho,
        cantSplit: true,
        children: larguras.map((w, j) => {
          const trechos = linha[j] ?? [];
          const texto = trechos.map((t) => t.texto).join('');
          return new TableCell({
            width: { size: w, type: WidthType.DXA },
            shading: cabecalho ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E7E6E6' } : undefined,
            margins: { left: 80, right: 80 },
            children: [
              new Paragraph({
                style: ESTILOS.tabela.id,
                keepNext: manterComProxima || undefined,
                alignment: !cabecalho && texto && NUMERICO.test(texto) ? AlignmentType.RIGHT : AlignmentType.LEFT,
                children: runs(cabecalho ? trechos.map((t) => ({ ...t, negrito: true })) : trechos),
              }),
            ],
          });
        }),
      });
    }),
  });
}

function elementosDoCorpo(elementos: ElementoDoc[], larguraTexto: number): (Paragraph | Table)[] {
  const r: (Paragraph | Table)[] = [];
  elementos.forEach((e, i) => {
    // O parágrafo que apresenta a tabela fica na mesma página que ela.
    const antesDeTabela = elementos[i + 1]?.tipo === 'tabela';
    if (e.tipo === 'tabela') {
      r.push(tabela(e.linhas, larguraTexto));
      r.push(new Paragraph({ style: ESTILOS.texto.id, spacing: { after: 0 }, children: [] }));
    } else if (e.tipo === 'linha_assinatura') {
      r.push(new Paragraph({ style: ESTILOS.linha_assinatura.id, children: [new TextRun('____________________________________________')] }));
    } else {
      r.push(new Paragraph({ style: ESTILOS[e.estilo].id, keepNext: antesDeTabela || undefined, children: runs(e.trechos) }));
    }
  });
  return r;
}

/** Tamanho da imagem do cabeçalho em pixels (96 dpi), proporcional, cabendo na faixa. */
export function tamanhoImagemCabecalho(larguraPx: number, alturaPx: number, larguraTextoCm: number): { largura: number; altura: number } {
  const maxL = cmParaPx(Math.min(CABECALHO_RECOMENDADO.larguraCm, larguraTextoCm));
  const maxA = cmParaPx(CABECALHO_RECOMENDADO.alturaCm);
  const escala = Math.min(maxL / larguraPx, maxA / alturaPx);
  return { largura: Math.round(larguraPx * escala), altura: Math.round(alturaPx * escala) };
}

export function montarDocx(op: OpcoesDocx): Document {
  const cfg = op.configuracoes;
  const p = cfg.pagina;
  const larguraTextoCm = A4.larguraCm - p.margem_esquerda_cm - p.margem_direita_cm;
  const larguraTexto = cmParaTwip(larguraTextoCm);

  // ----- Cabeçalho -----
  const filhosCabecalho: Paragraph[] = [];
  if (op.usarCabecalho) {
    const img = op.imagemCabecalho;
    if (img) {
      const t = tamanhoImagemCabecalho(img.largura, img.altura, larguraTextoCm);
      filhosCabecalho.push(
        new Paragraph({
          alignment: alinhamento(cfg.cabecalho.alinhamento),
          children: [new ImageRun({ type: img.tipo, data: img.dados, transformation: { width: t.largura, height: t.altura } })],
        }),
      );
    }
    for (const linha of cfg.cabecalho.texto.split('\n').filter((l) => l.trim())) {
      filhosCabecalho.push(new Paragraph({ alignment: alinhamento(cfg.cabecalho.alinhamento), children: [new TextRun({ text: linha, size: Math.max(p.tamanho_pt * 2 - 2, 14) })] }));
    }
  }
  const temCabecalho = filhosCabecalho.length > 0;

  // ----- Rodapé -----
  const linhasRodape = interpretarRodape(cfg.rodape.texto, op.camposRodape);
  const rodape = () =>
    new Footer({
      children: linhasRodape.map(
        (pedacos) =>
          new Paragraph({
            alignment: alinhamento(cfg.rodape.alinhamento),
            children: pedacos.map((x) => {
              const size = Math.max(p.tamanho_pt * 2 - 4, 14);
              if (x.tipo === 'pagina') return new TextRun({ children: [PageNumber.CURRENT], size });
              if (x.tipo === 'total_paginas') return new TextRun({ children: [PageNumber.TOTAL_PAGES], size });
              return new TextRun({ text: x.texto, size });
            }),
          }),
      ),
    });

  const ocultarPrimeira = temCabecalho && cfg.cabecalho.ocultar_primeira_pagina;

  return new Document({
    creator: 'Calango',
    title: op.documento.titulo,
    description: 'Documento gerado pelo Calango — confira antes de protocolar.',
    styles: {
      default: {
        document: {
          run: { font: p.fonte, size: p.tamanho_pt * 2 },
          paragraph: { spacing: { line: Math.round(p.espacamento_linhas * 240), lineRule: LineRuleType.AUTO } },
        },
      },
      paragraphStyles: estilosDoWord(cfg),
    },
    sections: [
      {
        properties: {
          titlePage: ocultarPrimeira,
          page: {
            size: { width: cmParaTwip(A4.larguraCm), height: cmParaTwip(A4.alturaCm) },
            margin: {
              top: cmParaTwip(p.margem_superior_cm),
              bottom: cmParaTwip(p.margem_inferior_cm),
              left: cmParaTwip(p.margem_esquerda_cm),
              right: cmParaTwip(p.margem_direita_cm),
              header: cmParaTwip(1),
              footer: cmParaTwip(1),
            },
          },
        },
        headers: temCabecalho
          ? { default: new Header({ children: filhosCabecalho }), ...(ocultarPrimeira ? { first: new Header({ children: [] }) } : {}) }
          : undefined,
        footers: linhasRodape.length ? { default: rodape(), ...(ocultarPrimeira ? { first: rodape() } : {}) } : undefined,
        children: elementosDoCorpo(op.documento.elementos, larguraTexto),
      },
    ],
  });
}

export async function gerarDocxBlob(op: OpcoesDocx): Promise<Blob> {
  return Packer.toBlob(montarDocx(op));
}

export async function gerarDocxBytes(op: OpcoesDocx): Promise<Uint8Array> {
  const buf = await Packer.toBuffer(montarDocx(op));
  return new Uint8Array(buf);
}

/** "AAAA-MM-DD - Tipo do ato - Razão social.docx" */
export function nomeArquivoDocx(data: string, tipoAto: string, razaoSocial: string): string {
  return nomeArquivoSeguro(`${data} - ${tipoAto} - ${razaoSocial || 'sem razão social'}`) + '.docx';
}
