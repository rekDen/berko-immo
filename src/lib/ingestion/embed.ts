import OpenAI from "openai";

// IONOS AI Model Hub erwartet den API-Token direkt als Bearer (Authorization: Bearer <token>).
// Bevorzugt IONOS_API_TOKEN, fällt auf IONOS_API_SECRET zurück (Altbestand).
export function ionosToken(): string {
  return (process.env.IONOS_API_TOKEN || process.env.IONOS_API_SECRET || "").trim();
}

export function hasIonos(): boolean {
  return !!ionosToken();
}

// Erzeugt Embeddings für eine Liste von Texten via IONOS (bge-m3, 1024-dim).
// Gibt pro Text den Vektor als pgvector-Textliteral ("[0.1,0.2,...]") zurück,
// oder null falls kein IONOS konfiguriert / ein Fehler auftritt (FTS greift dann weiter).
export async function embedTexts(texts: string[]): Promise<(string | null)[]> {
  const token = ionosToken();
  if (!token) return texts.map(() => null);

  const client = new OpenAI({
    apiKey:  token, // wird vom SDK als "Authorization: Bearer <token>" gesendet
    baseURL: process.env.IONOS_EMBED_URL ?? "https://openai.inference.de-txl.ionos.com/v1",
  });
  const model = process.env.IONOS_EMBED_MODEL ?? "BAAI/bge-m3";

  const out: (string | null)[] = new Array(texts.length).fill(null);
  const BATCH = 64;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    try {
      const res = await client.embeddings.create({ model, input: batch });
      // Reihenfolge über res.data[].index absichern
      for (const item of res.data) {
        out[i + item.index] = JSON.stringify(item.embedding);
      }
    } catch {
      // Bei Fehler: dieser Batch bleibt ohne Embedding (FTS greift weiterhin)
    }
  }
  return out;
}
