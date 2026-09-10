import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

const FOLDER_NAME = "Exposés";

// POST /api/expose/save   multipart: pdf (File), title (string)
// Finds or creates the "Exposés" folder, then stores the PDF in Supabase Storage
// and creates a record in the files table.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const form  = await request.formData();
  const pdf   = form.get("pdf") as File | null;
  const title = ((form.get("title") as string | null) ?? "Exposé").slice(0, 100);

  if (!pdf || pdf.type !== "application/pdf") return badRequest("pdf (application/pdf) erforderlich");

  const admin = createAdminClient();

  // ── Find or create "Exposés" root folder ─────────────────────────────────
  const { data: existing } = await admin
    .from("folders")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("name", FOLDER_NAME)
    .is("parent_id", null)
    .maybeSingle();

  let folderId: string;
  if (existing) {
    folderId = existing.id;
  } else {
    const { data: created, error: fErr } = await supabase
      .from("folders")
      .insert({ tenant_id: tenantId, created_by: user.id, parent_id: null, name: FOLDER_NAME })
      .select("id")
      .single();
    if (fErr || !created) return NextResponse.json({ error: fErr?.message ?? "Ordner konnte nicht angelegt werden" }, { status: 500 });
    folderId = created.id;
  }

  // ── Upload PDF to Supabase Storage ────────────────────────────────────────
  const fileId      = crypto.randomUUID();
  const fileName    = `${title.replace(/[^a-z0-9äöüß\-_ ]/gi, "_")}_${fileId.slice(0, 8)}.pdf`;
  const storagePath = `${tenantId}/files/${fileId}.pdf`;

  const { error: storageErr } = await admin.storage
    .from("documents")
    .upload(storagePath, pdf, { contentType: "application/pdf" });

  if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 });

  // ── Create file record ────────────────────────────────────────────────────
  const { data: fileRecord, error: fileErr } = await supabase
    .from("files")
    .insert({
      tenant_id:    tenantId,
      created_by:   user.id,
      folder_id:    folderId,
      name:         fileName,
      storage_path: storagePath,
      file_size:    pdf.size,
      mime_type:    "application/pdf",
    })
    .select("id, name, folder_id")
    .single();

  if (fileErr) {
    await admin.storage.from("documents").remove([storagePath]);
    return NextResponse.json({ error: fileErr.message }, { status: 500 });
  }

  return NextResponse.json({
    file_id:     fileRecord.id,
    file_name:   fileRecord.name,
    folder_id:   folderId,
    folder_name: FOLDER_NAME,
  }, { status: 201 });
}
