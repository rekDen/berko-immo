import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { validateName, conflictResponse } from "@/lib/dokumente";

// GET /api/folders            → alle Ordner des Mandanten (flach, Client baut Baum)
// GET /api/folders?parent_id= → nur direkte Kinder (root = Wurzel)
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const parentId = request.nextUrl.searchParams.get("parent_id");

  let query = supabase
    .from("folders")
    .select("id, parent_id, name, sort_order, created_at, updated_at")
    .order("name", { ascending: true });

  if (parentId === "root") query = query.is("parent_id", null);
  else if (parentId) query = query.eq("parent_id", parentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/folders  { name, parent_id? }
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const nameResult = validateName(body.name);
  if ("error" in nameResult) return badRequest(nameResult.error);

  const { data, error } = await supabase
    .from("folders")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      parent_id: body.parent_id ?? null,
      name: nameResult.name,
    })
    .select("id, parent_id, name, sort_order, created_at, updated_at")
    .single();

  if (error) {
    return conflictResponse(error) ?? NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
