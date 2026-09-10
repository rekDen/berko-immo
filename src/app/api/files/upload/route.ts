import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { conflictResponse } from "@/lib/dokumente";

// POST /api/files/upload   (multipart/form-data)
// Felder: file (Datei), folder_id? (Zielordner, leer = Wurzel)
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const form = await request.formData();
  const file = form.get("file");
  const folderIdRaw = form.get("folder_id");
  const folderId = folderIdRaw && folderIdRaw !== "root" ? String(folderIdRaw) : null;

  if (!(file instanceof File)) return badRequest("Feld 'file' erforderlich");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : null;
  const fileId = crypto.randomUUID();
  const storagePath = `${tenantId}/files/${fileId}${ext ? "." + ext : ""}`;

  const admin = createAdminClient();

  // 1) In Storage hochladen
  const { error: storageErr } = await admin.storage
    .from("documents")
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });

  if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 });

  // 2) Metadaten-Datensatz (RLS-gescopt über authed Client)
  const { data, error } = await supabase
    .from("files")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      folder_id: folderId,
      name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || null,
    })
    .select("id, folder_id, name, storage_path, file_size, mime_type, created_at, updated_at")
    .single();

  if (error) {
    // Datensatz fehlgeschlagen → hochgeladene Datei wieder entfernen
    await admin.storage.from("documents").remove([storagePath]);
    return conflictResponse(error) ?? NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
