// Preparação dos arquivos escolhidos (fotos e PDFs) para envio à IA.

import { ErroIA, type ArquivoParaLeitura, type TipoMime } from './tipos';

export const MAX_ARQUIVOS = 6;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_IMAGEM_ORIGINAL_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;
/** Lado maior da imagem enviada: nítido o bastante para ler números pequenos. */
const LADO_MAXIMO_PX = 2000;
/** Imagens até este tamanho (e dentro do lado máximo) vão como estão. */
const IMAGEM_SEM_REDUZIR_BYTES = 1_500_000;

export const ACEITOS = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.pdf';

/** Reconhece o tipo pelo conteúdo (o Windows nem sempre informa o tipo certo). */
export function detectarTipo(b: Uint8Array): TipoMime | 'heic' | null {
  const ini = (...x: number[]) => x.every((v, i) => b[i] === v);
  if (ini(0x25, 0x50, 0x44, 0x46)) return 'application/pdf'; // %PDF
  if (ini(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (ini(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (ini(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (ini(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  // HEIC/HEIF (fotos de iPhone): "ftyp" + marca heic/heix/mif1...
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const marca = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(marca)) return 'heic';
  }
  return null;
}

export function paraBase64(b: Uint8Array): string {
  let s = '';
  const passo = 0x8000;
  for (let i = 0; i < b.length; i += passo) s += String.fromCharCode(...b.subarray(i, i + passo));
  return btoa(s);
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Confere quantidade e tamanho total antes do envio. */
export function conferirLote(arquivos: ArquivoParaLeitura[]): void {
  if (!arquivos.length) throw new ErroIA('arquivo', 'Escolha pelo menos um arquivo (foto ou PDF do documento).');
  if (arquivos.length > MAX_ARQUIVOS) throw new ErroIA('arquivo', `Envie no máximo ${MAX_ARQUIVOS} arquivos de cada vez.`);
  const total = arquivos.reduce((s, a) => s + a.bytes, 0);
  if (total > MAX_TOTAL_BYTES) {
    throw new ErroIA('tamanho', `Os arquivos somam ${tamanhoLegivel(total)}, mais do que o limite de ${tamanhoLegivel(MAX_TOTAL_BYTES)} por envio. Envie menos arquivos, ou PDFs menores.`);
  }
}

/** Lê um arquivo escolhido pelo usuário e o deixa pronto para envio. */
export async function prepararArquivo(arquivo: File): Promise<ArquivoParaLeitura> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = detectarTipo(bytes);
  if (tipo === 'heic') {
    throw new ErroIA('arquivo', `“${arquivo.name}” está no formato HEIC (foto de iPhone), que o navegador não abre. No iPhone, envie a foto como JPG (ou tire um print da foto) e tente de novo.`);
  }
  if (!tipo) throw new ErroIA('arquivo', `“${arquivo.name}” não é uma foto (JPG, PNG, WEBP) nem um PDF. Escolha a foto ou o PDF do documento.`);
  if (tipo === 'application/pdf') {
    if (bytes.length > MAX_PDF_BYTES) throw new ErroIA('tamanho', `O PDF “${arquivo.name}” tem ${tamanhoLegivel(bytes.length)}; o limite é ${tamanhoLegivel(MAX_PDF_BYTES)}. Envie só as páginas do documento.`);
    return { nome: arquivo.name, tipo, base64: paraBase64(bytes), bytes: bytes.length };
  }
  if (bytes.length > MAX_IMAGEM_ORIGINAL_BYTES) throw new ErroIA('tamanho', `A imagem “${arquivo.name}” é grande demais (${tamanhoLegivel(bytes.length)}).`);
  const reduzida = await reduzirImagem(bytes, tipo, arquivo.name);
  return { nome: arquivo.name, ...reduzida };
}

/** Reduz fotos grandes (celulares geram 4000 px ou mais) para enviar menos dados. */
async function reduzirImagem(bytes: Uint8Array, tipo: TipoMime, nome: string): Promise<{ tipo: TipoMime; base64: string; bytes: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: tipo }));
  } catch {
    throw new ErroIA('arquivo', `Não foi possível abrir a imagem “${nome}”. O arquivo pode estar corrompido; tente outra foto.`);
  }
  try {
    const lado = Math.max(bitmap.width, bitmap.height);
    if (lado <= LADO_MAXIMO_PX && bytes.length <= IMAGEM_SEM_REDUZIR_BYTES && tipo !== 'image/gif') {
      return { tipo, base64: paraBase64(bytes), bytes: bytes.length };
    }
    const escala = Math.min(1, LADO_MAXIMO_PX / lado);
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.88));
    if (!blob) throw new Error('toBlob');
    const saida = new Uint8Array(await blob.arrayBuffer());
    return { tipo: 'image/jpeg', base64: paraBase64(saida), bytes: saida.length };
  } catch (e) {
    if (e instanceof ErroIA) throw e;
    // Sem conseguir reduzir: envia a original, se couber.
    if (bytes.length <= 5 * 1024 * 1024) return { tipo, base64: paraBase64(bytes), bytes: bytes.length };
    throw new ErroIA('tamanho', `Não foi possível reduzir a imagem “${nome}”, e ela é grande demais para enviar. Tente uma foto menor.`);
  } finally {
    bitmap.close();
  }
}
