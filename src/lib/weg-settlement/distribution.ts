import Decimal from "decimal.js";
import type { Cents, CostBooking, CostTypeDef, Dec, EngineUnit } from "./types";
import { allocate, type AllocationWeight } from "./allocation";

/**
 * Trennt Direktbelastungen (5.3.5: 100% einer Einheit) von poolierten
 * Beträgen, die per Schlüssel verteilt werden. Generisch über die
 * Betrags-Extraktion, damit sowohl Kostenart-Gesamtbeträge als auch
 * § 35a-Lohnanteile (beides potenziell direktbelastet) dieselbe Regel
 * verwenden (5.3.5 gilt für die Kostenart insgesamt, ein Lohnanteil einer
 * direktbelasteten Buchung ist notwendig ebenfalls direkt der Einheit
 * zuzuordnen).
 */
export function splitDirectAndPooled<T extends { id: string; directUnitId?: string }>(
  bookings: readonly T[],
  amountOf: (b: T) => Cents,
  allowsDirectCharge: boolean,
): { perUnitDirect: Map<string, Cents>; pooled: Cents; pooledIds: string[]; directChargeErrors: string[] } {
  const perUnitDirect = new Map<string, Cents>();
  const directChargeErrors: string[] = [];
  let pooled = 0;
  const pooledIds: string[] = [];

  for (const b of bookings) {
    const amount = amountOf(b);
    if (amount === 0) continue;
    if (b.directUnitId) {
      if (!allowsDirectCharge) directChargeErrors.push(b.id);
      perUnitDirect.set(b.directUnitId, (perUnitDirect.get(b.directUnitId) ?? 0) + amount);
    } else {
      pooled += amount;
      pooledIds.push(b.id);
    }
  }

  return { perUnitDirect, pooled, pooledIds, directChargeErrors };
}

export interface CostTypeDistribution {
  costTypeId: string;
  total: Cents;
  perUnit: Map<string, Cents>;
  exactPerUnit: Map<string, Dec>; // nur für den poolierten Anteil (Nachvollziehbarkeit, Kapitel 7)
  weightPerUnit: Map<string, Dec>; // Schlüsselgewicht je Einheit ("Wert der Einheit", Kapitel 7/8.3)
  sourceBookingIds: Map<string, string[]>;
  directChargeErrors: string[];
  blockedZeroWeight: boolean; // Schlüssel-Gesamtgewicht 0, aber gepoolter Betrag != 0 (8.2 C04)
}

/** Verteilt eine (nicht heizkostenpflichtige) Kostenart nach 5.3 auf alle Einheiten. */
export function distributeCostType(
  costType: CostTypeDef,
  bookings: readonly CostBooking[],
  weights: ReadonlyArray<AllocationWeight>,
): CostTypeDistribution {
  const relevant = bookings.filter((b) => b.costTypeId === costType.id);
  const { perUnitDirect, pooled, pooledIds, directChargeErrors } = splitDirectAndPooled(
    relevant,
    (b) => b.amount,
    costType.allowsDirectCharge,
  );

  const perUnit = new Map(perUnitDirect);
  const exactPerUnit = new Map<string, Dec>();
  const sourceBookingIds = new Map<string, string[]>();
  for (const [unitId] of perUnitDirect) {
    sourceBookingIds.set(unitId, relevant.filter((b) => b.directUnitId === unitId).map((b) => b.id));
  }

  const sumWeights = weights.reduce((s, w) => s.plus(w.weight), new Decimal(0));
  let blockedZeroWeight = false;

  if (pooled !== 0) {
    if (sumWeights.isZero()) {
      // 5.3.3: Beträge ungleich 0 auf einem Schlüssel mit Gesamtgewicht 0 sind
      // ein blockierender Fehler (C04) — nicht hier werfen (der Rechenkern
      // muss trotzdem ein vollständiges, prüfbares Ergebnis liefern können),
      // sondern als Flag zurückgeben, das `runChecks()` auswertet.
      blockedZeroWeight = true;
    } else {
      const shares = allocate(pooled, weights);
      for (const [unitId, amount] of shares) {
        perUnit.set(unitId, (perUnit.get(unitId) ?? 0) + amount);
        sourceBookingIds.set(unitId, [...(sourceBookingIds.get(unitId) ?? []), ...pooledIds]);
      }

      const sign = pooled < 0 ? -1 : 1;
      for (const w of weights) {
        const exact = new Decimal(Math.abs(pooled)).times(w.weight).dividedBy(sumWeights);
        exactPerUnit.set(w.unitId, sign < 0 ? exact.negated() : exact);
      }
    }
  }

  const total = relevant.reduce((s, b) => s + b.amount, 0);
  const weightPerUnit = new Map(weights.map((w) => [w.unitId, w.weight]));
  return { costTypeId: costType.id, total, perUnit, exactPerUnit, weightPerUnit, sourceBookingIds, directChargeErrors, blockedZeroWeight };
}

/**
 * § 35a (5.9): Lohnanteile werden gruppiert nach Kategorie mit demselben
 * Schlüssel wie ihre Kostenart verteilt. Rückgabe: unitId -> Kategorie -> Cents.
 */
export function distributeLaborShares(
  costType: CostTypeDef,
  bookings: readonly CostBooking[],
  weights: ReadonlyArray<AllocationWeight>,
): Map<string, Map<string, Cents>> {
  const relevant = bookings.filter((b) => b.costTypeId === costType.id && (b.laborAmount ?? 0) > 0);
  const byCategory = new Map<string, CostBooking[]>();
  for (const b of relevant) {
    const cat = b.par35aCategory ?? "craftsman";
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), b]);
  }

  const result = new Map<string, Map<string, Cents>>();
  for (const [category, catBookings] of byCategory) {
    const { perUnitDirect, pooled, pooledIds } = splitDirectAndPooled(
      catBookings,
      (b) => b.laborAmount ?? 0,
      costType.allowsDirectCharge,
    );
    void pooledIds;

    const merge = (unitId: string, amount: number) => {
      const perUnit = result.get(unitId) ?? new Map<string, Cents>();
      perUnit.set(category, (perUnit.get(category) ?? 0) + amount);
      result.set(unitId, perUnit);
    };

    for (const [unitId, amount] of perUnitDirect) merge(unitId, amount);
    const sumWeights = weights.reduce((s, w) => s.plus(w.weight), new Decimal(0));
    if (pooled !== 0 && !sumWeights.isZero()) {
      const shares = allocate(pooled, weights);
      for (const [unitId, amount] of shares) {
        if (amount !== 0) merge(unitId, amount);
      }
    }
    // Gewichtssumme 0 bei gepooltem Lohnanteil != 0: derselbe Grundfehler wie
    // bei der zugehörigen Kostenart insgesamt (C04 dort bereits erfasst) —
    // hier bewusst nicht erneut gemeldet, um den Lohnanteil nicht zu verlieren
    // ohne einen zweiten, redundanten Check zu erzeugen.
  }

  return result;
}

export function weightsForKey(units: readonly EngineUnit[], keyWeights: ReadonlyMap<string, Dec>): AllocationWeight[] {
  return units.map((u) => ({ unitId: u.id, sortKey: u.sortKey, weight: keyWeights.get(u.id) ?? new Decimal(0) }));
}
