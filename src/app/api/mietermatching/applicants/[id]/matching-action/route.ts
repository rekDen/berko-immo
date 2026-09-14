import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { sendMatchingAction } from "@/lib/mietermatching/send-matching-action";

// POST /api/mietermatching/applicants/[id]/matching-action
// Body: { action: 'invited'|'rejected', template_id?, subject, body }
// Spec §6.1: Versand des vom Verwalter im Bestätigungsdialog geprüften/
// editierten Texts, dann Status-Update + Audit-Log (matching_action, append-
// only). subject/body kommen bereits fertig gerendert vom Client (aus
// message-templates.ts, isomorph nutzbar) — diese Route rendert nichts neu,
// sie versendet und protokolliert exakt das, was der Verwalter gesehen hat.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  const { action, template_id, subject, body: messageBody } = body;
  if (action !== "invited" && action !== "rejected") return badRequest("action muss 'invited' oder 'rejected' sein");
  if (!subject || !messageBody) return badRequest("Pflichtfelder: subject, body");

  const { data: applicant, error: applicantErr } = await supabase
    .from("applicant").select("id, contact_email").eq("id", id).single();
  if (applicantErr || !applicant) return badRequest("Bewerber nicht gefunden");
  if (!applicant.contact_email) return badRequest("Bewerber hat keine E-Mail-Adresse hinterlegt");

  const result = await sendMatchingAction({
    supabase, tenantId, userId: user.id, applicantId: id, contactEmail: applicant.contact_email,
    action, templateId: template_id ?? null, subject, body: messageBody,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true, status: action });
}
