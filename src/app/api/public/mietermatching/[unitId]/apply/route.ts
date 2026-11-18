import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_BY_DOC_TYPE } from "@/lib/mietermatching/document-categories";
import { rescoreApplicant, type ApplicantRow } from "@/lib/mietermatching/rescoring";
import type { ApplicantDocType } from "@/lib/mietermatching/scoring";
import { getClientIp } from "@/lib/request-ip";
import { rateLimit } from "@/lib/rate-limit";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_REQUEST_BYTES = 4 * MAX_FILE_BYTES + 1024 * 1024; // alle Dokumente + Formularfelder
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 Stunde

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAGIC: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpg: [0xff, 0xd8, 0xff],
};

function matchesMagicBytes(ext: string, bytes: Uint8Array): boolean {
  const sig = MAGIC[ext];
  return !!sig && bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function safeFileName(name: string): string {
  // Pfadanteile und Steuerzeichen entfernen, Länge begrenzen
  return (name.split(/[\\/]/).pop() ?? "datei").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200) || "datei";
}

function serverError(step: string, detail?: string) {
  console.error(`[mietermatching/apply] ${step} fehlgeschlagen:`, detail);
  return NextResponse.json({ error: "Bewerbung konnte nicht gespeichert werden" }, { status: 500 });
}
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
  if (!UUID_RE.test(unitId)) return NextResponse.json({ error: "Einheit nicht gefunden" }, { status: 404 });

  // Missbrauchsschutz: Limit pro IP (gesamt) und pro IP + Einheit.
  const ip = getClientIp(request) ?? "unknown";
  for (const [key, limit] of [[`apply:ip:${ip}`, 20], [`apply:ip-unit:${ip}:${unitId}`, 5]] as const) {
    const rl = rateLimit(key, limit, RATE_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Anfrage zu groß" }, { status: 413 });
  }

  const admin = createAdminClient();

  const { data: unit, error: unitErr } = await admin
    .from("units").select("id, tenant_id").eq("id", unitId).is("deleted_at", null).single();
  if (unitErr || !unit) return NextResponse.json({ error: "Einheit nicht gefunden" }, { status: 404 });

  const { data: profile, error: profileErr } = await admin
    .from("desired_tenant_profile").select("id").eq("unit_id", unitId).is("deleted_at", null).maybeSingle();
  if (profileErr) return serverError("Profil laden", profileErr.message);
  if (!profile) return NextResponse.json({ error: "Für diese Einheit ist aktuell keine Bewerbung möglich" }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  // Honeypot: Feld ist im Formular unsichtbar, nur Bots füllen es aus.
  // Antwort sieht erfolgreich aus, damit Bots nichts lernen.
  if (str(form, "website")) return NextResponse.json({ ok: true });

  const firstName = str(form, "first_name");
  const lastName = str(form, "last_name");
  const contactEmail = str(form, "contact_email");
  if (!firstName || !lastName || !contactEmail) {
    return NextResponse.json({ error: "Pflichtfelder: Vorname, Nachname, E-Mail" }, { status: 400 });
  }
  if (firstName.length > 100 || lastName.length > 100) {
    return NextResponse.json({ error: "Name ist zu lang" }, { status: 400 });
  }
  if (contactEmail.length > 254 || !EMAIL_RE.test(contactEmail)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  const contactPhone = str(form, "contact_phone");
  if (contactPhone && contactPhone.length > 50) {
    return NextResponse.json({ error: "Telefonnummer ist zu lang" }, { status: 400 });
  }
  const employmentType = str(form, "employment_type");
  if (employmentType && employmentType.length > 50) {
    return NextResponse.json({ error: "Ungültige Beschäftigungsart" }, { status: 400 });
  }

  const netIncomeRaw = str(form, "net_income");
  const netIncome = netIncomeRaw ? Number(netIncomeRaw) : null;
  if (netIncome !== null && !(Number.isFinite(netIncome) && netIncome >= 0 && netIncome <= 10_000_000)) {
    return NextResponse.json({ error: "Ungültiges Nettoeinkommen" }, { status: 400 });
  }
  const householdSizeRaw = str(form, "household_size");
  const householdSize = householdSizeRaw ? Number(householdSizeRaw) : null;
  if (householdSize !== null && !(Number.isInteger(householdSize) && householdSize >= 1 && householdSize <= 50)) {
    return NextResponse.json({ error: "Ungültige Haushaltsgröße" }, { status: 400 });
  }
  const desiredMoveIn = str(form, "desired_move_in");
  if (desiredMoveIn && !DATE_RE.test(desiredMoveIn)) {
    return NextResponse.json({ error: "Ungültiges Einzugsdatum" }, { status: 400 });
  }

  const { data: applicant, error: insertErr } = await admin
    .from("applicant")
    .insert({
      tenant_id: unit.tenant_id,
      unit_id: unitId,
      source: "web_form",
      first_name: firstName,
      last_name: lastName,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      net_income: netIncome,
      employment_type: employmentType || null,
      household_size: householdSize,
      desired_move_in: desiredMoveIn || null,
      status: "new",
    })
    .select("id, unit_id, net_income, employment_type, household_size, desired_move_in, schufa_result, status")
    .single();
  if (insertErr || !applicant) return serverError("Bewerber anlegen", insertErr?.message);

  for (const docType of DOC_TYPES) {
    const file = form.get(`doc_${docType}`);
    if (!(file instanceof File) || file.size === 0) continue;

    const ext = ALLOWED_MIME[file.type];
    if (!ext) continue; // unbekannter/nicht erlaubter Dateityp wird stillschweigend übersprungen
    if (file.size > MAX_FILE_BYTES) continue;

    // Content-Type kommt vom Client: tatsächlichen Inhalt anhand der Magic Bytes prüfen.
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesMagicBytes(ext, bytes)) continue;

    const storagePath = `${unitId}/unit/mietermatching/${crypto.randomUUID()}.${ext}`;
    const { error: storageErr } = await admin.storage.from("documents").upload(storagePath, bytes, { contentType: file.type });
    if (storageErr) continue; // ein einzelner Upload-Fehler soll die restliche Bewerbung nicht blockieren

    const { data: doc, error: docErr } = await admin
      .from("documents")
      .insert({
        tenant_id: unit.tenant_id,
        category_id: CATEGORY_BY_DOC_TYPE[docType],
        level: "unit",
        unit_id: unitId,
        title: safeFileName(file.name).replace(/\.[^.]+$/, ""),
        storage_path: storagePath,
        file_name: safeFileName(file.name),
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
