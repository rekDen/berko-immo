import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_CHANNELS = [
  "email", "phone", "letter", "meeting", "online_meeting", "portal", "note",
];

// POST /api/tickets/:id/communications — Notiz oder existierende E-Mail anhängen
export async function POST(request: NextRequest, { params }: Params) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id: ticketId } = await params;
  const body = await request.json();

  // Variante A: existierende E-Mail referenzieren
  if (body.email_id) {
    const { data: email, error: emailErr } = await supabase
      .from("emails")
      .select("from_address, from_name, subject, body, date, to_address")
      .eq("id", body.email_id)
      .single();
    if (emailErr || !email) return badRequest("E-Mail nicht gefunden");

    const direction = body.direction ?? (email.to_address ? "outbound" : "inbound");

    const { data: ticket } = await supabase
      .from("tickets")
      .select("contact_id")
      .eq("id", ticketId)
      .single();

    const { data, error } = await supabase
      .from("communications")
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        ticket_id: ticketId,
        contact_id: body.contact_id ?? ticket?.contact_id ?? null,
        channel: "email",
        direction,
        subject: email.subject,
        body: email.body,
        occurred_at: email.date,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  // Variante B: Notiz / Telefonat / Meeting
  if (!body.channel || !ALLOWED_CHANNELS.includes(body.channel)) {
    return badRequest("channel ist erforderlich (phone, meeting, online_meeting, note, …)");
  }
  if (!body.body) return badRequest("body ist erforderlich");

  const direction = body.direction ?? "outbound";
  const occurredAt = body.occurred_at ?? new Date().toISOString();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("contact_id")
    .eq("id", ticketId)
    .single();

  const { data, error } = await supabase
    .from("communications")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      ticket_id: ticketId,
      contact_id: body.contact_id ?? ticket?.contact_id ?? null,
      channel: body.channel,
      direction,
      subject: body.subject ?? null,
      body: body.body,
      occurred_at: occurredAt,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
