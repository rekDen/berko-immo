import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { sendMatchingAction } from "@/lib/mietermatching/send-matching-action";
import { buildApplicantMessageVars, renderTemplate, DEFAULT_REJECTION_SUBJECT, DEFAULT_REJECTION_BODY } from "@/lib/mietermatching/message-templates";

// POST /api/mietermatching/applicants/bulk-reject
// Body: { applicant_ids: string[], template_id? }
// Spec §6.3: "Sammelbestätigung zeigt Anzahl betroffener Bewerber und die
// verwendete Vorlage; Einzel-Snapshots werden dennoch pro Bewerber in
// matching_action gespeichert (kein gemeinsamer Datensatz)." Anders als bei
// der Einzel-Aktion wird hier serverseitig gerendert — kein Verwalter-Edit
// je Bewerber vorgesehen, nur eine gemeinsame Vorlage für alle.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const applicantIds: string[] = body.applicant_ids ?? [];
  if (applicantIds.length === 0) return badRequest("Pflichtfeld: applicant_ids (nicht leer)");

  const { data: profile } = await supabase.from("profiles").select("name, firm_name").eq("id", user.id).single();

  let template: { id: string; subject: string; body: string } | null = null;
  if (body.template_id) {
    const { data } = await supabase.from("message_template").select("id, subject, body").eq("id", body.template_id).single();
    template = data ?? null;
  }

  const { data: applicants, error: applicantsErr } = await supabase
    .from("applicant")
    .select("id, first_name, last_name, contact_email, unit_id")
    .in("id", applicantIds);
  if (applicantsErr) return NextResponse.json({ error: applicantsErr.message }, { status: 500 });

  const unitIds = [...new Set((applicants ?? []).map((a) => a.unit_id))];
  const { data: units } = await supabase
    .from("units").select("id, unit_number, properties ( name, street, house_number, zip_code, city )").in("id", unitIds);
  const unitById = new Map((units ?? []).map((u) => [u.id, u]));

  const results: { applicant_id: string; ok: boolean; error?: string }[] = [];

  for (const applicant of applicants ?? []) {
    if (!applicant.contact_email) {
      results.push({ applicant_id: applicant.id, ok: false, error: "Keine E-Mail-Adresse hinterlegt" });
      continue;
    }
    const unit = unitById.get(applicant.unit_id);
    const property = unit?.properties as unknown as { name: string; street: string | null; house_number: string | null; zip_code: string | null; city: string | null } | null;
    const vars = buildApplicantMessageVars({
      firstName: applicant.first_name, lastName: applicant.last_name,
      unitLabel: unit ? `${property?.name ?? ""} · Einheit ${unit.unit_number}` : "",
      unitAddress: property ? `${property.street ?? ""} ${property.house_number ?? ""}, ${property.zip_code ?? ""} ${property.city ?? ""}`.trim() : "",
      managerName: profile?.name ?? "", firmName: profile?.firm_name ?? "",
    });
    const subject = renderTemplate(template?.subject ?? DEFAULT_REJECTION_SUBJECT, vars);
    const messageBody = renderTemplate(template?.body ?? DEFAULT_REJECTION_BODY, vars);

    const result = await sendMatchingAction({
      supabase, tenantId, userId: user.id, applicantId: applicant.id, contactEmail: applicant.contact_email,
      action: "rejected", templateId: template?.id ?? null, subject, body: messageBody,
    });
    results.push({ applicant_id: applicant.id, ok: result.ok, error: result.ok ? undefined : result.error });
  }

  return NextResponse.json({ results });
}
