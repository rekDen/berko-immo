import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getImapCredentials } from "@/lib/imap";

/**
 * Versand + Protokollierung einer Einladen/Ablehnen-Aktion (Spec §6.1
 * Schritt 4). Server-only (nodemailer) — geteilt zwischen der einzelnen
 * matching-action-Route und der Bulk-Ablehnung (§6.3), damit Versand-,
 * Audit- und Status-Update-Logik nicht zweimal gepflegt werden müssen.
 */
export async function sendMatchingAction(params: {
  supabase: SupabaseClient;
  tenantId: string;
  userId: string;
  applicantId: string;
  contactEmail: string;
  action: "invited" | "rejected";
  templateId: string | null;
  subject: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const credentials = await getImapCredentials(params.userId);
  if (!credentials) return { ok: false, error: "E-Mail-Versand nicht konfiguriert (IMAP/SMTP)" };

  const smtpHost = credentials.host.replace("imap.", "smtp.");
  const transporter = nodemailer.createTransport({
    host: smtpHost, port: 465, secure: true,
    auth: { user: credentials.user, pass: credentials.password },
  });

  try {
    await transporter.sendMail({
      from: `"${credentials.user.split("@")[0]}" <${credentials.email}>`,
      to: params.contactEmail,
      subject: params.subject,
      text: params.body,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMTP-Fehler" };
  }

  const { error: actionErr } = await params.supabase.from("matching_action").insert({
    tenant_id: params.tenantId,
    applicant_id: params.applicantId,
    action: params.action,
    template_id: params.templateId,
    rendered_subject: params.subject,
    rendered_message: params.body,
    performed_by: params.userId,
  });
  if (actionErr) return { ok: false, error: actionErr.message };

  const { error: statusErr } = await params.supabase
    .from("applicant").update({ status: params.action }).eq("id", params.applicantId);
  if (statusErr) return { ok: false, error: statusErr.message };

  return { ok: true };
}
