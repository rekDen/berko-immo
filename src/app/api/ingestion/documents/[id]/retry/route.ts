import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { processUpload } from "@/lib/ingestion/process";

type Params = { params: Promise<{ id: string }> };

// POST /api/ingestion/documents/:id/retry
export async function POST(_request: NextRequest, { params }: Params) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id } = await params;
  const admin = createAdminClient();

  // Dokument laden (nur eigenes, tenant-geprüft)
  const { data: doc } = await admin
    .from("ingest_documents")
    .select("storage_path, mime_type, title, source_type")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });

  // Tabellen-Dokumente werden über „Indexieren" neu aufgebaut, nicht hier
  if (doc.source_type !== "upload" || !doc.storage_path) {
    await admin
      .from("ingest_documents")
      .update({ status: "pending", error_message: null })
      .eq("id", id);
    return NextResponse.json({
      ok: true,
      note: "Kein Upload-Dokument — bitte Datenquelle neu indexieren.",
    });
  }

  // Original aus dem Storage laden
  const { data: blob, error: dErr } = await admin.storage
    .from("documents")
    .download(doc.storage_path);

  if (dErr || !blob) {
    const msg = dErr?.message ?? "Datei im Storage nicht gefunden";
    await admin.from("ingest_documents").update({ status: "failed", error_message: msg }).eq("id", id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await admin
    .from("ingest_documents")
    .update({ status: "chunking", error_message: null })
    .eq("id", id);

  const buffer = Buffer.from(await blob.arrayBuffer());
  const result = await processUpload(admin, {
    docId:    id,
    tenantId,
    buffer,
    mimeType: doc.mime_type ?? "",
    filename: doc.title ?? "datei",
  });

  return NextResponse.json({ ok: result.status === "indexed", ...result });
}
