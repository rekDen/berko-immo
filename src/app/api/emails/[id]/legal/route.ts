import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/emails/:id/legal — Rechtliche Bewertung via Claude Opus
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  const { data: email, error: fetchError } = await supabase
    .from("emails")
    .select("subject, body, from_address, from_name, date, category")
    .eq("id", id)
    .single();

  if (fetchError || !email) {
    return NextResponse.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      system:
        "Du bist ein erfahrener Rechtsanwalt in Deutschland mit Spezialisierung auf alle Rechtsbereiche " +
        "(Zivilrecht, Arbeitsrecht, Verwaltungsrecht, Strafrecht, Gesellschaftsrecht u.a.). " +
        "Analysiere die folgende E-Mail aus anwaltlicher Perspektive und erstelle eine strukturierte rechtliche Bewertung auf Deutsch. " +
        "Beziehe dich dabei auf aktuelle deutsche Rechtsprechung und Gesetzgebung (BGB, HGB, ZPO, StGB etc.) sowie ggf. EU-Recht. " +
        "Strukturiere deine Antwort klar mit diesen Abschnitten:\n" +
        "1. **Rechtliche Einordnung** – Welche Rechtsgebiete und -verhältnisse sind betroffen?\n" +
        "2. **Relevante Rechtsgrundlagen** – Konkrete Paragraphen, Gesetze, aktuelle BGH/BVerwG-Rechtsprechung\n" +
        "3. **Rechtliche Risiken & Chancen** – Was sind die wesentlichen rechtlichen Implikationen?\n" +
        "4. **Fristen & Handlungsbedarf** – Gibt es Fristen (Verjährung, Einspruchsfristen etc.)? Was muss sofort gehandelt werden?\n" +
        "5. **Empfohlene Maßnahmen** – Konkrete anwaltliche Handlungsempfehlungen\n\n" +
        "Weise bei Unklarheiten auf den Bedarf zur Sachverhaltsaufklärung hin. " +
        "Füge am Ende einen Haftungshinweis ein, dass dies eine KI-gestützte Ersteinschätzung ist.",
      messages: [
        {
          role: "user",
          content:
            `Von: ${email.from_name} <${email.from_address}>\n` +
            `Datum: ${new Date(email.date).toLocaleDateString("de-DE")}\n` +
            `Betreff: ${email.subject}\n` +
            `Kategorie: ${email.category}\n\n` +
            `${email.body}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const legal = textBlock?.type === "text" ? textBlock.text.trim() : "Bewertung nicht verfügbar";

    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("emails")
      .update({ ai_legal: legal })
      .eq("id", id);

    if (updateError) {
      console.error("[Legal] DB-Update fehlgeschlagen:", updateError.message);
      return NextResponse.json(
        { error: `Speichern fehlgeschlagen: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ legal });
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
