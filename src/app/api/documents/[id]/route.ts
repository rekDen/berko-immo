import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

// GET /api/documents/:id
export async function GET(request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      document_categories ( * ),
      properties ( id, name, street, house_number, zip_code, city ),
      units ( id, unit_number, floor ),
      contracts ( id, type, start_date )
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Access-Log
  const admin = createAdminClient();
  await admin.from("document_access_log").insert({
    document_id: id,
    user_id: user.id,
    action: "view",
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json(data);
}

// PATCH /api/documents/:id
export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const allowed = [
    "title", "description", "category_id", "fiscal_year",
    "markers", "internal_only", "visibility_override",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/documents/:id (soft-delete + Datei aus Storage entfernen)
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id } = await params;

  // 1) Dokument lesen, um Tenant-Zugehörigkeit + storage_path zu kennen
  const { data: doc, error: readErr } = await supabase
    .from("documents")
    .select("id, tenant_id, storage_path")
    .eq("id", id)
    .single();

  if (readErr || !doc) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden oder keine Berechtigung" },
      { status: 404 }
    );
  }

  // 2) Soft-Delete via Admin (umgeht RLS-Stolpersteine, Tenant-Check oben sichert ab)
  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("documents")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 3) Datei aus Storage entfernen (best effort)
  if (doc.storage_path) {
    await admin.storage.from("documents").remove([doc.storage_path]);
  }

  return NextResponse.json({ success: true });
}
