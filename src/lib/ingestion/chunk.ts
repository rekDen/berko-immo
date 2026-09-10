// Zeichenbasiertes Chunking mit Overlap — gemeinsam genutzt von Upload- und
// Tabellen-Indexierung, damit beide Pfade identisch chunken.

export const CHUNK_SIZE = 500; // Zeichen pro Chunk (Näherung)
export const OVERLAP    = 60;

export function chunkText(
  text: string,
  size: number = CHUNK_SIZE,
  overlap: number = OVERLAP,
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start += size - overlap;
  }
  return chunks.filter((c) => c.length > 20);
}
