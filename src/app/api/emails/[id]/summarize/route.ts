import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/emails/:id/summarize
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
      max_tokens: 300,
      system:
        "Du bist ein juristischer Assistent in einer deutschen Hausverwaltung. " +
        "Fasse die folgende E-Mail in 1-3 kurzen, prägnanten Sätzen auf Deutsch zusammen. " +
        "Hebe die wichtigsten Fakten, Fristen, Termine und Handlungsaufforderungen hervor. " +
        "Antworte nur mit der Zusammenfassung, ohne Einleitung oder Anrede.",
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
    const summary = textBlock?.type === "text"
      ? textBlock.text.trim()
      : "Zusammenfassung nicht verfügbar";

    const admin = createAdminClient();
    await admin
      .from("emails")
      .update({ ai_summary: summary })
      .eq("id", id);

    return NextResponse.json({ summary });
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
