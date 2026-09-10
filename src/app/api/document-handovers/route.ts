import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/document-handovers
export async function GET(_request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { data, error } = await supabase
    .from("document_handovers")
    .select(`
      *,
      properties ( id, name, street, house_number, zip_code, city )
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/document-handovers — Verwalterübergabe anfordern
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const { property_id, to_tenant_id } = body;

  if (!property_id || !to_tenant_id) {
    return badRequest("Pflichtfelder: property_id, to_tenant_id");
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("id", property_id)
    .single();

  if (!property) {
    return NextResponse.json({ error: "Objekt nicht gefunden" }, { status: 404 });
  }

  const admin = createAdminClient();

  const { data: docSnapshot } = await admin
    .from("documents")
    .select("id, title, category_id, level, file_name")
    .eq("property_id", property_id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const { data: unitSnapshot } = await admin
    .from("units")
    .select("id, unit_number, type, area, mea")
    .eq("property_id", property_id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const snapshot = {
    property_name: property.name,
    document_count: docSnapshot?.length ?? 0,
    unit_count: unitSnapshot?.length ?? 0,
    documents: docSnapshot ?? [],
    units: unitSnapshot ?? [],
    created_at: new Date().toISOString(),
  };

  const { data: handover, error } = await admin
    .from("document_handovers")
    .insert({
      property_id,
      from_tenant_id: tenantId,
      to_tenant_id,
      status: "requested",
      requested_by: user.id,
      snapshot,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(handover, { status: 201 });
}

// PATCH /api/document-handovers — Übergabe genehmigen/abschließen/abbrechen
export async function PATCH(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const { id, action } = body;

  if (!id || !action) {
    return badRequest("Pflichtfelder: id, action (approve/complete/cancel)");
  }

  const { data: handover } = await supabase
    .from("document_handovers")
    .select("*")
    .eq("id", id)
    .single();

  if (!handover) {
    return NextResponse.json({ error: "Übergabe nicht gefunden" }, { status: 404 });
  }

  if (action === "approve") {
    if (handover.status !== "requested") {
      return badRequest("Nur angeforderte Übergaben können genehmigt werden");
    }

    const { error } = await supabase
      .from("document_handovers")
      .update({ status: "approved", approved_by: user.id })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: "approved" });
  }

  if (action === "complete") {
    if (handover.status !== "approved") {
      return badRequest("Nur genehmigte Übergaben können abgeschlossen werden");
    }

    const admin = createAdminClient();

    await admin
      .from("documents")
      .update({ tenant_id: handover.to_tenant_id })
      .eq("property_id", handover.property_id)
      .eq("tenant_id", handover.from_tenant_id);

    await admin
      .from("units")
      .update({ tenant_id: handover.to_tenant_id })
      .eq("property_id", handover.property_id)
      .eq("tenant_id", handover.from_tenant_id);

    await admin
      .from("contact_roles")
      .update({ tenant_id: handover.to_tenant_id })
      .eq("property_id", handover.property_id)
      .eq("tenant_id", handover.from_tenant_id);

    await admin
      .from("contracts")
      .update({ tenant_id: handover.to_tenant_id })
      .in(
        "contact_role_id",
        (await admin
          .from("contact_roles")
          .select("id")
          .eq("property_id", handover.property_id)
          .eq("tenant_id", handover.to_tenant_id)
        ).data?.map((r) => r.id) ?? []
      );

    await admin
      .from("properties")
      .update({ tenant_id: handover.to_tenant_id })
      .eq("id", handover.property_id)
      .eq("tenant_id", handover.from_tenant_id);

    await admin
      .from("document_handovers")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ success: true, status: "completed" });
  }

  if (action === "cancel") {
    const { error } = await supabase
      .from("document_handovers")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: "cancelled" });
  }

  return badRequest("Ungültige Aktion. Erlaubt: approve, complete, cancel");
}
