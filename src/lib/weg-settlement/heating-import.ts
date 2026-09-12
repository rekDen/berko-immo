import Decimal from "decimal.js";
import { parseAmountToCents } from "@/lib/weg-buchhaltung/import/amount";
import type { Cents, Dec } from "./types";

/**
 * Heizkostenimport (Spec 5.5.5): liest CSV/XLSX mit konfigurierbarem
 * Spalten-Mapping je Messdienst. Reine Funktion über bereits tabellarisierte
 * Zeilen (Header-benannte Objekte) — das Einlesen der Rohdatei (Datei-Typ,
 * `xlsx`-Bibliothek) ist Aufgabe des Aufrufers (API-Route), analog zum
 * Trennungsmuster in `src/lib/weg-buchhaltung/import/csv.ts`.
 *
 * Erkennt Spaltennamen case-insensitiv über eine feste Alias-Liste statt
 * eines pflegbaren Mapping-Profils je Messdienst (Spec sieht Letzteres vor;
 * hier bewusst vereinfacht — s. hausgeldabrechnung-plan.md, M3-Abschnitt).
 */

export interface HeatingImportRow {
  unitLabel: string; // Rohwert aus der Spalte, wird vom Aufrufer auf unitId gemappt
  heating: Cents;
  hotWater: Cents;
  co2Cost?: Cents;
  co2LandlordSharePct?: Dec;
  laborAmount?: Cents;
}

export interface ParsedHeatingImport {
  rows: HeatingImportRow[];
  errors: string[]; // "Zeile 3: ..."
  total: Cents; // Σ heating + hotWater über alle fehlerfreien Zeilen
}

const HEADER_ALIASES: Record<string, string[]> = {
  unit: ["einheit", "unit", "wohnung", "whg", "einheitennummer", "unit_number", "unitnumber"],
  heating: ["heizung", "heizkosten", "heating"],
  hotWater: ["warmwasser", "ww", "hotwater", "hot_water"],
  co2Cost: ["co2", "co2-kosten", "co2kosten", "co2_cost", "co2cost"],
  co2LandlordSharePct: ["vermieteranteil", "vermieteranteilco2", "landlordshare", "co2_landlord_share_pct", "co2landlordsharepct"],
  laborAmount: ["lohnanteil", "labor", "labor_amount", "laboramount"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s._-]+/g, "");
}

function findColumn(headers: string[], field: keyof typeof HEADER_ALIASES): string | null {
  const aliases = HEADER_ALIASES[field].map(normalizeHeader);
  for (const h of headers) {
    if (aliases.includes(normalizeHeader(h))) return h;
  }
  return null;
}

// `parseAmountToCents` liest nur Ziffern aus dem String heraus und behandelt
// Text ohne jede Ziffer stillschweigend als 0 (nicht ihr Fehlverhalten — sie
// ist für Bank-CSV-Spalten gedacht, die per Definition Beträge enthalten).
// Für einen Datei-Import mit unbekannter Datenqualität ist das hier zu
// riskant: eine verunglückte Zelle würde sonst lautlos zu 0,00 € Heizkosten
// für eine Einheit. Deshalb vorab prüfen, dass die Zelle überhaupt wie eine
// Zahl aussieht.
const NUMERIC_CELL = /^[+-]?\(?[\d.,\s]+\)?$/;

function cellToCents(value: string | number | undefined): Cents | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Math.round(value * 100);
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (!NUMERIC_CELL.test(trimmed)) throw new Error(`Ungültiger Betrag: ${trimmed}`);
  return parseAmountToCents(trimmed, trimmed.includes(",") ? "," : ".");
}

function cellToDecimal(value: string | number | undefined): Dec | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return new Decimal(value);
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return undefined;
  const n = new Decimal(trimmed);
  return n;
}

export function parseHeatingRows(rawRows: Record<string, string | number>[]): ParsedHeatingImport {
  if (rawRows.length === 0) return { rows: [], errors: ["Datei enthält keine Datenzeilen"], total: 0 };

  const headers = Object.keys(rawRows[0]);
  const unitCol = findColumn(headers, "unit");
  const heatingCol = findColumn(headers, "heating");
  const hotWaterCol = findColumn(headers, "hotWater");
  const co2CostCol = findColumn(headers, "co2Cost");
  const co2ShareCol = findColumn(headers, "co2LandlordSharePct");
  const laborCol = findColumn(headers, "laborAmount");

  const errors: string[] = [];
  if (!unitCol) errors.push(`Spalte für Einheit nicht gefunden (erwartet z. B. eine von: ${HEADER_ALIASES.unit.join(", ")})`);
  if (!heatingCol) errors.push(`Spalte für Heizung nicht gefunden (erwartet z. B. eine von: ${HEADER_ALIASES.heating.join(", ")})`);
  if (!hotWaterCol) errors.push(`Spalte für Warmwasser nicht gefunden (erwartet z. B. eine von: ${HEADER_ALIASES.hotWater.join(", ")})`);
  if (errors.length > 0) return { rows: [], errors, total: 0 };

  const rows: HeatingImportRow[] = [];
  let total = 0;

  rawRows.forEach((raw, i) => {
    const lineNo = i + 2; // Zeile 1 = Header
    const unitLabel = String(raw[unitCol!] ?? "").trim();
    if (!unitLabel) {
      errors.push(`Zeile ${lineNo}: Einheit fehlt`);
      return;
    }
    try {
      const heating = cellToCents(raw[heatingCol!]) ?? 0;
      const hotWater = cellToCents(raw[hotWaterCol!]) ?? 0;
      const co2Cost = co2CostCol ? cellToCents(raw[co2CostCol]) : undefined;
      const co2LandlordSharePct = co2ShareCol ? cellToDecimal(raw[co2ShareCol]) : undefined;
      const laborAmount = laborCol ? cellToCents(raw[laborCol]) : undefined;

      rows.push({ unitLabel, heating, hotWater, co2Cost, co2LandlordSharePct, laborAmount });
      total += heating + hotWater;
    } catch (e) {
      errors.push(`Zeile ${lineNo}: ${e instanceof Error ? e.message : "ungültiger Wert"}`);
    }
  });

  return { rows, errors, total };
}
