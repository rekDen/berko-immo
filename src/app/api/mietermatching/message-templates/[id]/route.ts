import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

const FIELDS = `id, type, name, subject, body, channel, is_default, active, created_at, updated_at`;

const EDITABLE_FIELDS = ["name", "subject", "body", "channel", "is_default", "active"];

// PATCH /api/mietermatching/message-templates/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  const { data: existing, error: readErr } = await supabase.from("message_template").select("type").eq("id", id).single();
  if (readErr || !existing) return badRequest("Vorlage nicht gefunden");

  if (body.is_default === true) {
    await supabase.from("message_template").update({ is_default: false }).eq("type", existing.type).neq("id", id);
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }

  const { data, error } = await supabase.from("message_template").update(update).eq("id", id).select(FIELDS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/mietermatching/message-templates/[id]
// Spec §7: "UI verhindert das Löschen der letzten verbleibenden Vorlage
// eines Typs" — serverseitig durchgesetzt, nicht nur clientseitig.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const { data: existing, error: readErr } = await supabase.from("message_template").select("type").eq("id", id).single();
  if (readErr || !existing) return badRequest("Vorlage nicht gefunden");

  const { count } = await supabase
    .from("message_template").select("id", { count: "exact", head: true }).eq("type", existing.type);
  if ((count ?? 0) <= 1) return badRequest("Die letzte Vorlage eines Typs kann nicht gelöscht werden");

  const { error } = await supabase.from("message_template").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
