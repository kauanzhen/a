/**
 * Datas contábeis são guardadas como texto ISO "AAAA-MM-DD" (sem horário),
 * para não sofrer com fuso horário. A exibição é sempre dd/mm/aaaa.
 */
export type DataISO = string;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function dataValida(ano: number, mes: number, dia: number): boolean {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return false;
  if (ano < 1900 || ano > 2999 || mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= ultimoDiaDoMes(ano, mes);
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function montarISO(ano: number, mes: number, dia: number): DataISO {
  return `${pad(ano, 4)}-${pad(mes)}-${pad(dia)}`;
}

export function ehISO(s: unknown): s is DataISO {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  return dataValida(a, m, d);
}

/** "2026-01-31" -> "31/01/2026" */
export function formatarData(iso: DataISO | undefined | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Timestamp ISO completo -> "31/01/2026 14:05" (horário local) */
export function formatarDataHora(timestamp: string | undefined | null): string {
  if (!timestamp) return '';
  const dt = new Date(timestamp);
  if (Number.isNaN(dt.getTime())) return '';
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

/**
 * Interpreta datas digitadas: "31/01/2026", "31/1/26", "31012026", "2026-01-31".
 * Ano com 2 dígitos é tratado como 20xx. Retorna null se inválida.
 */
export function interpretarData(entrada: string | null | undefined): DataISO | null {
  if (!entrada) return null;
  const s = String(entrada).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) {
    const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return dataValida(a, mes, d) ? montarISO(a, mes, d) : null;
  }
  let partes: [string, string, string] | null = null;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) partes = [m[1], m[2], m[3]];
  else if (/^\d{8}$/.test(s) || /^\d{6}$/.test(s)) partes = [s.slice(0, 2), s.slice(2, 4), s.slice(4)];
  if (!partes) return null;
  const d = Number(partes[0]);
  const mes = Number(partes[1]);
  let a = Number(partes[2]);
  if (partes[2].length === 2) a += 2000;
  return dataValida(a, mes, d) ? montarISO(a, mes, d) : null;
}

/** Número de série de data do Excel (sistema 1900) -> ISO. 45658 = 01/01/2025 */
export function serialExcelParaISO(serial: number): DataISO | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const dias = Math.floor(serial);
  // 25569 = 01/01/1970 no sistema 1900 do Excel (já considera o falso 29/02/1900)
  const ms = (dias - 25569) * 86400000;
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return null;
  return montarISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function isoParaSerialExcel(iso: DataISO): number {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86400000 + 25569;
}

/** Data de hoje no fuso local, em ISO. */
export function hojeISO(): DataISO {
  const dt = new Date();
  return montarISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function agoraTimestamp(): string {
  return new Date().toISOString();
}

/** "2026-03-15" -> "2026-03" */
export function competenciaDe(iso: DataISO): string {
  return iso.slice(0, 7);
}

/** "2026-03" -> "03/2026" */
export function formatarCompetencia(comp: string): string {
  const [a, m] = comp.split('-');
  return `${m}/${a}`;
}

const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function nomeMes(mes: number): string {
  return NOMES_MESES[mes - 1] ?? '';
}

/** "2026-03" -> "março/2026" */
export function competenciaPorExtenso(comp: string): string {
  const [a, m] = comp.split('-').map(Number);
  return `${nomeMes(m)}/${a}`;
}

export function inicioDaCompetencia(comp: string): DataISO {
  return `${comp}-01`;
}

export function fimDaCompetencia(comp: string): DataISO {
  const [a, m] = comp.split('-').map(Number);
  return montarISO(a, m, ultimoDiaDoMes(a, m));
}

/** Soma meses a uma competência "AAAA-MM". */
export function somarMeses(comp: string, meses: number): string {
  const [a, m] = comp.split('-').map(Number);
  const total = a * 12 + (m - 1) + meses;
  return `${pad(Math.floor(total / 12), 4)}-${pad((total % 12) + 1)}`;
}

/** Lista as competências de "inicio" a "fim" (inclusive). */
export function competenciasEntre(inicio: string, fim: string): string[] {
  const lista: string[] = [];
  let atual = inicio;
  let guarda = 0;
  while (atual <= fim && guarda < 1200) {
    lista.push(atual);
    atual = somarMeses(atual, 1);
    guarda++;
  }
  return lista;
}

/** Ajusta o dia para caber no mês (ex.: dia 31 em fevereiro -> 28/29). */
export function dataNaCompetencia(comp: string, dia: number): DataISO {
  const [a, m] = comp.split('-').map(Number);
  return montarISO(a, m, Math.min(Math.max(1, dia), ultimoDiaDoMes(a, m)));
}
