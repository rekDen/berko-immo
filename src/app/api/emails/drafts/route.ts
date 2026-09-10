import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/emails/drafts — Entwurf speichern (neu oder aktualisieren)
export async function POST(request: NextRequest) {
  const { user, tenantId } = await withAuth();
  if (!user || !tenantId) return unauthorized();

  const body = await request.json();
  const { id, to, cc, bcc, subject, text } = body;

  if (!subject && !text && !to) {
    return badRequest("Entwurf ist leer");
  }

  const admin = createAdminClient();

  if (id) {
    const { data, error } = await admin
      .from("emails")
      .update({
        to_address: to || null,
        cc: cc || null,
        bcc: bcc || null,
        subject: subject || "",
        body: text || "",
        date: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("folder", "draft")
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await admin
    .from("emails")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      from_address: "",
      from_name: "",
      to_address: to || null,
      cc: cc || null,
      bcc: bcc || null,
      subject: subject || "(Kein Betreff)",
      body: text || "",
      date: new Date().toISOString(),
      category: "intern",
      folder: "draft",
      read: true,
      starred: false,
      ai_summary: "",
      ai_draft: "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
