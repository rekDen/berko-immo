import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/tickets — Filter: status, priority, category, q (Volltext),
//   property_id, unit_id, contact_id, created_from, created_to
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const priority = sp.get("priority");
  const category = sp.get("category");
  const q = sp.get("q");
  const propertyId = sp.get("property_id");
  const unitId = sp.get("unit_id");
  const contactId = sp.get("contact_id");
  const createdFrom = sp.get("created_from");
  const createdTo = sp.get("created_to");

  let query = supabase
    .from("tickets")
    .select(`
      *,
      contacts ( id, first_name, last_name, company_name, type ),
      units ( id, unit_number ),
      properties ( id, name )
    `)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (category) query = query.eq("category", category);
  if (propertyId) query = query.eq("property_id", propertyId);
  if (unitId) query = query.eq("unit_id", unitId);
  if (contactId) query = query.eq("contact_id", contactId);
  if (createdFrom) query = query.gte("created_at", createdFrom);
  if (createdTo) query = query.lte("created_at", createdTo);

  if (q) {
    const safe = q.replace(/[%,]/g, " ").trim();
    if (safe) {
      query = query.or(
        `title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`
      );
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/tickets
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.title) return badRequest("Pflichtfeld: title");

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      contact_id: body.contact_id ?? null,
      unit_id: body.unit_id ?? null,
      property_id: body.property_id ?? null,
      title: body.title,
      description: body.description ?? null,
      category: body.category ?? null,
      status: body.status ?? "new",
      priority: body.priority ?? "normal",
      assignee_id: body.assignee_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
