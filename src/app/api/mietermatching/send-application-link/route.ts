import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { getImapCredentials } from "@/lib/imap";

// POST /api/mietermatching/send-application-link
// Body: { unit_id, emails: string[] }
// Verschickt den öffentlichen Bewerbungslink (/bewerbung/[unitId]) per
// E-Mail an eine oder mehrere Adressen — ein Klick statt manuellem Kopieren
// + eigenem Versand. Getrennter Versand je Empfänger (nicht als gemeinsame
// To-Liste), damit Interessenten sich gegenseitig nicht sehen. Nutzt
// dieselbe IMAP/SMTP-Konfiguration des Verwalters wie der reguläre
// E-Mail-Versand und die Einladen/Ablehnen-Aktionen.
export async function POST(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const body = await request.json();
  const unitId: string | undefined = body.unit_id;
  const emails: string[] = Array.isArray(body.emails)
    ? [...new Set(body.emails.map((e: string) => e.trim()).filter(Boolean))] as string[]
    : [];
  if (!unitId) return badRequest("Pflichtfeld: unit_id");
  if (emails.length === 0) return badRequest("Mindestens eine E-Mail-Adresse erforderlich");
  const invalid = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (invalid.length > 0) return badRequest(`Ungültige E-Mail-Adresse(n): ${invalid.join(", ")}`);

  const { data: unit, error: unitErr } = await supabase
    .from("units")
    .select("unit_number, properties ( name, street, house_number, zip_code, city )")
    .eq("id", unitId)
    .single();
  if (unitErr || !unit) return badRequest("Einheit nicht gefunden");

  const { data: profile } = await supabase
    .from("desired_tenant_profile").select("id").eq("unit_id", unitId).maybeSingle();
  if (!profile) return badRequest("Für diese Einheit existiert noch kein Wunschmieter-Profil");

  const { data: profileRow } = await supabase.from("profiles").select("name, firm_name").eq("id", user.id).single();

  const credentials = await getImapCredentials(user.id);
  if (!credentials) return badRequest("E-Mail-Versand nicht konfiguriert (IMAP/SMTP)");

  const smtpHost = credentials.host.replace("imap.", "smtp.");
  const transporter = nodemailer.createTransport({
    host: smtpHost, port: 465, secure: true,
    auth: { user: credentials.user, pass: credentials.password },
  });

  const property = unit.properties as unknown as { name: string; street: string | null; house_number: string | null; zip_code: string | null; city: string | null } | null;
  const unitLabel = `${property?.name ?? ""} · Einheit ${unit.unit_number}`;
  const address = property ? `${property.street ?? ""} ${property.house_number ?? ""}, ${property.zip_code ?? ""} ${property.city ?? ""}`.replace(/\s+/g, " ").trim() : "";
  const link = `${request.nextUrl.origin}/bewerbung/${unitId}`;
  const subject = `Bewerbungslink für ${unitLabel}`;
  const text =
    `Sehr geehrte Damen und Herren,\n\n` +
    `Sie können sich über den folgenden Link für die Wohnung ${unitLabel}${address ? `, ${address}` : ""} bewerben:\n\n` +
    `${link}\n\n` +
    `Bitte halten Sie ggf. einen Einkommensnachweis und weitere Unterlagen zum Hochladen bereit.\n\n` +
    `Mit freundlichen Grüßen\n${profileRow?.name ?? ""}\n${profileRow?.firm_name ?? ""}`;

  const results: { email: string; ok: boolean; error?: string }[] = [];
  for (const email of emails) {
    try {
      await transporter.sendMail({
        from: `"${credentials.user.split("@")[0]}" <${credentials.email}>`,
        to: email,
        subject,
        text,
      });
      results.push({ email, ok: true });
    } catch (e) {
      results.push({ email, ok: false, error: e instanceof Error ? e.message : "SMTP-Fehler" });
    }
  }

  return NextResponse.json({ results });
}
