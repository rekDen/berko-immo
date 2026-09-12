import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

/**
 * Sammel-PDF und ZIP-Bündelung (Spec 8.3): "Die Dokumente sind als Sammel-PDF
 * und als ZIP mit Einzeldateien verfügbar." Reine Funktionen über bereits
 * erzeugte Dokument-Buffer — kein eigener Rechenschritt, nur Zusammenführung.
 * Gleiches Merge-Muster wie `src/app/api/expose/route.ts` (dort: PDF-Vorlage +
 * erzeugtes PDF über `pdf-lib`).
 */

/** Fügt mehrere PDF-Buffer in der übergebenen Reihenfolge zu einem PDF zusammen. */
export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return Buffer.from(await merged.save());
}

export interface ZipFileEntry {
  path: string; // z. B. "Einheiten/W01/Einzelabrechnung_2026_W01.pdf"
  buffer: Buffer;
}

/** Erzeugt ein ZIP-Archiv mit den übergebenen Dateien unter ihrem jeweiligen Pfad. */
export async function buildZipBuffer(files: ZipFileEntry[]): Promise<Buffer> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.buffer);
  return zip.generateAsync({ type: "nodebuffer" });
}
