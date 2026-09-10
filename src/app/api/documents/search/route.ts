import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/documents/search?q=energieausweis&property_id=xxx&limit=50
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const propertyId = searchParams.get("property_id");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  if (!q) return badRequest("Suchbegriff (q) erforderlich");

  const { data, error } = await supabase.rpc("search_documents", {
    p_query: q,
    p_property_id: propertyId ?? null,
    p_limit: limit,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
