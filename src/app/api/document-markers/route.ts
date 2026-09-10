import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/document-markers?category_id=xxx
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const categoryId = request.nextUrl.searchParams.get("category_id");

  let query = supabase
    .from("document_markers")
    .select("*")
    .order("name", { ascending: true });

  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/document-markers
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.category_id || !body.name) {
    return badRequest("Pflichtfelder: category_id, name");
  }

  const { data, error } = await supabase
    .from("document_markers")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      category_id: body.category_id,
      name: body.name,
      color: body.color ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
