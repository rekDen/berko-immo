import { NextRequest } from "next/server";
import crypto from "crypto";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { processUpload } from "@/lib/ingestion/process";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "text/plain",
  "text/markdown",
  "text/html",
  "message/rfc822",
  "application/json",
]);

// Browser senden für .md/.txt/.html/.json etc. oft einen leeren oder generischen
// MIME-Typ. Dann leiten wir ihn aus der Dateiendung ab, damit gültige Dateien
// nicht fälschlich abgelehnt werden.
const EXT_MIME: Record<string, string> = {
  pdf:      "application/pdf",
  docx:     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc:      "application/msword",
  xlsx:     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls:      "application/vnd.ms-excel",
  txt:      "text/plain",
  md:       "text/markdown",
  markdown: "text/markdown",
  html:     "text/html",
  htm:      "text/html",
  json:     "application/json",
  eml:      "message/rfc822",
};

// POST /api/ingestion/upload  (multipart/form-data)
// Fields: file (Blob), source_id? (uuid)
// Antwort ist ein NDJSON-Stream, damit die UI die Phasen live anzeigen kann:
//   {type:"phase", phase:"extract"|"ocr"|"ingest"}
//   {type:"done", status, chunks?, id}
//   {type:"error", error}
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      let closed = false;
      const finish = (o: unknown) => { if (closed) return; send(o); controller.close(); closed = true; };

      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        if (!file) return finish({ type: "error", error: "Pflichtfeld: file" });
        if (file.size > MAX_FILE_SIZE) return finish({ type: "error", error: "Datei zu groß (max. 50 MB)" });

        const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
        let mimeType = file.type || "";
        if (!mimeType || mimeType === "application/octet-stream") mimeType = EXT_MIME[ext] ?? mimeType;
        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
          return finish({ type: "error", error: `Dateityp nicht unterstützt: ${file.type || ext || "unbekannt"}` });
        }

        const sourceId = formData.get("source_id") as string | null;
        const buffer = Buffer.from(await file.arrayBuffer());
        const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

        // Idempotenz: bei gleichem Hash + bereits indexiert überspringen
        const { data: existing } = await supabase
          .from("ingest_documents")
          .select("id, status, document_version")
          .eq("content_hash", contentHash)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (existing && existing.status === "indexed") {
          return finish({ type: "done", status: "skipped", id: existing.id });
        }

        // In Supabase Storage hochladen. Sicherer ASCII-Key (Hash + Endung),
        // Originalname bleibt in title/name.
        const admin = createAdminClient();
        const safeExt = ext.replace(/[^a-z0-9]/g, "");
        const storagePath = `ingestion/${tenantId}/uploads/${contentHash}${safeExt ? "." + safeExt : ""}`;
        const { error: uploadError } = await admin.storage
          .from("documents")
          .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

        if (uploadError) return finish({ type: "error", error: `Storage: ${uploadError.message}` });

        let docId: string;
        if (existing) {
          const { data: updated, error: updErr } = await admin
            .from("ingest_documents")
            .update({
              status:           "pending",
              error_message:    null,
              storage_path:     storagePath,
              document_version: existing.document_version != null ? existing.document_version + 1 : 1,
            })
            .eq("id", existing.id)
            .select("id")
            .single();
          if (updErr || !updated) {
            return finish({ type: "error", error: `Dokument-Update: ${updErr?.message ?? "keine Zeile aktualisiert"}` });
          }
          docId = updated.id;
        } else {
          const { data: doc, error: docError } = await supabase
            .from("ingest_documents")
            .insert({
              tenant_id:    tenantId,
              source_id:    sourceId,
              source_type:  "upload",
              external_id:  null,
              title:        file.name,
              mime_type:    mimeType,
              storage_path: storagePath,
              content_hash: contentHash,
              status:       "pending",
            })
            .select("id")
            .single();
          if (docError || !doc) {
            return finish({ type: "error", error: `Dokument anlegen: ${docError?.message ?? "unbekannt"}` });
          }
          docId = doc.id;
        }

        // Auch im DMS ("Dokumente") sichtbar machen — Fehler hier nicht kritisch
        const { error: fileErr } = await supabase.from("files").insert({
          tenant_id:    tenantId,
          created_by:   user.id,
          folder_id:    null,
          name:         file.name,
          storage_path: storagePath,
          file_size:    file.size,
          mime_type:    mimeType,
          file_hash:    contentHash,
        });
        if (fileErr && fileErr.code !== "23505") console.error("DMS files insert:", fileErr.message);

        // Verarbeiten mit Live-Phasen (extract → ocr? → ingest)
        const result = await processUpload(
          admin,
          { docId, tenantId, buffer, mimeType, filename: file.name },
          (phase) => send({ type: "phase", phase }),
        );

        return finish({ type: "done", status: result.status, chunks: result.chunks, error: result.error, id: docId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload fehlgeschlagen";
        console.error("ingestion/upload:", e);
        finish({ type: "error", error: msg });
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
