import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { APPLICANT_FIELDS, rescoreApplicant } from "@/lib/mietermatching/rescoring";

// GET /api/mietermatching/applicants?unit_id=...
// Liste aller Bewerber einer Einheit inkl. jeweils neuestem match_result
// (Spec §4: Übersicht sortiert nach overall_score absteigend).
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const unitId = request.nextUrl.searchParams.get("unit_id");
  if (!unitId) return badRequest("Pflichtparameter: unit_id");

  const { data: applicants, error } = await supabase
    .from("applicant")
    .select(APPLICANT_FIELDS)
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!applicants || applicants.length === 0) return NextResponse.json([]);

  const { data: results } = await supabase
    .from("match_result")
    .select("applicant_id, overall_score, confidence, computed_at")
    .in("applicant_id", applicants.map((a) => a.id))
    .order("computed_at", { ascending: false });

  const latestByApplicant = new Map<string, { overall_score: number; confidence: number; computed_at: string }>();
  for (const r of results ?? []) {
    if (!latestByApplicant.has(r.applicant_id)) latestByApplicant.set(r.applicant_id, r);
  }

  const withScore = applicants.map((a) => ({ ...a, match_result: latestByApplicant.get(a.id) ?? null }));
  withScore.sort((a, b) => (b.match_result?.overall_score ?? -1) - (a.match_result?.overall_score ?? -1));

  return NextResponse.json(withScore);
}

// POST /api/mietermatching/applicants
// Body: { unit_id, first_name, last_name, ...Bewerberfelder }. Berechnet den
// Match-Score synchron im selben Request (kein Queue-Job, s. Plan-Entscheidung)
// und legt sofort ein erstes match_result an.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.unit_id || !body.first_name || !body.last_name) {
    return badRequest("Pflichtfelder: unit_id, first_name, last_name");
  }

  const { data: profileExists } = await supabase
    .from("desired_tenant_profile").select("id").eq("unit_id", body.unit_id).maybeSingle();
  if (!profileExists) return badRequest("Für diese Einheit existiert noch kein Wunschmieter-Profil");

  const { data: applicant, error: insertErr } = await supabase
    .from("applicant")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      unit_id: body.unit_id,
      source: body.source ?? "manual",
      first_name: body.first_name,
      last_name: body.last_name,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      net_income: body.net_income ?? null,
      employment_type: body.employment_type ?? null,
      household_size: body.household_size ?? null,
      has_pets: body.has_pets ?? null,
      is_smoker: body.is_smoker ?? null,
      desired_move_in: body.desired_move_in ?? null,
      schufa_result: body.schufa_result ?? null,
      status: "new",
    })
    .select(APPLICANT_FIELDS)
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  let matchResult;
  try {
    matchResult = await rescoreApplicant(supabase, tenantId, applicant);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Score-Berechnung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ ...applicant, status: "scored", match_result: matchResult }, { status: 201 });
}
