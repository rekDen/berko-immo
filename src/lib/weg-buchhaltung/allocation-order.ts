import { allocateProportional } from "./rounding";

export type ReceivableKind = "advance" | "special_levy" | "settlement_balance" | "opening" | "other";

export type OpenReceivable = {
  id: string;
  dueDate: string; // ISO date
  kind: ReceivableKind;
  openAmount: number; // Cents, remaining unallocated amount, always > 0
};

const KIND_ORDER: Record<ReceivableKind, number> = {
  opening: 0,
  advance: 1,
  special_levy: 2,
  settlement_balance: 3,
  other: 4,
};

/**
 * B7.6 Ausgleichsreihenfolge: erkennbare Tilgungsbestimmung zuerst (falls
 * angegeben), sonst älteste Fälligkeit zuerst, bei Gleichstand nach Art,
 * zuletzt nach id (deterministischer, stabiler Tiebreak). Ein Rest bleibt
 * unallokiert (ungebundenes Guthaben, B7.6.3) — das automatische Verrechnen
 * mit der nächsten Fälligkeit passiert beim nächsten Aufruf dieser Funktion,
 * sobald diese Fälligkeit selbst offen ansteht.
 *
 * Pure, deterministisch: keine Systemzeit, keine DB, gleiche Eingabe ->
 * gleiche Ausgabe.
 */
export function pickAllocationTargets(
  openReceivables: readonly OpenReceivable[],
  paymentAmount: number,
  explicitReceivableId?: string,
): { receivableId: string; amount: number }[] {
  if (paymentAmount <= 0) return [];
  let remaining = paymentAmount;
  const result: { receivableId: string; amount: number }[] = [];

  if (explicitReceivableId) {
    const explicit = openReceivables.find((r) => r.id === explicitReceivableId);
    if (explicit && explicit.openAmount > 0) {
      const amount = Math.min(remaining, explicit.openAmount);
      result.push({ receivableId: explicit.id, amount });
      remaining -= amount;
    }
  }

  const ordered = [...openReceivables]
    .filter((r) => r.openAmount > 0 && r.id !== explicitReceivableId)
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      return a.id < b.id ? -1 : 1;
    });

  for (const r of ordered) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, r.openAmount);
    if (amount > 0) {
      result.push({ receivableId: r.id, amount });
      remaining -= amount;
    }
  }

  return result;
}

/**
 * B7.7: Teilzahlung auf eine Hausgeld-Sollstellung wird proportional auf
 * Bewirtschaftung und Rücklage verteilt (BF2-Standard). `operatingOpen`/
 * `reserveOpen` sind die jeweils noch offenen Komponenten der Receivable.
 */
export function splitAdvancePayment(
  amount: number,
  operatingOpen: number,
  reserveOpen: number,
): { operating: number; reserve: number } {
  const [operating, reserve] = allocateProportional(amount, [operatingOpen, reserveOpen]);
  return { operating, reserve };
}
