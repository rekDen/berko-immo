import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/dashboard/briefing — KI-Briefing für heute generieren
export async function POST(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { deadlines, emails, dictationsThisWeek } = await request.json();

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const deadlineText = deadlines.length === 0
    ? "Keine dringenden Fristen oder Termine."
    : deadlines.map((d: { title: string; az: string; type: string; date: string; daysUntil: number; description: string }) =>
        `- ${d.type === "frist" ? "Frist" : "Termin"}: "${d.title}" (Az: ${d.az}) — ${
          d.daysUntil < 0 ? "ÜBERFÄLLIG" : d.daysUntil === 0 ? "HEUTE" : `in ${d.daysUntil} Tag${d.daysUntil === 1 ? "" : "en"}`
        }${d.description ? `, ${d.description}` : ""}`
      ).join("\n");

  const emailText = emails.length === 0
    ? "Keine ungelesenen E-Mails."
    : emails.map((e: { fromName: string; subject: string; category: string; date: string }) =>
        `- Von: ${e.fromName} | Betreff: "${e.subject}" | Kategorie: ${e.category}`
      ).join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system:
      "Du bist der persönliche KI-Assistent eines deutschen Rechtsanwalts. " +
      "Erstelle ein prägnantes, professionelles Tagesbriefing auf Deutsch. " +
      "Hebe die wichtigsten Handlungsbedarfe hervor — priorisiere nach Dringlichkeit. " +
      "Schreibe in kurzen, klaren Sätzen. Maximal 4 Absätze. " +
      "Verwende **fett** für besonders wichtige Begriffe (Fristen, Namen, Aktenzeichen). " +
      "Beginne direkt mit dem Inhalt ohne Anrede oder Einleitung.",
    messages: [{
      role: "user",
      content:
        `Heute ist ${today}.\n\n` +
        `DRINGENDE FRISTEN & TERMINE (nächste 14 Tage):\n${deadlineText}\n\n` +
        `UNGELESENE E-MAILS:\n${emailText}\n\n` +
        `WEITERE KENNZAHLEN:\n` +
        `- Diktate diese Woche: ${dictationsThisWeek}`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const briefing = textBlock?.type === "text" ? textBlock.text.trim() : "";
  return NextResponse.json({ briefing });
}
