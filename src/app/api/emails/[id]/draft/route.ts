import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/emails/:id/draft — KI-Antwort via Berko AI Validator generieren
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  const { data: email, error: fetchError } = await supabase
    .from("emails")
    .select("subject, body, from_address, from_name, date")
    .eq("id", id)
    .single();

  if (fetchError || !email) {
    return NextResponse.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system:
        "Du bist ein juristischer Assistent in einer deutschen Hausverwaltung. " +
        "Verfasse eine professionelle, präzise Antwort auf die folgende E-Mail auf Deutsch. " +
        "Halte die Antwort sachlich und höflich. " +
        "Beginne direkt mit der Anrede (z.B. 'Sehr geehrte Frau ..., / Sehr geehrter Herr ...,').  " +
        "Schließe mit einer professionellen Grußformel ab. " +
        "Antworte nur mit dem Antworttext, ohne Betreff oder Metadaten.",
      messages: [
        {
          role: "user",
          content:
            `Von: ${email.from_name} <${email.from_address}>\n` +
            `Datum: ${new Date(email.date).toLocaleDateString("de-DE")}\n` +
            `Betreff: ${email.subject}\n\n` +
            `${email.body}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const draft = textBlock?.type === "text" ? textBlock.text.trim() : "";

    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("[Claude] API-Fehler:", err.status, err.message);
      return NextResponse.json(
        { error: `Claude API-Fehler: ${err.status}` },
        { status: 502 }
      );
    }
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[Claude] Fehler:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
