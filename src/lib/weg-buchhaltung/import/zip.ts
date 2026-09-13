import JSZip from "jszip";

/** B5.1: ZIP-Archive mit mehreren CAMT.053-Auszügen werden entpackt und
 * einzeln verarbeitet. Nicht-XML-Einträge (z. B. ein beigelegtes Lesezeichen)
 * werden ignoriert. */
export async function extractCamt053Files(zipBytes: ArrayBuffer): Promise<{ fileName: string; xml: string }[]> {
  const zip = await JSZip.loadAsync(zipBytes);
  const files: { fileName: string; xml: string }[] = [];
  for (const [fileName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!fileName.toLowerCase().endsWith(".xml")) continue;
    const xml = await entry.async("string");
    files.push({ fileName, xml });
  }
  return files;
}
