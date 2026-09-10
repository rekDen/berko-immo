import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateName, conflictResponse } from "@/lib/dokumente";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/files/:id   { name? } umbenennen  |  { folder_id? } verschieben
export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if ("name" in body) {
    const nameResult = validateName(body.name);
    if ("error" in nameResult) return badRequest(nameResult.error);
    updates.name = nameResult.name;
  }
  if ("folder_id" in body) {
    updates.folder_id = body.folder_id ?? null;
  }

  if (Object.keys(updates).length === 0) return badRequest("Keine Änderungen angegeben");

  const { data, error } = await supabase
    .from("files")
    .update(updates)
    .eq("id", id)
    .select("id, folder_id, name, storage_path, file_size, mime_type, created_at, updated_at")
    .single();

  if (error) {
    return conflictResponse(error) ?? NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE /api/files/:id   Soft-Delete + Datei aus Storage entfernen (best effort)
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id } = await params;

  const { data: file, error: readErr } = await supabase
    .from("files")
    .select("id, storage_path")
    .eq("id", id)
    .single();

  if (readErr || !file) {
    return NextResponse.json(
      { error: "Datei nicht gefunden oder keine Berechtigung" },
      { status: 404 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("files")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (file.storage_path) {
    await admin.storage.from("documents").remove([file.storage_path]);
  }

  return NextResponse.json({ success: true });
}
