// Datas guardadas sempre como texto "AAAA-MM-DD".

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function dataValida(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (me < 1 || me > 12 || d < 1) return false;
  const dias = new Date(Date.UTC(a, me, 0)).getUTCDate();
  return d <= dias;
}

/** "2026-11-03" -> "03/11/2026" */
export function formatarData(iso: string): string {
  if (!dataValida(iso)) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** "03/11/2026" -> "2026-11-03" (ou null) */
export function lerDataBR(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return dataValida(iso) ? iso : null;
}

/** "2026-11-03" -> "3 de novembro de 2026"; dia 1 vira "1º". */
export function dataPorExtenso(iso: string): string {
  if (!dataValida(iso)) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dia = d === 1 ? '1º' : String(d);
  return `${dia} de ${MESES[m - 1]} de ${a}`;
}

/** "01-01" (MM-DD) -> "1º de janeiro" */
export function diaMesPorExtenso(mmdd: string): string {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd ?? '');
  if (!m) return '';
  const mes = Number(m[1]);
  const dia = Number(m[2]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return '';
  return `${dia === 1 ? '1º' : dia} de ${MESES[mes - 1]}`;
}

/** Data de hoje (fuso local) como "AAAA-MM-DD". */
export function hojeISO(agora: Date = new Date()): string {
  const a = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

/** Diferença em dias entre duas datas ISO (b - a). */
export function diasEntre(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((tb - ta) / 86400000);
}
