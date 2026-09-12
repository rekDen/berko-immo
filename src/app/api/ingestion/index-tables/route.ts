import crypto from "crypto";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText, CHUNK_SIZE, OVERLAP } from "@/lib/ingestion/chunk";
import { embedTexts } from "@/lib/ingestion/embed";

// Tabellen die niemals indexiert werden
const EXCLUDED = new Set([
  "ingest_documents", "ingest_chunks", "ingest_failed_jobs", "ingestion_sources",
  "schema_migrations", "failed_jobs",
]);

// POST /api/ingestion/index-tables
// Liest alle public-Tabellen direkt aus und schreibt Chunks (inkl. Embeddings)
// in ingest_chunks. Kein Worker, kein pgmq — funktioniert sofort in der App.
// Antwort ist ein NDJSON-Stream: eine JSON-Zeile pro fertiger Tabelle, damit
// die UI den Fortschritt live anzeigen kann.
//   {type:"start", total}
//   {type:"table", table, rows, chunks, done, total}
//   {type:"done", totalChunks, tables}
//   {type:"error", error}
export async function POST() {
  const { user, tenantId } = await withAuth();
  if (!user || !tenantId) return unauthorized();

  const admin = createAdminClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        // 1. Tabellenliste via RPC
        const { data: tables, error: tErr } = await admin.rpc("get_ingestion_tables");
        if (tErr) { send({ type: "error", error: tErr.message }); controller.close(); return; }

        // Indexierbare Tabellen vorfiltern → Gesamtzahl für den Fortschritt
        const processable = ((tables ?? []) as { table_name: string; text_columns: string[] }[])
          .filter((t) => !EXCLUDED.has(t.table_name) && !!t.text_columns?.length);

        // 2. Quelle sicherstellen (einmalig anlegen)
        let sourceId: string;
        const { data: existing } = await admin
          .from("ingestion_sources")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("source_type", "supabase_table")
          .maybeSingle();

        if (existing) {
          sourceId = existing.id;
        } else {
          const { data: created, error: cErr } = await admin
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
          if (cErr || !created) {
            send({ type: "error", error: cErr?.message ?? "Quelle konnte nicht angelegt werden" });
            controller.close();
            return;
          }
          sourceId = created.id;
        }

        const total = processable.length;
        send({ type: "start", total });

        let totalChunks = 0;
        let done = 0;
        const results: { table: string; rows: number; chunks: number; error: string | null }[] = [];

        for (const t of processable) {
          // Zeilen lesen (max 5000 pro Tabelle)
          const { data: rows, error: rErr } = await admin
            .from(t.table_name as "properties")  // cast nötig für TS
            .select("*")
            .limit(5000);

          if (rErr || !rows?.length) {
            done++;
            send({ type: "table", table: t.table_name, rows: 0, chunks: 0, done, total });
            continue;
          }

          // Alte Chunks dieser Tabelle für diesen Tenant löschen (Re-Index)
          await admin
            .from("ingest_chunks")
            .delete()
            .eq("tenant_id", tenantId)
            .eq("source_type", "supabase_table")
            .like("section_title", `${t.table_name}%`);

          const chunks: {
            document_id: string;
            tenant_id: string;
            chunk_index: number;
            content: string;
            token_count: number;
            section_title: string;
            source_type: string;
            embedding: string | null;
          }[] = [];

          for (const row of rows) {
            const record = row as Record<string, unknown>;

            // Titel-Kandidat
            const titleVal =
              String(record.name ?? record.title ?? record.betreff ?? record.subject ?? record.label ?? "").trim();

            // Alle Textspalten als lesbaren Block zusammenfassen
            const parts: string[] = [];
            for (const col of t.text_columns) {
              const v = record[col];
              if (v == null || v === "") continue;
              parts.push(`${col}: ${String(v)}`);
            }
            if (!parts.length) continue;

            const fullText = parts.join("\n");
            const rowTitle = titleVal
              ? `${t.table_name} · ${titleVal}`
              : `${t.table_name} · ${String(record.id ?? "").slice(0, 8)}`;

            // Dokument-Eintrag sicherstellen
            const contentHash = crypto
              .createHash("sha256")
              .update(tenantId + t.table_name + String(record.id ?? "") + fullText.slice(0, 200))
              .digest("hex");

            const externalId = `public.${t.table_name}:${String(record.id ?? parts[0]?.slice(0, 40))}`;

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
              if (!newDoc) continue;
              docId = newDoc.id;
            }

            // Chunking (character-based, Overlap)
            const textChunks = chunkText(fullText, CHUNK_SIZE, OVERLAP);
            textChunks.forEach((text, i) => {
              chunks.push({
                document_id:   docId,
                tenant_id:     tenantId,
                chunk_index:   i,
                content:       text,
                token_count:   Math.ceil(text.length * 0.25),
                section_title: rowTitle,
                source_type:   "supabase_table",
                embedding:     null,
              });
            });
          }

          let tableError: string | null = null;

          if (chunks.length) {
            // Embeddings für alle Chunks dieser Tabelle erzeugen (semantische Suche)
            const vectors = await embedTexts(chunks.map((c) => c.content));
            chunks.forEach((c, i) => { c.embedding = vectors[i]; });

            // Batch-Insert in Blöcken à 200 — Fehler NICHT verschlucken, sonst werden
            // Dokumente fälschlich als "indexed" markiert, obwohl gar keine Chunks
            // gespeichert wurden (führte zu leeren Suchergebnissen ohne sichtbaren Fehler).
            let insertedCount = 0;
            for (let i = 0; i < chunks.length; i += 200) {
              const batch = chunks.slice(i, i + 200);
              const { error: insErr } = await admin.from("ingest_chunks").insert(batch);
              if (insErr) {
                tableError = insErr.message;
                break;
              }
              insertedCount += batch.length;
            }
            totalChunks += insertedCount;

            const docIds = [...new Set(chunks.map((c) => c.document_id))];
            if (tableError) {
              await admin
                .from("ingest_documents")
                .update({ status: "failed", error_message: tableError })
                .in("id", docIds);
            } else {
              await admin
                .from("ingest_documents")
                .update({ status: "indexed" })
                .in("id", docIds);
            }
          }

          done++;
          results.push({ table: t.table_name, rows: rows.length, chunks: chunks.length, error: tableError });
          send({ type: "table", table: t.table_name, rows: rows.length, chunks: chunks.length, done, total, error: tableError });
        }

        // Quelle als synchronisiert markieren
        await admin
          .from("ingestion_sources")
          .update({ last_synced_at: new Date().toISOString(), status: "active" })
          .eq("id", sourceId);

        send({ type: "done", totalChunks, tables: results });
        controller.close();
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Indexierung fehlgeschlagen" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
