import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateName, conflictResponse } from "@/lib/dokumente";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/folders/:id   { name? }  umbenennen  |  { parent_id? }  verschieben
export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if ("name" in body) {
    const nameResult = validateName(body.name);
    if ("error" in nameResult) return badRequest(nameResult.error);
    updates.name = nameResult.name;
  }

  if ("parent_id" in body) {
    const newParent: string | null = body.parent_id ?? null;
    if (newParent === id) return badRequest("Ordner kann nicht in sich selbst verschoben werden");
    if (newParent) {
      // Zyklus-Schutz: Ziel darf kein Nachfahre (oder der Ordner selbst) sein
      const { data: isDesc, error: rpcErr } = await supabase.rpc("dokumente_is_self_or_descendant", {
        p_folder: id,
        p_candidate: newParent,
      });
      if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      if (isDesc) return badRequest("Ordner kann nicht in einen seiner Unterordner verschoben werden");
    }
    updates.parent_id = newParent;
  }

  if (Object.keys(updates).length === 0) return badRequest("Keine Änderungen angegeben");

  const { data, error } = await supabase
    .from("folders")
    .update(updates)
    .eq("id", id)
    .select("id, parent_id, name, sort_order, created_at, updated_at")
    .single();

  if (error) {
    return conflictResponse(error) ?? NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE /api/folders/:id   Soft-Delete (rekursiv: Unterordner + Dateien)
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id } = await params;

  // Tenant-Zugehörigkeit über RLS-gescopten Read prüfen
  const { data: folder, error: readErr } = await supabase
    .from("folders")
    .select("id")
    .eq("id", id)
    .single();

  if (readErr || !folder) {
    return NextResponse.json(
      { error: "Ordner nicht gefunden oder keine Berechtigung" },
      { status: 404 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("dokumente_soft_delete_folder", {
    p_folder: id,
    p_user: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
