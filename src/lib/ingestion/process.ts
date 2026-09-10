import type { createAdminClient } from "@/lib/supabase/admin";
import { extractText } from "./extract";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";

type Admin = ReturnType<typeof createAdminClient>;

export interface ProcessResult {
  status: "indexed" | "failed";
  chunks: number;
  error?: string;
}

// Verarbeitet ein hochgeladenes Dokument inline:
// Text extrahieren → chunken → embedden → in ingest_chunks schreiben → Status setzen.
// Setzt das Dokument bei Erfolg auf "indexed", sonst auf "failed" (mit Meldung).
export type ProcessPhase = "extract" | "ocr" | "ingest";

export async function processUpload(
  admin: Admin,
  opts: { docId: string; tenantId: string; buffer: Buffer; mimeType: string; filename: string },
  onPhase?: (phase: ProcessPhase) => void,
): Promise<ProcessResult> {
  const { docId, tenantId, buffer, mimeType, filename } = opts;

  const fail = async (error: string): Promise<ProcessResult> => {
    await admin.from("ingest_documents").update({ status: "failed", error_message: error }).eq("id", docId);
    return { status: "failed", chunks: 0, error };
  };

  try {
    onPhase?.("extract");
    const text = await extractText(buffer, mimeType, filename, () => onPhase?.("ocr"));
    if (!text || text.trim().length < 20) {
      return fail("Kein extrahierbarer Text gefunden");
    }

    // Alte Chunks entfernen (Re-Ingestion desselben Dokuments)
    await admin.from("ingest_chunks").delete().eq("document_id", docId);

    const textChunks = chunkText(text);
    if (!textChunks.length) {
      return fail("Kein indexierbarer Inhalt nach dem Chunking");
    }

    // Embeddings für alle Chunks erzeugen (semantische Suche)
    onPhase?.("ingest");
    const vectors = await embedTexts(textChunks);

    const chunks = textChunks.map((content, i) => ({
      document_id:   docId,
      tenant_id:     tenantId,
      chunk_index:   i,
      content,
      token_count:   Math.ceil(content.length * 0.25),
      section_title: filename,
      source_type:   "upload",
      embedding:     vectors[i],
    }));

    // Batch-Insert in Blöcken à 200
    for (let i = 0; i < chunks.length; i += 200) {
      const { error: insErr } = await admin.from("ingest_chunks").insert(chunks.slice(i, i + 200));
      if (insErr) throw new Error(insErr.message);
    }

    await admin.from("ingest_documents").update({ status: "indexed" }).eq("id", docId);
    return { status: "indexed", chunks: chunks.length };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Verarbeitung fehlgeschlagen");
  }
}
