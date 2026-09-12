import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { badRequest, unauthorized, withAuth } from "@/lib/supabase/api";

const anthropic = new Anthropic();

const SYSTEM = `Du bist Berko AI, ein spezialisierter Immobilien-Planungsberater.
Du hilfst dabei, eine konkrete Value-Add-Maßnahme für ein Objekt wirtschaftlich durchzudenken.
Führe ein strukturiertes Gespräch zu diesen vier Aspekten — frage aktiv nach, wenn Zahlen fehlen:
1. Investitionskosten (€ gesamt inkl. Nebenkosten, Planung, Reserve)
2. Laufender Mehrertrag p.a. (€) nach vollständiger Umsetzung
3. Mietausfall / Ertragsausfall während der Bauphase (€ p.a. hochgerechnet)
4. Umsetzungsdauer (Monate)

Halte deine Antworten prägnant und strukturiert. Rechne Beispiele durch wenn hilfreich.
Weise auf Risiken und Abhängigkeiten hin (z.B. Baugenehmigung, Mieterrechte, Finanzierung).
Du rechnest nur illustrativ — bindende Wirtschaftlichkeitsrechnung macht die deterministische Engine.`;

// POST /api/optimization/planung
// Body: { messages: [{role, content}][], kontext: { label, begruendung, property_name } }
// Streams SSE: data: {"text":"..."}\n\n  …  data: [DONE]\n\n
export async function POST(request: NextRequest) {
  const { user } = await withAuth();
  if (!user) return unauthorized();

  const body = await request.json();
  if (!body.messages?.length) return badRequest("Pflichtfeld: messages");

  const { kontext, messages } = body as {
    kontext: { label: string; begruendung: string; property_name: string };
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const system = `${SYSTEM}

Kontext dieser Maßnahme:
- Objekt: ${kontext.property_name}
- Maßnahme: ${kontext.label}
- KI-Begründung: ${kontext.begruendung}`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system,
          messages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

// POST /api/optimization/planung?action=extrahieren
// Extrahiert strukturierte Kennzahlen aus dem Gesprächsverlauf per Tool-Use.
// Body: { messages: [{role,content}][], kontext }
export async function PUT(request: NextRequest) {
  const { user } = await withAuth();
  if (!user) return unauthorized();

  const { messages, kontext } = await request.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    kontext: { label: string; begruendung: string; property_name: string };
  };

  const tool: Anthropic.Tool = {
    name: "kennzahlen",
    description: "Extrahiert die im Gespräch besprochenen Kennzahlen für die Maßnahme. Nur Werte verwenden, die explizit besprochen wurden.",
    input_schema: {
      type: "object",
      properties: {
        invest_eur:            { type: "number", description: "Gesamte Investitionskosten in €" },
        ertragswirkung_pa_eur: { type: "number", description: "Laufender Mehrertrag pro Jahr in € nach Umsetzung" },
        mietausfall_pa_eur:    { type: "number", description: "Mietausfall / Ertragsausfall während Bauphase, hochgerechnet auf 1 Jahr in €" },
        dauer_monate:          { type: "number", description: "Geschätzte Umsetzungsdauer in Monaten" },
        notizen:               { type: "string", description: "Wichtige Hinweise, Risiken oder Annahmen aus dem Gespräch (max. 3 Sätze)" },
      },
    },
  };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `${SYSTEM}\n\nObjekt: ${kontext.property_name}\nMaßnahme: ${kontext.label}\nBegründung: ${kontext.begruendung}`,
    tools: [tool],
    tool_choice: { type: "tool", name: "kennzahlen" },
    messages: [
      ...messages,
      { role: "user", content: "Fasse jetzt alle besprochenen Kennzahlen über das Tool zusammen." },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (toolUse?.type !== "tool_use") return NextResponse.json({ error: "Keine Extraktion möglich" }, { status: 422 });
  return NextResponse.json(toolUse.input);
}
