import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

// GET /api/document-categories?property_id=xxx
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");

  if (propertyId) {
    const { data, error } = await supabase.rpc("get_visible_categories", {
      p_property_id: propertyId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("document_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
