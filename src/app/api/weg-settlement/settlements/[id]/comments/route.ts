import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// POST /api/weg-settlement/settlements/[id]/comments
// Body: { text }
// Beiratsprüfung (Kapitel 8.1): append-only, RLS erlaubt Insert für
// tenant-interne Nutzer und für Beiratsmitglieder ab Status != 'draft'.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    return badRequest("Pflichtfeld: text");
  }

  const { data, error } = await supabase
    .from("settlement_comments")
    .insert({ tenant_id: tenantId, settlement_id: id, author_id: user.id, text: body.text })
    .select("id, author_id, text, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
