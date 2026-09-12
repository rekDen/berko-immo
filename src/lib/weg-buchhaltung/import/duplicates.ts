import { createHash } from "crypto";
import type { ExistingSignature, ParsedRow, RowWithDuplicateFlag } from "./types";

/**
 * Verwendungszweck-Hash: normalisiert (trim, lowercase, Whitespace kollabiert)
 * und hasht deterministisch. Keine Zufallswerte, keine Systemzeit (weg-
 * buchhaltung-spec.md 0.3, Duplikaterkennung 5.3.4).
 */
export function purposeHash(purpose: string | null): string {
  const normalized = (purpose ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Markiert Zeilen als Duplikat, wenn dieselbe Kombination aus Buchungstag,
 * Betrag und Verwendungszweck-Hash bereits als bestehende Buchung vorliegt
 * (weg-buchhaltung-spec.md 5.3.4). Reine Funktion — die Liste bestehender
 * Signaturen wird vom Aufrufer aus der DB geladen, nicht hier.
 */
export function markDuplicates(rows: ParsedRow[], existing: ExistingSignature[]): RowWithDuplicateFlag[] {
  const existingKeys = new Set(existing.map((e) => `${e.bookingDate}|${e.amount}|${e.purposeHash}`));
  return rows.map((row) => ({
    ...row,
    isDuplicate: existingKeys.has(`${row.bookingDate}|${row.amount}|${purposeHash(row.purpose)}`),
  }));
}
