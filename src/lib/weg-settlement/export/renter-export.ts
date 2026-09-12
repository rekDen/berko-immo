import * as XLSX from "xlsx";
import type { Cents } from "../types";

/**
 * Nur die Felder, die dieser Export tatsächlich braucht — bewusst keine
 * `types.ts`-Typen (`CostTypeBreakdown`, `UnitInfoBlock`), da deren
 * `Dec`-Felder (weight, exactShare, landlordSharePct) nach dem
 * JSON-Snapshot-Roundtrip (s. documents/route.ts) nicht mehr als `Decimal`,
 * sondern als `number` vorliegen und hier ohnehin ungenutzt sind.
 */
export interface RenterExportCostTypeBreakdown {
  costTypeId: string;
  direction: "expense" | "income";
  perUnit: { unitId: string; amount: Cents }[];
}

export interface RenterExportUnitInfo {
  par35a: { category: string; amount: Cents }[];
  co2: { amount: Cents; landlordSharePct: number | null }[];
}

/**
 * CSV/XLSX-Export je Einheit für vermietende Eigentümer (Spec 8.3): Kostenarten
 * mit BetrKV-Nummer und Umlagefähigkeit, dazu § 35a-Beträge und CO2-Kosten.
 * Reine Funktionen über bereits berechnete `SettlementResult`-Daten — kein
 * eigener Rechenschritt, nur Zusammenstellung/Formatierung einer bestehenden
 * Ergebnismenge.
 */

export interface RenterExportCostTypeMeta {
  name: string;
  betrkvNo: number | null;
  apportionable: boolean;
}

export interface RenterExportRow {
  position: string;
  betrkvNo: number | null;
  apportionable: string; // "ja" | "nein" | "–"
  amountCents: Cents;
}

const PAR35A_LABELS: Record<string, string> = {
  household_employment: "§ 35a: Haushaltsnahes Beschäftigungsverhältnis",
  household_service: "§ 35a: Haushaltsnahe Dienstleistung",
  craftsman: "§ 35a: Handwerkerleistung",
};

export function buildRenterExportRows(
  unitId: string,
  costTypeBreakdowns: RenterExportCostTypeBreakdown[],
  unitInfo: RenterExportUnitInfo,
  costTypeMetaById: Map<string, RenterExportCostTypeMeta>,
): RenterExportRow[] {
  const rows: RenterExportRow[] = [];

  for (const breakdown of costTypeBreakdowns) {
    if (breakdown.direction !== "expense") continue;
    const perUnit = breakdown.perUnit.find((p) => p.unitId === unitId);
    if (!perUnit || perUnit.amount === 0) continue;
    const meta = costTypeMetaById.get(breakdown.costTypeId);
    rows.push({
      position: meta?.name ?? breakdown.costTypeId,
      betrkvNo: meta?.betrkvNo ?? null,
      apportionable: meta ? (meta.apportionable ? "ja" : "nein") : "–",
      amountCents: perUnit.amount,
    });
  }

  for (const share of unitInfo.par35a) {
    rows.push({ position: PAR35A_LABELS[share.category] ?? share.category, betrkvNo: null, apportionable: "–", amountCents: share.amount });
  }

  for (const co2 of unitInfo.co2) {
    const label = co2.landlordSharePct !== null
      ? `CO2-Kosten (Vermieteranteil ${co2.landlordSharePct.toFixed(0)} %)`
      : "CO2-Kosten";
    rows.push({ position: label, betrkvNo: null, apportionable: "–", amountCents: co2.amount });
  }

  return rows;
}

function formatEuroDE(cents: Cents): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Semikolon-getrennt, Komma als Dezimaltrenner — deutsche Excel-Konvention für den
 * Doppelklick-Öffnen-Fall (Zielgruppe: vermietende Eigentümer / deren Steuerberater). */
export function renterExportToCsv(rows: RenterExportRow[]): string {
  const escape = (s: string) => s.replace(/"/g, '""');
  const header = ["Position", "BetrKV-Nr.", "Umlagefähig", "Betrag (EUR)"].map((h) => `"${h}"`).join(";");
  const lines = rows.map((r) =>
    [`"${escape(r.position)}"`, r.betrkvNo ?? "", r.apportionable, formatEuroDE(r.amountCents)].join(";"),
  );
  return [header, ...lines].join("\r\n");
}

export function renterExportToXlsxBuffer(rows: RenterExportRow[], sheetName: string): Buffer {
  const data = rows.map((r) => ({
    Position: r.position,
    "BetrKV-Nr.": r.betrkvNo ?? "",
    "Umlagefähig": r.apportionable,
    "Betrag (EUR)": Math.round(r.amountCents) / 100,
  }));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31) || "Export");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
