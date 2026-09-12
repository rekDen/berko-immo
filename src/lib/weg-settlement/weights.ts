import Decimal from "decimal.js";
import type { AllocationKeyValueDef, Dec, EngineUnit } from "./types";
import { daysInYear, overlapDays } from "./dates";

const FAR_FUTURE = "9999-12-31";

/**
 * Spec 5.3.2/5.3.3: Jahresgewicht einer Einheit = Σ (Wert × Gültigkeitstage
 * im Jahr) / Tage des Jahres. Einheiten ohne Schlüsselwert erhalten Gewicht 0
 * (werden hier als 0 zurückgegeben, nicht ausgelassen — `allocate()` erwartet
 * für jede beteiligte Einheit einen Eintrag, s. 5.3.3).
 */
export function computeKeyWeights(
  units: readonly EngineUnit[],
  values: readonly AllocationKeyValueDef[],
  keyId: string,
  year: number,
): Map<string, Dec> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const totalDays = daysInYear(year);

  const weights = new Map<string, Dec>();
  for (const unit of units) weights.set(unit.id, new Decimal(0));

  for (const v of values) {
    if (v.keyId !== keyId || !weights.has(v.unitId)) continue;
    const days = overlapDays(v.validFrom, v.validTo ?? FAR_FUTURE, yearStart, yearEnd);
    if (days <= 0) continue;
    const contribution = v.value.times(days).dividedBy(totalDays);
    weights.set(v.unitId, weights.get(v.unitId)!.plus(contribution));
  }

  return weights;
}
