import Decimal from "decimal.js";
import type { AllocationKeyValueDef, HeatingAllocationInput, SettlementInput } from "./types";

/** Wandelt jeden `Decimal` in eine Zahl um — für JSON-Speicherung (jsonb-Snapshots, Fixtures). */
export function toPlain(value: unknown): unknown {
  if (value instanceof Decimal) return value.toNumber();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([k, v]) => [k, toPlain(v)]));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
}

/**
 * Rekonstruiert `SettlementInput` aus JSON (jsonb-Snapshot oder Fixture):
 * `allocationKeyValues[].value` und `heatingAllocations[].perUnit[].co2LandlordSharePct`
 * sind die einzigen `Decimal`-Felder in `SettlementInput`.
 */
export function parseSettlementInput(raw: unknown): SettlementInput {
  const obj = raw as SettlementInput & {
    allocationKeyValues: (Omit<AllocationKeyValueDef, "value"> & { value: number })[];
    heatingAllocations: (Omit<HeatingAllocationInput, "perUnit"> & {
      perUnit: (HeatingAllocationInput["perUnit"][number] & { co2LandlordSharePct?: number })[];
    })[];
  };
  return {
    ...obj,
    allocationKeyValues: obj.allocationKeyValues.map((v) => ({ ...v, value: new Decimal(v.value) })),
    heatingAllocations: obj.heatingAllocations.map((h) => ({
      ...h,
      perUnit: h.perUnit.map((u) => ({
        ...u,
        co2LandlordSharePct: u.co2LandlordSharePct !== undefined ? new Decimal(u.co2LandlordSharePct) : undefined,
      })),
    })),
  };
}
