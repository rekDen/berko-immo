import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImapCredentials } from "@/lib/imap";

// POST /api/emails/send — E-Mail über SMTP (IONOS) versenden
export async function POST(request: NextRequest) {
  const { user, tenantId } = await withAuth();
  if (!user || !tenantId) return unauthorized();

  const body = await request.json();
  const { to, cc, bcc, subject, text, in_reply_to, references, draft_id } = body;

  if (!to || !subject || !text) {
    return badRequest("Pflichtfelder: to, subject, text");
  }

  const credentials = await getImapCredentials(user.id);
  if (!credentials) {
    return NextResponse.json(
      { error: "IMAP/SMTP nicht konfiguriert" },
      { status: 400 }
    );
  }

  const smtpHost = credentials.host.replace("imap.", "smtp.");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 465,
    secure: true,
    auth: {
      user: credentials.user,
      pass: credentials.password,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"${credentials.user.split("@")[0]}" <${credentials.email}>`,
      to,
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      subject,
      text,
      ...(in_reply_to ? { inReplyTo: in_reply_to, references } : {}),
    });

    const admin = createAdminClient();

    if (draft_id) {
      await admin.from("emails")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", draft_id);
    }

    await admin.from("emails").insert({
      tenant_id: tenantId,
      created_by: user.id,
      from_address: credentials.email,
      from_name: credentials.user.split("@")[0],
      to_address: to,
      cc: cc || null,
      bcc: bcc || null,
      subject,
      body: text,
      date: new Date().toISOString(),
      category: "intern",
      folder: "sent",
      read: true,
      starred: false,
      ai_summary: "",
      ai_draft: "",
      message_id: info.messageId,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP-Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
