import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/dictations/format — Rohtext → Berko AI Validator → Formatierter Text
export async function POST(request: NextRequest) {
  const { user } = await withAuth();
  if (!user) return unauthorized();

  const { raw_text } = await request.json();
  if (!raw_text?.trim()) {
    return NextResponse.json({ error: "raw_text fehlt" }, { status: 400 });
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system:
      "Du bist ein Assistent einer deutschen Hausverwaltung. " +
      "Du erhältst die rohe Sprachtranskription eines Diktats. Deine Aufgaben:\n" +
      "1. Korrigiere Transkriptionsfehler (falsch erkannte Wörter, Aussprachefehler).\n" +
      "2. Übersetze gesprochene Diktierzeichen in Symbole:\n" +
      "   'Komma' → ','\n" +
      "   'Punkt' → '.'\n" +
      "   'Neue Zeile' oder 'neue Zeile' → Zeilenumbruch\n" +
      "   'Neuer Absatz' oder 'neuer Absatz' → Leerzeile (Absatz)\n" +
      "   'Doppelpunkt' → ':'\n" +
      "   'Semikolon' → ';'\n" +
      "   'Gedankenstrich' → '—'\n" +
      "   'Ausrufezeichen' → '!'\n" +
      "   'Fragezeichen' → '?'\n" +
      "   'Anführungszeichen auf' → '\"'\n" +
      "   'Anführungszeichen zu' → '\"'\n" +
      "   'Klammer auf' → '('\n" +
      "   'Klammer zu' → ')'\n" +
      "3. Korrigiere Groß- und Kleinschreibung nach deutschen Rechtschreibregeln.\n" +
      "4. Formatiere den Text professionell und leserlich.\n" +
      "5. Antworte NUR mit dem formatierten Text — keine Erklärungen, keine Kommentare.",
    messages: [{ role: "user", content: raw_text }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const formatted = textBlock?.type === "text" ? textBlock.text.trim() : raw_text;

  return NextResponse.json({ formatted });
}
