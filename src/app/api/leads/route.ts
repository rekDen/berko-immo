import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const API_KEY = process.env.ELEVENLABS_TO_BERKO_KEY;

export async function POST(request: NextRequest) {
  if (request.headers.get("api_key") !== API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { summary, name, phone_number, company_name } = body;

  if (!summary || !name || !phone_number) {
    return NextResponse.json(
      { error: "Pflichtfelder: summary, name, phone_number" },
      { status: 400 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWD},
  });

  const subject = company_name
    ? `Neuer Anruf: ${name} (${company_name})`
    : `Neuer Anruf: ${name}`;

  const text = [
    `Name: ${name}`,
    company_name ? `Firma: ${company_name}` : null,
    `Telefon: ${phone_number}`,
    ``,
    `Zusammenfassung:`,
    summary,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await transporter.sendMail({
      from: '"Anna von Berko AI" <service@berko.ai>',
      to: "koehler@berko.ai",
      subject,
      text,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP-Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
