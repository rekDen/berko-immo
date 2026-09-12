import { parseAmountToCents } from "./amount";
import type { CsvMapping, ParsedRow } from "./types";

/** Splittet eine CSV-Zeile, unterstützt einfache Anführungszeichen-Quotierung ("a;b" -> ein Feld). */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function parseDate(raw: string, format: "iso" | "de"): string {
  const s = raw.trim();
  if (format === "iso") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Ungültiges ISO-Datum: ${raw}`);
    return s;
  }
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) throw new Error(`Ungültiges Datum (erwartet TT.MM.JJJJ): ${raw}`);
  const [, day, month, year] = m;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Parst ein generisches CSV mit konfigurierbarem Spalten-Mapping (weg-
 * buchhaltung-spec.md 5.3.5). Reine Funktion: gleiche Eingabe (Inhalt +
 * Mapping) ergibt immer dasselbe Ergebnis. Keine Datei-/DB-Zugriffe hier —
 * der Aufrufer liest die Datei und übergibt den Textinhalt.
 */
export function parseCsv(content: string, mapping: CsvMapping): ParsedRow[] {
  const delimiter = mapping.delimiter ?? ";";
  const lines = content.split(/\r\n|\r|\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0], delimiter);
  const colIndex = (name: string): number => {
    const idx = header.indexOf(name);
    if (idx === -1) throw new Error(`Spalte nicht gefunden: ${name}`);
    return idx;
  };

  const dateIdx = colIndex(mapping.dateColumn);
  const amountIdx = colIndex(mapping.amountColumn);
  const purposeIdx = mapping.purposeColumn ? colIndex(mapping.purposeColumn) : -1;
  const ibanIdx = mapping.counterpartyIbanColumn ? colIndex(mapping.counterpartyIbanColumn) : -1;

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i], delimiter);
    rows.push({
      bookingDate: parseDate(fields[dateIdx], mapping.dateFormat),
      amount: parseAmountToCents(fields[amountIdx], mapping.decimalSeparator),
      purpose: purposeIdx >= 0 ? (fields[purposeIdx] || null) : null,
      counterpartyIban: ibanIdx >= 0 ? (fields[ibanIdx] || null) : null,
    });
  }
  return rows;
}
