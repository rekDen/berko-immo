/**
 * B7.2: erzeugt für jeden Monat im Gültigkeitszeitraum eines PlanAdvance eine
 * Sollstellung (Hausgeld) mit den Komponenten Bewirtschaftung und Rücklage.
 * Pure, deterministisch — die "heute"-Grenze bei offenem Ende (`validTo =
 * null`, rollierend 12 Monate) wird vom Aufrufer als `horizonEnd` übergeben,
 * damit diese Funktion selbst keine Systemzeit liest (Spec 0.3.2).
 *
 * Alle Daten sind ISO-Strings (YYYY-MM-DD), UTC-Kalenderarithmetik.
 */
export function generateAdvanceMonths(params: {
  validFrom: string;
  validTo: string | null;
  horizonEnd: string;
  dueDayOfMonth: number; // 1..28, wird bei kürzeren Monaten geclamped
  monthlyOperating: number; // Cents
  monthlyReserve: number; // Cents
}): { periodMonth: string; dueDate: string; operating: number; reserve: number; amount: number }[] {
  const { validFrom, validTo, horizonEnd, dueDayOfMonth, monthlyOperating, monthlyReserve } = params;

  const [fromY, fromM] = validFrom.split("-").map(Number);
  const endIso = validTo && validTo < horizonEnd ? validTo : horizonEnd;
  const [endY, endM] = endIso.split("-").map(Number);

  const results: { periodMonth: string; dueDate: string; operating: number; reserve: number; amount: number }[] = [];

  let y = fromY;
  let m = fromM;
  while (y < endY || (y === endY && m <= endM)) {
    const periodMonth = `${y}-${String(m).padStart(2, "0")}-01`;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const day = Math.min(dueDayOfMonth, daysInMonth);
    const dueDate = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    results.push({
      periodMonth,
      dueDate,
      operating: monthlyOperating,
      reserve: monthlyReserve,
      amount: monthlyOperating + monthlyReserve,
    });

    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return results;
}
