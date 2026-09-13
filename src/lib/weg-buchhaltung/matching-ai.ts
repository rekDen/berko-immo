import Anthropic from "@anthropic-ai/sdk";

/**
 * B8.2 Stufe 3 (KI) — hausgeldabrechnung-spec.md: "nur für Umsätze ohne
 * Vorschlag aus Stufe 2. Die Eingabe enthält Verwendungszweck, Betrag,
 * Richtung, bei Ausgängen den Namen der Gegenpartei und die Kostenarten der
 * WEG. Eigentümerlisten werden nicht übermittelt; der Namensabgleich bleibt
 * deterministisch. Die Ausgabe wird gegen ein JSON-Schema validiert und nur
 * als Vorschlag gespeichert."
 *
 * Bewusste Konsequenz aus "Eigentümerlisten werden nicht übermittelt": Stufe 3
 * kann für Eingänge keine Eigentümerpartei vorschlagen (das bliebe Stufe 1/2
 * vorbehalten) — sie schlägt ausschließlich eine Kostenart vor, für Eingänge
 * wie Ausgänge gleichermaßen. Die Kostenart wird über ein `enum` im
 * Tool-Schema zwingend aus der tatsächlichen Kostenartenliste der WEG
 * gewählt (wie schon bei K1, s. extract-invoice/route.ts) — die KI kann keine
 * Kostenart erfinden.
 */

const anthropic = new Anthropic();

export interface Stage3CostTypeCandidate {
  id: string;
  name: string;
  direction: "expense" | "income";
}

export interface Stage3Input {
  purpose: string | null;
  amountCents: number;
  /** Nur bei Ausgängen gesetzt (Spec: Eigentümerlisten/-namen bei Eingängen nicht übermitteln). */
  counterpartyName: string | null;
}

export interface Stage3Suggestion {
  costTypeId: string;
  confidence: number | null;
  reasoning: string | null;
}

/** Ruft Claude für einen einzelnen unaufgelösten Umsatz auf. Liefert `null`,
 * wenn keine passende Kostenart erkannt wird oder die Antwort ungültig ist. */
export async function suggestCostTypeStage3(
  input: Stage3Input,
  candidates: Stage3CostTypeCandidate[],
): Promise<Stage3Suggestion | null> {
  const direction = input.amountCents >= 0 ? "income" : "expense";
  const eligible = candidates.filter((c) => c.direction === direction);
  if (eligible.length === 0) return null;

  const tool: Anthropic.Tool = {
    name: "kostenart_vorschlag",
    description: "Vorschlag für die Kostenart eines Bankumsatzes einer WEG. Nur eine tatsächlich vorhandene Kostenart wählen; wenn keine passt, das Tool ohne cost_type_id aufrufen.",
    input_schema: {
      type: "object",
      properties: {
        cost_type_id: { type: "string", enum: eligible.map((c) => c.id), description: `Passende Kostenart: ${eligible.map((c) => `${c.id} = "${c.name}"`).join(", ")}` },
        confidence: { type: "number", minimum: 0, maximum: 1, description: "Eigene Einschätzung der Sicherheit (0-1)" },
        reasoning: { type: "string", description: "Kurze Begründung (ein Satz)" },
      },
    },
  };

  const eur = (cents: number) => (Math.abs(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const lines = [
    `Verwendungszweck: ${input.purpose ?? "(keiner)"}`,
    `Betrag: ${eur(input.amountCents)}`,
    `Richtung: ${direction === "income" ? "Eingang" : "Ausgang"}`,
  ];
  if (direction === "expense" && input.counterpartyName) lines.push(`Gegenpartei: ${input.counterpartyName}`);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system:
        "Du kategorisierst Bankumsätze für die Buchhaltung einer deutschen Wohnungseigentümergemeinschaft (WEG). " +
        "Weder Regeln noch Heuristik konnten diesen Umsatz zuordnen. Wähle eine Kostenart ausschließlich aus der " +
        "vorgegebenen Liste, wenn eine plausibel passt — sonst rufe das Tool ohne cost_type_id auf. Erfinde nichts.",
      tools: [tool],
      tool_choice: { type: "tool", name: "kostenart_vorschlag" },
      messages: [{ role: "user", content: lines.join("\n") }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (toolUse?.type !== "tool_use") return null;
    const out = toolUse.input as { cost_type_id?: string; confidence?: number; reasoning?: string };
    if (!out.cost_type_id || !eligible.some((c) => c.id === out.cost_type_id)) return null;

    return {
      costTypeId: out.cost_type_id,
      confidence: typeof out.confidence === "number" ? Math.max(0, Math.min(1, out.confidence)) : null,
      reasoning: out.reasoning ?? null,
    };
  } catch {
    return null; // KI-Vorschlag ist optional — ein Fehler blockiert den Import nicht
  }
}
