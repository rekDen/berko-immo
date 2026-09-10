import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

// GET /api/ingestion/documents?source_id=&status=&limit=&offset=
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const sourceId = searchParams.get("source_id");
  const status   = searchParams.get("status");
  const limit    = parseInt(searchParams.get("limit") ?? "50");
  const offset   = parseInt(searchParams.get("offset") ?? "0");

  let query = supabase
    .from("ingest_documents")
    .select("*, ingestion_sources ( id, name, source_type )")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (sourceId) query = query.eq("source_id", sourceId);
  if (status)   query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
