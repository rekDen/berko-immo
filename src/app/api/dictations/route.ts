import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/dictations
export async function GET(_request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { data, error } = await supabase
    .from("dictations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/dictations
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const { raw_transcription, formatted_text } = body;

  if (!raw_transcription || !formatted_text) {
    return badRequest("Pflichtfelder: raw_transcription, formatted_text");
  }

  const { data, error } = await supabase
    .from("dictations")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      title: body.title ?? "",
      raw_transcription,
      formatted_text,
      duration_seconds: body.duration_seconds ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
