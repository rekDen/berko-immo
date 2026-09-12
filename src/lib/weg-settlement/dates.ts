/** Reine Kalenderarithmetik (ISO-Datumsstrings, UTC), keine Systemzeit. */

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function toEpochDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** Anzahl sich überschneidender Tage zweier inklusiver Datumsbereiche (>= 0). */
export function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = Math.max(toEpochDay(aStart), toEpochDay(bStart));
  const end = Math.min(toEpochDay(aEnd), toEpochDay(bEnd));
  return Math.max(0, end - start + 1);
}
