import crypto from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { chunkText, CHUNK_SIZE, OVERLAP } from "./chunk";
import { embedTexts } from "./embed";

type Admin = ReturnType<typeof createAdminClient>;

// Liefert die "supabase_table"-Quelle für den Tenant (legt sie bei Bedarf an).
// Dieselbe Quelle, die auch /api/ingestion/index-tables verwendet.
export async function getOrCreateTableSource(admin: Admin, tenantId: string): Promise<string> {
  const { data: existing } = await admin
    .from("ingestion_sources")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("source_type", "supabase_table")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("ingestion_sources")
    .insert({
      tenant_id:   tenantId,
      source_type: "supabase_table",
      name:        "Supabase-Datenbank",
      config:      {},
      status:      "active",
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Quelle konnte nicht angelegt werden");
  return created.id;
}

// Indexiert eine einzelne Tabellenzeile (chunken + embedden + in ingest_chunks
// schreiben) für die semantische Suche. Wird für die sofortige Indexierung
// neuer Datensätze (z.B. neu eingehende E-Mails) verwendet, statt auf den
// manuellen "Daten einlesen"-Re-Index zu warten.
export async function indexTableRow(
  admin: Admin,
  tenantId: string,
  sourceId: string,
  tableName: string,
  row: Record<string, unknown>,
  textColumns: string[],
): Promise<{ chunks: number } | null> {
  const titleVal =
    String(row.name ?? row.title ?? row.betreff ?? row.subject ?? row.label ?? "").trim();

  const parts: string[] = [];
  for (const col of textColumns) {
    const v = row[col];
    if (v == null || v === "") continue;
    parts.push(`${col}: ${String(v)}`);
  }
  if (!parts.length) return null;

  const fullText = parts.join("\n");
  const rowTitle = titleVal
    ? `${tableName} · ${titleVal}`
    : `${tableName} · ${String(row.id ?? "").slice(0, 8)}`;

  const contentHash = crypto
    .createHash("sha256")
    .update(tenantId + tableName + String(row.id ?? "") + fullText.slice(0, 200))
    .digest("hex");
  const externalId = `public.${tableName}:${String(row.id ?? "")}`;

  let docId: string;
  const { data: existDoc } = await admin
    .from("ingest_documents")
    .select("id")
    .eq("source_id", sourceId)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existDoc) {
    docId = existDoc.id;
    await admin
      .from("ingest_documents")
      .update({ status: "chunking", content_hash: contentHash, error_message: null })
      .eq("id", docId);
    await admin.from("ingest_chunks").delete().eq("document_id", docId);
  } else {
    const { data: newDoc } = await admin
      .from("ingest_documents")
      .insert({
        tenant_id:    tenantId,
        source_id:    sourceId,
        source_type:  "supabase_table",
        external_id:  externalId,
        title:        rowTitle,
        mime_type:    "text/plain",
        content_hash: contentHash,
        status:       "chunking",
      })
      .select("id")
      .single();
    if (!newDoc) return null;
    docId = newDoc.id;
  }

  const textChunks = chunkText(fullText, CHUNK_SIZE, OVERLAP);
  if (!textChunks.length) return null;

  const vectors = await embedTexts(textChunks);
  const chunks = textChunks.map((content, i) => ({
    document_id:   docId,
    tenant_id:     tenantId,
    chunk_index:   i,
    content,
    token_count:   Math.ceil(content.length * 0.25),
    section_title: rowTitle,
    source_type:   "supabase_table",
    embedding:     vectors[i],
  }));

  for (let i = 0; i < chunks.length; i += 200) {
    await admin.from("ingest_chunks").insert(chunks.slice(i, i + 200));
  }
  await admin.from("ingest_documents").update({ status: "indexed" }).eq("id", docId);

  return { chunks: chunks.length };
}
