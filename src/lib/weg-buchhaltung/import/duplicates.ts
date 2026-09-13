import { createHash } from "crypto";
import type { NormalizedEntry, RowWithDuplicateFlag } from "./types";

/**
 * Verwendungszweck-Hash: normalisiert (trim, lowercase, Whitespace kollabiert)
 * und hasht deterministisch. Keine Zufallswerte, keine Systemzeit (weg-
 * buchhaltung-spec.md 0.3, Duplikaterkennung B5.5).
 */
export function purposeHash(purpose: string | null): string {
  const normalized = (purpose ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * B5.5: bevorzugt die Bankreferenz, sofern sie im Batch eindeutig ist;
 * andernfalls ein Hash aus Konto-IBAN, Buchungstag, Betrag, Gegen-IBAN,
 * Ende-zu-Ende-Referenz und Verwendungszweck, ergänzt um eine laufende
 * Nummer je gleichem Hash (in Reihenfolge des Arrays) — damit bleiben zwei
 * legitime, gleich aussehende Zahlungen am selben Tag zwei Umsätze, während
 * derselbe Umsatz aus einem überlappenden Auszug (gleiche relative
 * Reihenfolge vorausgesetzt) erkannt wird.
 */
export function computeDedupKeys(entries: NormalizedEntry[], accountIban: string | null): string[] {
  const bankRefCounts = new Map<string, number>();
  for (const e of entries) {
    if (e.bankRef) bankRefCounts.set(e.bankRef, (bankRefCounts.get(e.bankRef) ?? 0) + 1);
  }

  const baseHashOccurrence = new Map<string, number>();
  return entries.map((e) => {
    if (e.bankRef && bankRefCounts.get(e.bankRef) === 1) {
      return `ref:${e.bankRef}`;
    }
    const baseHash = createHash("sha256")
      .update(
        [
          accountIban ?? "",
          e.bookingDate,
          e.amount,
          (e.counterpartyIban ?? "").toUpperCase(),
          e.endToEndId ?? "",
          purposeHash(e.purpose),
        ].join("|"),
      )
      .digest("hex");
    const occurrence = baseHashOccurrence.get(baseHash) ?? 0;
    baseHashOccurrence.set(baseHash, occurrence + 1);
    return `hash:${baseHash}#${occurrence}`;
  });
}

/**
 * Markiert Zeilen als Duplikat, wenn ihr Dedup-Key bereits unter den
 * bestehenden Buchungen dieses Kontos vorkommt (B5.5). Reine Funktion — die
 * Menge bestehender Keys wird vom Aufrufer aus der DB geladen, nicht hier.
 */
export function markDuplicates(
  entries: NormalizedEntry[],
  accountIban: string | null,
  existingDedupKeys: Set<string>,
): RowWithDuplicateFlag[] {
  const dedupKeys = computeDedupKeys(entries, accountIban);
  return entries.map((entry, i) => ({
    ...entry,
    dedupKey: dedupKeys[i],
    isDuplicate: existingDedupKeys.has(dedupKeys[i]),
  }));
}
