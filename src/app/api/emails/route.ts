import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/emails?category=mandant&read=false
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const read = searchParams.get("read");
  const folder = searchParams.get("folder");

  let query = supabase
    .from("emails")
    .select("*")
    .order("date", { ascending: false });

  if (folder) {
    query = query.eq("folder", folder);
  } else {
    query = query.eq("folder", "inbox");
  }

  if (category) query = query.eq("category", category);
  if (read !== null) query = query.eq("read", read === "true");

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/emails
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const { from_address, from_name, subject, body: emailBody, category } = body;

  if (!from_address || !from_name || !subject || !emailBody || !category) {
    return badRequest("Pflichtfelder: from_address, from_name, subject, body, category");
  }

  const { data, error } = await supabase
    .from("emails")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      from_address,
      from_name,
      subject,
      body: emailBody,
      category,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
