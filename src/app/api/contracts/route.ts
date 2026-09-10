import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/contracts?property_id=xxx&type=rental_residential
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const propertyId = searchParams.get("property_id");
  const contactId = searchParams.get("contact_id");
  const type = searchParams.get("type");
  const active = searchParams.get("active");

  let query = supabase
    .from("contracts")
    .select(`
      *,
      contact_roles!contracts_contact_role_id_fkey!inner (
        id, contact_id, role, property_id, unit_id,
        contacts ( id, first_name, last_name, company_name, type ),
        units ( id, unit_number ),
        properties ( id, name )
      )
    `)
    .order("start_date", { ascending: false });

  if (type) query = query.eq("type", type);
  if (active === "true") query = query.is("end_date", null);
  if (propertyId) query = query.eq("contact_roles.property_id", propertyId);
  if (contactId) query = query.eq("contact_roles.contact_id", contactId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/contracts
// Akzeptiert entweder:
//   a) contact_role_id (existierende Rolle)
//   b) contact_id + property_id (+ unit_id) + role  → Rolle wird gesucht/angelegt
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.type || !body.start_date) {
    return badRequest("Pflichtfelder: type, start_date");
  }

  let contactRoleId: string | null = body.contact_role_id ?? null;

  if (!contactRoleId) {
    if (!body.contact_id || !body.property_id || !body.role) {
      return badRequest(
        "Bitte contact_role_id ODER contact_id + property_id + role angeben"
      );
    }

    // 1) bestehende Rolle finden
    let lookup = supabase
      .from("contact_roles")
      .select("id")
      .eq("contact_id", body.contact_id)
      .eq("property_id", body.property_id)
      .eq("role", body.role)
      .is("deleted_at", null)
      .limit(1);
    lookup = body.unit_id
      ? lookup.eq("unit_id", body.unit_id)
      : lookup.is("unit_id", null);
    const { data: existing } = await lookup.maybeSingle();

    if (existing?.id) {
      contactRoleId = existing.id;
    } else {
      // 2) neue Rolle anlegen
      const { data: created, error: roleErr } = await supabase
        .from("contact_roles")
        .insert({
          tenant_id: tenantId,
          created_by: user.id,
          contact_id: body.contact_id,
          property_id: body.property_id,
          unit_id: body.unit_id ?? null,
          role: body.role,
          valid_from: body.start_date,
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
  }

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      contact_role_id: contactRoleId,
      type: body.type,
      start_date: body.start_date,
      end_date: body.end_date ?? null,
      notice_period_months: body.notice_period_months ?? null,
      is_fixed_term: body.is_fixed_term ?? false,
      indexation: body.indexation ?? null,
      graduated_rent: body.graduated_rent ?? null,
      cold_rent: body.cold_rent ?? null,
      operating_costs_prepayment: body.operating_costs_prepayment ?? null,
      heating_costs_prepayment: body.heating_costs_prepayment ?? null,
      hausgeld: body.hausgeld ?? null,
      deposit_amount: body.deposit_amount ?? null,
      deposit_type: body.deposit_type ?? null,
      deposit_custody: body.deposit_custody ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
