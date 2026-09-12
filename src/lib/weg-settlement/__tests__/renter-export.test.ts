import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildRenterExportRows, renterExportToCsv, renterExportToXlsxBuffer,
  type RenterExportCostTypeBreakdown, type RenterExportUnitInfo,
} from "../export/renter-export";

function breakdown(costTypeId: string, direction: "expense" | "income", amountForA: number): RenterExportCostTypeBreakdown {
  return {
    costTypeId, direction,
    perUnit: [
      { unitId: "a", amount: amountForA },
      { unitId: "b", amount: 0 },
    ],
  };
}

const emptyInfo: RenterExportUnitInfo = { par35a: [], co2: [] };

describe("buildRenterExportRows", () => {
  it("nimmt nur Ausgaben-Kostenarten mit Betrag != 0 für die Einheit auf", () => {
    const breakdowns = [breakdown("hausmeister", "expense", 12300), breakdown("zinsen", "income", 500)];
    const metaById = new Map([["hausmeister", { name: "Hausmeister", betrkvNo: 14, apportionable: true }]]);
    const rows = buildRenterExportRows("a", breakdowns, emptyInfo, metaById);
    expect(rows).toEqual([{ position: "Hausmeister", betrkvNo: 14, apportionable: "ja", amountCents: 12300 }]);
  });

  it("lässt Einheiten mit Betrag 0 aus (z. B. Einheit b im Beispiel oben)", () => {
    const breakdowns = [breakdown("hausmeister", "expense", 12300)];
    const metaById = new Map([["hausmeister", { name: "Hausmeister", betrkvNo: 14, apportionable: true }]]);
    const rows = buildRenterExportRows("b", breakdowns, emptyInfo, metaById);
    expect(rows).toEqual([]);
  });

  it("ergänzt § 35a-Zeilen und CO2-Zeilen aus dem UnitInfoBlock", () => {
    const info: RenterExportUnitInfo = {
      par35a: [{ category: "craftsman", amount: 4500 }],
      co2: [{ amount: 800, landlordSharePct: 50 }],
    };
    const rows = buildRenterExportRows("a", [], info, new Map());
    expect(rows).toEqual([
      { position: "§ 35a: Handwerkerleistung", betrkvNo: null, apportionable: "–", amountCents: 4500 },
      { position: "CO2-Kosten (Vermieteranteil 50 %)", betrkvNo: null, apportionable: "–", amountCents: 800 },
    ]);
  });

  it("markiert nicht umlagefähige Kostenarten korrekt", () => {
    const breakdowns = [breakdown("verwaltervergütung", "expense", 5000)];
    const metaById = new Map([["verwaltervergütung", { name: "Verwaltervergütung", betrkvNo: null, apportionable: false }]]);
    const rows = buildRenterExportRows("a", breakdowns, emptyInfo, metaById);
    expect(rows).toEqual([{ position: "Verwaltervergütung", betrkvNo: null, apportionable: "nein", amountCents: 5000 }]);
  });
});

describe("renterExportToCsv", () => {
  it("erzeugt Semikolon-getrennte Zeilen mit Komma als Dezimaltrenner", () => {
    const csv = renterExportToCsv([{ position: "Hausmeister", betrkvNo: 14, apportionable: "ja", amountCents: 12345 }]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Position";"BetrKV-Nr.";"Umlagefähig";"Betrag (EUR)"');
    expect(lines[1]).toBe('"Hausmeister";14;ja;123,45');
  });

  it("escaped Anführungszeichen in der Position", () => {
    const csv = renterExportToCsv([{ position: 'Sonder"posten', betrkvNo: null, apportionable: "–", amountCents: 100 }]);
    expect(csv.split("\r\n")[1]).toBe('"Sonder""posten";;–;1,00');
  });
});

describe("renterExportToXlsxBuffer", () => {
  it("erzeugt eine lesbare Arbeitsmappe mit den erwarteten Werten", () => {
    const buffer = renterExportToXlsxBuffer(
      [{ position: "Hausmeister", betrkvNo: 14, apportionable: "ja", amountCents: 12345 }],
      "W01",
    );
    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["W01"]);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets["W01"]);
    expect(rows).toEqual([{ Position: "Hausmeister", "BetrKV-Nr.": 14, "Umlagefähig": "ja", "Betrag (EUR)": 123.45 }]);
  });

  it("kürzt den Sheet-Namen auf die Excel-Grenze von 31 Zeichen", () => {
    const buffer = renterExportToXlsxBuffer([], "Einheit-mit-einem-sehr-langen-Namen-der-31-Zeichen-ueberschreitet");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames[0].length).toBeLessThanOrEqual(31);
  });
});
