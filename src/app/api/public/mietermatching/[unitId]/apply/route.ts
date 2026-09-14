import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_BY_DOC_TYPE } from "@/lib/mietermatching/document-categories";
import { rescoreApplicant, type ApplicantRow } from "@/lib/mietermatching/rescoring";
import type { ApplicantDocType } from "@/lib/mietermatching/scoring";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };
const DOC_TYPES: ApplicantDocType[] = ["income_proof", "schufa", "self_disclosure", "other"];

// POST /api/public/mietermatching/[unitId]/apply — ÖFFENTLICH, kein Auth.
// multipart/form-data: first_name, last_name, contact_email, contact_phone?,
// net_income?, employment_type?, household_size?, desired_move_in?,
// + je Dokumenttyp optional eine Datei unter dem Feldnamen "doc_<type>"
// (z. B. "doc_income_proof"). Legt Bewerber + Unterlagen genauso an wie die
// interne Erfassung (POST /api/mietermatching/applicants +
// /applicant-documents), nur ohne Session — Aufrufer ist der Bewerber
// selbst, tenant_id wird ausschließlich serverseitig aus der Einheit
// abgeleitet, nie aus dem Request übernommen.
export async function POST(request: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const admin = createAdminClient();

  const { data: unit, error: unitErr } = await admin
    .from("units").select("id, tenant_id").eq("id", unitId).is("deleted_at", null).single();
  if (unitErr || !unit) return NextResponse.json({ error: "Einheit nicht gefunden" }, { status: 404 });

  const { data: profile, error: profileErr } = await admin
    .from("desired_tenant_profile").select("id").eq("unit_id", unitId).is("deleted_at", null).maybeSingle();
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Für diese Einheit ist aktuell keine Bewerbung möglich" }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const firstName = (form.get("first_name") as string | null)?.trim();
  const lastName = (form.get("last_name") as string | null)?.trim();
  const contactEmail = (form.get("contact_email") as string | null)?.trim();
  if (!firstName || !lastName || !contactEmail) {
    return NextResponse.json({ error: "Pflichtfelder: Vorname, Nachname, E-Mail" }, { status: 400 });
  }

  const netIncomeRaw = form.get("net_income") as string | null;
  const householdSizeRaw = form.get("household_size") as string | null;

  const { data: applicant, error: insertErr } = await admin
    .from("applicant")
    .insert({
      tenant_id: unit.tenant_id,
      unit_id: unitId,
      source: "web_form",
      first_name: firstName,
      last_name: lastName,
      contact_email: contactEmail,
      contact_phone: (form.get("contact_phone") as string | null)?.trim() || null,
      net_income: netIncomeRaw ? Number(netIncomeRaw) : null,
      employment_type: (form.get("employment_type") as string | null) || null,
      household_size: householdSizeRaw ? Number(householdSizeRaw) : null,
      desired_move_in: (form.get("desired_move_in") as string | null) || null,
      status: "new",
    })
    .select("id, unit_id, net_income, employment_type, household_size, desired_move_in, schufa_result, status")
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  for (const docType of DOC_TYPES) {
    const file = form.get(`doc_${docType}`);
    if (!(file instanceof File) || file.size === 0) continue;

    const ext = ALLOWED_MIME[file.type];
    if (!ext) continue; // unbekannter/nicht erlaubter Dateityp wird stillschweigend übersprungen
    if (file.size > MAX_FILE_BYTES) continue;

    const storagePath = `${unitId}/unit/mietermatching/${crypto.randomUUID()}.${ext}`;
    const { error: storageErr } = await admin.storage.from("documents").upload(storagePath, file, { contentType: file.type });
    if (storageErr) continue; // ein einzelner Upload-Fehler soll die restliche Bewerbung nicht blockieren

    const { data: doc, error: docErr } = await admin
      .from("documents")
      .insert({
        tenant_id: unit.tenant_id,
        category_id: CATEGORY_BY_DOC_TYPE[docType],
        level: "unit",
        unit_id: unitId,
        title: file.name.replace(/\.[^.]+$/, ""),
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        internal_only: true,
      })
      .select("id")
      .single();
    if (docErr || !doc) continue;

    await admin.from("applicant_document").insert({
      tenant_id: unit.tenant_id, applicant_id: applicant.id, document_id: doc.id, doc_type: docType,
    });
  }

  try {
    await rescoreApplicant(admin, unit.tenant_id, applicant as ApplicantRow);
  } catch {
    // Bewerbung ist angelegt; Score wird beim nächsten Aufruf der internen Ansicht ohnehin neu berechnet.
  }

  return NextResponse.json({ ok: true });
}
