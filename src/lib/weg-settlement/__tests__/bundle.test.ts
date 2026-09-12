import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { mergePdfBuffers, buildZipBuffer } from "../bundle";

async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

describe("mergePdfBuffers", () => {
  it("fügt mehrere PDFs zu einem mit der Gesamtseitenzahl zusammen", async () => {
    const a = await makePdf(1);
    const b = await makePdf(2);
    const c = await makePdf(3);
    const merged = await mergePdfBuffers([a, b, c]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(6);
  });

  it("erhält die Reihenfolge der übergebenen Buffer", async () => {
    const first = await PDFDocument.create();
    first.addPage([100, 100]);
    const second = await PDFDocument.create();
    second.addPage([300, 300]);

    const merged = await mergePdfBuffers([Buffer.from(await first.save()), Buffer.from(await second.save())]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPage(0).getSize().width).toBe(100);
    expect(doc.getPage(1).getSize().width).toBe(300);
  });

  it("liefert ein gültiges (von pdf-lib mit einer Leerseite aufgefülltes) PDF für eine leere Eingabe", async () => {
    // pdf-lib erzwingt beim Speichern mindestens eine Seite — praktisch irrelevant,
    // da ein Sammel-PDF nie aus einer leeren Dokumentliste gebaut wird.
    const merged = await mergePdfBuffers([]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("buildZipBuffer", () => {
  it("legt jede Datei unter ihrem Pfad im Archiv ab", async () => {
    const zipBuffer = await buildZipBuffer([
      { path: "Gesamtabrechnung_2026.pdf", buffer: Buffer.from("PDF-INHALT") },
      { path: "Einheiten/W01/Einzelabrechnung_2026_W01.pdf", buffer: Buffer.from("EINZEL-INHALT") },
      { path: "Einheiten/W01/Vermieterexport_2026_W01.csv", buffer: Buffer.from("CSV-INHALT") },
    ]);

    const zip = await JSZip.loadAsync(zipBuffer);
    const filePaths = Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name).sort();
    expect(filePaths).toEqual([
      "Einheiten/W01/Einzelabrechnung_2026_W01.pdf",
      "Einheiten/W01/Vermieterexport_2026_W01.csv",
      "Gesamtabrechnung_2026.pdf",
    ]);
    const content = await zip.file("Gesamtabrechnung_2026.pdf")!.async("string");
    expect(content).toBe("PDF-INHALT");
  });

  it("erzeugt ein leeres, aber gültiges Archiv für eine leere Dateiliste", async () => {
    const zipBuffer = await buildZipBuffer([]);
    const zip = await JSZip.loadAsync(zipBuffer);
    expect(Object.keys(zip.files)).toEqual([]);
  });
});
