import Decimal from "decimal.js";
import type { Cents, Dec } from "./types";

export type AllocationWeight = { unitId: string; sortKey: string; weight: Dec };

/**
 * Natürliche Sortierung des Sortierschlüssels (Einheitennummer), Spec 5.11.3:
 * "W2" < "W10", nicht lexikographisch ("W10" < "W2"). Zerlegt den String in
 * numerische und nicht-numerische Abschnitte und vergleicht abschnittsweise.
 */
export function naturalCompare(a: string, b: string): number {
  const re = /(\d+|\D+)/g;
  const aParts = a.match(re) ?? [a];
  const bParts = b.match(re) ?? [b];
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ap = aParts[i] ?? "";
    const bp = bParts[i] ?? "";
    if (ap === bp) continue;
    const an = /^\d+$/.test(ap) ? Number(ap) : null;
    const bn = /^\d+$/.test(bp) ? Number(bp) : null;
    if (an !== null && bn !== null) {
      if (an !== bn) return an - bn;
      continue;
    }
    return ap < bp ? -1 : 1;
  }
  return 0;
}

/**
 * Zentrale Verteilungsfunktion (Spec 5.11, Kapitel 7). Rein, deterministisch:
 * keine DB/Datei/Netzwerk/Systemzeit/Zufall (harte Regel 0.3.2).
 *
 * 1. Exakter Anteil je Einheit: Betrag × Gewicht / Σ Gewichte (dezimal).
 * 2. Abrunden auf ganze Cent (Betrag als Absolutwert, Vorzeichen am Ende).
 * 3. Restcents nach größtem Nachkommarest (Hare-Niemeyer); bei Gleichstand
 *    nach kleinerem Sortierschlüssel (natürlich sortiert).
 * 4. Invarianten: Σ Anteile = Betrag exakt; jeder Anteil weicht um weniger
 *    als 1 Cent vom exakten Anteil ab.
 */
export function allocate(total: Cents, weights: ReadonlyArray<AllocationWeight>): ReadonlyMap<string, Cents> {
  if (!Number.isSafeInteger(total)) {
    throw new Error("allocate(): total muss ein ganzzahliger Cent-Betrag sein");
  }
  if (weights.length === 0) return new Map();

  if (total === 0) {
    return new Map(weights.map((w) => [w.unitId, 0]));
  }

  const sumWeights = weights.reduce((s, w) => s.plus(w.weight), new Decimal(0));
  if (sumWeights.isZero()) {
    throw new Error(
      "allocate(): Summe der Gewichte ist 0, aber der zu verteilende Betrag ist ungleich 0 (Spec 5.3.3 — blockierender Fehler, außerhalb dieser Funktion zu behandeln)",
    );
  }

  const sign = total < 0 ? -1 : 1;
  const absTotal = new Decimal(Math.abs(total));

  const withExact = weights.map((w) => ({
    unitId: w.unitId,
    sortKey: w.sortKey,
    exact: absTotal.times(w.weight).dividedBy(sumWeights),
  }));

  const withFloor = withExact.map((e) => ({ ...e, floor: e.exact.floor() }));
  const allocated = withFloor.reduce((s, f) => s.plus(f.floor), new Decimal(0));
  const remainder = absTotal.minus(allocated).toNumber();

  const ranked = withFloor
    .map((f) => ({ ...f, frac: f.exact.minus(f.floor) }))
    .sort((a, b) => {
      const cmp = b.frac.comparedTo(a.frac);
      if (cmp !== 0) return cmp;
      return naturalCompare(a.sortKey, b.sortKey);
    });

  const result = new Map<string, Cents>();
  for (const f of withFloor) result.set(f.unitId, f.floor.toNumber());
  for (let i = 0; i < remainder; i++) {
    const unitId = ranked[i].unitId;
    result.set(unitId, (result.get(unitId) ?? 0) + 1);
  }

  if (sign < 0) {
    for (const [unitId, cents] of result) result.set(unitId, -cents);
  }

  return result;
}
