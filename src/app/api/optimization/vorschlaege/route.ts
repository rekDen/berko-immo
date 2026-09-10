import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { badRequest, unauthorized, withAuth } from "@/lib/supabase/api";

const anthropic = new Anthropic();

// GET /api/optimization/vorschlaege?property_id=<uuid>
// AI schlägt relevante Maßnahmen aus dem Katalog vor (erklärt, rechnet nicht — Spec §10).
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const [{ data: p }, { data: flaechen }, { data: typen }] = await Promise.all([
    supabase
      .from("properties")
      .select("name, city, type, year_built, is_monument, erhaltungssatzung, energy_class, living_area, plot_area, parking_spaces, short_term_rental_allowed")
      .eq("id", propertyId)
      .single(),
    supabase.from("potenzialflaeche").select("art, flaeche_qm, menge, beschreibung").eq("property_id", propertyId),
    supabase.from("massnahme_typ").select("code, label, kategorie, klasse"),
  ]);

  if (!p) return NextResponse.json({ error: "Objekt nicht gefunden" }, { status: 404 });

  const katalog = (typen ?? []).map((t) => `${t.code} — ${t.label} (${t.kategorie}/${t.klasse})`).join("\n");
  const profil = JSON.stringify({ objekt: p, potenzialflaechen: flaechen ?? [] }, null, 2);

  const tool: Anthropic.Tool = {
    name: "vorschlaege",
    description: "Relevante Maßnahmen aus dem Katalog für dieses Objekt.",
    input_schema: {
      type: "object",
      properties: {
        vorschlaege: {
          type: "array",
          items: {
            type: "object",
            properties: {
              typ_code: { type: "string", description: "exakter Code aus dem Katalog" },
              begruendung: { type: "string", description: "1 Satz, warum relevant für dieses Objekt" },
              prioritaet: { type: "string", description: "hoch|mittel|niedrig" },
            },
            required: ["typ_code", "begruendung"],
          },
        },
      },
      required: ["vorschlaege"],
    },
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system:
        "Du bist Value-Add-Berater für deutsche Immobilien. Wähle aus dem Katalog die zum Objektprofil " +
        "passenden Hebel (z.B. Denkmalschutz → §7i/Modernisierung; unausgebautes DG → dg_ausbau; freie Dachfläche → PV; " +
        "Stellplatzpotenzial → stellplatz_anlegen). Nutze ausschließlich existierende typ_codes. Rechne nichts.",
      tools: [tool],
      tool_choice: { type: "tool", name: "vorschlaege" },
      messages: [
        { role: "user", content: `Maßnahmen-Katalog:\n${katalog}\n\nObjektprofil:\n${profil}\n\nGib die relevanten Maßnahmen über das Tool zurück.` },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (toolUse?.type !== "tool_use")
      return NextResponse.json({ vorschlaege: [] });

    const codes = new Set((typen ?? []).map((t) => t.code));
    const input = toolUse.input as { vorschlaege?: { typ_code: string }[] };
    const vorschlaege = (input.vorschlaege ?? []).filter((v) => codes.has(v.typ_code));
    return NextResponse.json({ vorschlaege });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Vorschläge fehlgeschlagen" }, { status: 500 });
  }
}
