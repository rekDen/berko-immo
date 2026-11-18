import nodemailer from "nodemailer";

/**
 * System-weiter Benachrichtigungsversand — nicht an das IMAP/SMTP-Konto
 * eines einzelnen Nutzers gebunden (anders als src/lib/imap.ts), sondern an
 * das feste Service-Postfach, über das bereits der Anna/ElevenLabs-Webhook
 * verschickt (src/app/api/leads/route.ts) — dieselben SMTP_*-Umgebungs­
 * variablen. Fehler werden hier bewusst nicht geworfen: eine fehlgeschlagene
 * Benachrichtigung darf nie den auslösenden Vorgang (z. B. einen Login)
 * blockieren oder fehlschlagen lassen.
 */
export async function sendSystemNotification(params: { to: string; subject: string; text: string }): Promise<void> {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWD },
    });
    await transporter.sendMail({
      from: '"Berko AI System" <service@berko.ai>',
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
  } catch (e) {
    console.error("[notify] Versand fehlgeschlagen:", e);
  }
}
