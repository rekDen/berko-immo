import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractCamt053Files } from "../zip";

describe("extractCamt053Files", () => {
  it("extrahiert alle XML-Dateien aus einem ZIP-Archiv und ignoriert andere Dateitypen", async () => {
    const zip = new JSZip();
    zip.file("konto1.xml", "<Document>1</Document>");
    zip.file("konto2.xml", "<Document>2</Document>");
    zip.file("readme.txt", "kein CAMT-Auszug");
    const bytes = await zip.generateAsync({ type: "arraybuffer" });

    const files = await extractCamt053Files(bytes);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.fileName).sort()).toEqual(["konto1.xml", "konto2.xml"]);
    expect(files.find((f) => f.fileName === "konto1.xml")?.xml).toBe("<Document>1</Document>");
  });

  it("liefert eine leere Liste für ein ZIP ohne XML-Dateien", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "nichts hier");
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    expect(await extractCamt053Files(bytes)).toEqual([]);
  });
});
