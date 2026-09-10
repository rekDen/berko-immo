import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/deadlines?type=frist&upcoming=14
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const upcoming = searchParams.get("upcoming");
  const propertyId = searchParams.get("property_id");
  const unitId = searchParams.get("unit_id");

  let query = supabase
    .from("deadlines")
    .select("*")
    .order("date", { ascending: true });

  if (type) query = query.eq("type", type);
  if (propertyId) query = query.eq("property_id", propertyId);
  if (unitId) query = query.eq("unit_id", unitId);
  if (upcoming) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(upcoming));
    query = query
      .gte("date", new Date().toISOString().split("T")[0])
      .lte("date", futureDate.toISOString().split("T")[0]);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/deadlines
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const { date, title, type, az } = body;

  if (!date || !title || !type || !az) {
    return badRequest("Pflichtfelder: date, title, type, az");
  }

  const { data, error } = await supabase
    .from("deadlines")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      az,
      date,
      title,
      description: body.description ?? "",
      type,
      assigned_to: body.assigned_to ?? "",
      location: body.location ?? "",
      property_id: body.property_id ?? null,
      unit_id: body.unit_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
