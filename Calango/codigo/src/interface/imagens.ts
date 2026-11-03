// Leitura de imagens de cabeçalho (tipo e tamanho em pixels).

import type { Repositorio } from '../armazenamento/repositorio';
import type { ImagemCabecalho } from '../docx/gerarDocx';

export function tipoDaImagem(b: Uint8Array): 'png' | 'jpg' | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  return null;
}

export async function dimensoes(b: Uint8Array, tipo: 'png' | 'jpg'): Promise<{ largura: number; altura: number }> {
  const blob = new Blob([b as BlobPart], { type: tipo === 'png' ? 'image/png' : 'image/jpeg' });
  const bmp = await createImageBitmap(blob);
  const r = { largura: bmp.width, altura: bmp.height };
  bmp.close();
  return r;
}

export async function carregarImagemCabecalho(repo: Repositorio, nome: string): Promise<ImagemCabecalho | null> {
  if (!nome) return null;
  const dados = await repo.lerImagem(nome);
  if (!dados) return null;
  const tipo = tipoDaImagem(dados);
  if (!tipo) return null;
  const { largura, altura } = await dimensoes(dados, tipo);
  return { dados, tipo, largura, altura };
}

export function urlDaImagem(img: ImagemCabecalho): string {
  return URL.createObjectURL(new Blob([img.dados as BlobPart], { type: img.tipo === 'png' ? 'image/png' : 'image/jpeg' }));
}
