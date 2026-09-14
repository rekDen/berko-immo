import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

const FIELDS = `id, type, name, subject, body, channel, is_default, active, created_at, updated_at`;

// GET /api/mietermatching/message-templates?type=invitation|rejection
// Spec §7: CRUD für Vorlagen, nach type gruppiert.
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const type = request.nextUrl.searchParams.get("type");
  let query = supabase.from("message_template").select(FIELDS).order("type").order("name");
  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/mietermatching/message-templates
// Body: { type, name, subject, body, channel?, is_default?, active? }
// Wird is_default=true gesetzt, verliert jede andere Vorlage desselben type
// den Default-Status (genau eine Default-Vorlage je type, Spec §7).
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.type || !body.name || !body.subject || !body.body) {
    return badRequest("Pflichtfelder: type, name, subject, body");
  }
  if (body.type !== "invitation" && body.type !== "rejection") return badRequest("type muss 'invitation' oder 'rejection' sein");

  if (body.is_default) {
    await supabase.from("message_template").update({ is_default: false }).eq("type", body.type);
  }

  const { data, error } = await supabase
    .from("message_template")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      type: body.type,
      name: body.name,
      subject: body.subject,
      body: body.body,
      channel: body.channel ?? "email",
      is_default: body.is_default ?? false,
      active: body.active ?? true,
    })
    .select(FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
