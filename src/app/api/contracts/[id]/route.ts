import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

type Params = { params: Promise<{ id: string }> };

// GET /api/contracts/:id
export async function GET(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  const { data, error } = await supabase
    .from("contracts")
    .select(`
      *,
      contact_roles!contracts_contact_role_id_fkey (
        id, contact_id, role, property_id, unit_id, valid_from, valid_to,
        contacts ( id, type, first_name, last_name, company_name, emails, phones ),
        units ( id, unit_number, floor, area ),
        properties ( id, name, street, house_number, zip_code, city )
      )
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/contracts/:id
export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const allowed = [
    "type", "start_date", "end_date", "notice_period_months",
    "is_fixed_term", "indexation", "graduated_rent",
    "cold_rent", "operating_costs_prepayment",
    "heating_costs_prepayment", "hausgeld",
    "deposit_amount", "deposit_type", "deposit_custody", "notes",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Vertragspartner / Objekt / Einheit ändern → contact_role wechseln
  if (body.contact_id || body.property_id || body.role) {
    if (!body.contact_id || !body.property_id || !body.role) {
      return NextResponse.json(
        { error: "Für die Änderung des Vertragspartners sind contact_id, property_id und role erforderlich" },
        { status: 400 }
      );
    }

    // find-or-create der Rolle (gleiche Logik wie POST /api/contracts)
    let lookup = supabase
      .from("contact_roles")
      .select("id")
      .eq("contact_id", body.contact_id)
      .eq("property_id", body.property_id)
      .eq("role", body.role)
      .is("deleted_at", null)
      .limit(1);
    lookup = body.unit_id ? lookup.eq("unit_id", body.unit_id) : lookup.is("unit_id", null);
    const { data: existing } = await lookup.maybeSingle();

    let contactRoleId = existing?.id ?? null;
    if (!contactRoleId) {
      const { data: created, error: roleErr } = await supabase
        .from("contact_roles")
        .insert({
          tenant_id: tenantId,
          created_by: user.id,
          contact_id: body.contact_id,
          property_id: body.property_id,
          unit_id: body.unit_id ?? null,
          role: body.role,
          valid_from: body.start_date ?? new Date().toISOString().slice(0, 10),
          is_primary: true,
        })
        .select("id")
        .single();
      if (roleErr || !created) {
        return NextResponse.json(
          { error: roleErr?.message ?? "Rolle konnte nicht angelegt werden" },
          { status: 500 }
        );
      }
      contactRoleId = created.id;
    }

    updates.contact_role_id = contactRoleId;
  }

  const { data, error } = await supabase
    .from("contracts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/contracts/:id (soft-delete)
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;
  const { error } = await supabase
    .from("contracts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
