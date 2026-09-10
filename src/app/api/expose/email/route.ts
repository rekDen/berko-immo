import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImapCredentials } from "@/lib/imap";

// POST /api/expose/email   multipart: pdf (File), to, subject, message
// Sends the exposé PDF as an email attachment via the configured SMTP account.
export async function POST(request: NextRequest) {
  const { user, tenantId } = await withAuth();
  if (!user || !tenantId) return unauthorized();

  const form    = await request.formData();
  const pdf     = form.get("pdf") as File | null;
  const to      = (form.get("to") as string | null)?.trim();
  const subject = (form.get("subject") as string | null)?.trim() || "Exposé";
  const message = (form.get("message") as string | null)?.trim() || "";

  if (!pdf || pdf.type !== "application/pdf") return badRequest("pdf (application/pdf) erforderlich");
  if (!to) return badRequest("Empfänger (to) erforderlich");

  const credentials = await getImapCredentials(user.id);
  if (!credentials) {
    return NextResponse.json({ error: "SMTP nicht konfiguriert – bitte E-Mail-Zugangsdaten hinterlegen" }, { status: 400 });
  }

  const pdfBuffer  = Buffer.from(await pdf.arrayBuffer());
  const smtpHost   = credentials.host.replace("imap.", "smtp.");
  const senderName = credentials.user.split("@")[0];

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 465,
    secure: true,
    auth: { user: credentials.user, pass: credentials.password },
  });

  try {
    const info = await transporter.sendMail({
      from:    `"${senderName}" <${credentials.email}>`,
      to,
      subject,
      text:    message,
      attachments: [{
        filename:    "expose.pdf",
        content:     pdfBuffer,
        contentType: "application/pdf",
      }],
    });

    // Save to sent-folder in emails table
    const admin = createAdminClient();
    await admin.from("emails").insert({
      tenant_id:    tenantId,
      created_by:   user.id,
      from_address: credentials.email,
      from_name:    senderName,
      to_address:   to,
      subject,
      body:         message,
      date:         new Date().toISOString(),
      category:     "intern",
      folder:       "sent",
      read:         true,
      starred:      false,
      ai_summary:   "",
      ai_draft:     "",
      message_id:   info.messageId,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "SMTP-Fehler" }, { status: 500 });
  }
}
