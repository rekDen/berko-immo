import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

const anthropic = new Anthropic();

// POST /api/weg-buchhaltung/extract-invoice
// Body: { document_id, property_id }
// K1 (hausgeldabrechnung-spec.md Kapitel 9 / B8.7): "Aus einer Rechnung werden
// Kostenart, BetrKV-Nummer, § 35a-Kategorie, Lohnanteil, Leistungszeitraum und
// Betrag vorgeschlagen." Kostenart wird zwingend aus der tatsächlichen
// Kostenarten-Liste der WEG gewählt (per `enum` im Tool-Schema) — Claude kann
// keine Kostenart erfinden, die es in dieser WEG nicht gibt. Reiner Vorschlag:
// wird nur zurückgegeben, nie selbst in eine Buchung geschrieben.
export async function POST(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const body = await request.json();
  if (!body.document_id || !body.property_id) return badRequest("Pflichtfelder: document_id, property_id");

  const { data: doc, error: docErr } = await supabase
    .from("documents").select("storage_path, mime_type, file_name").eq("id", body.document_id).single();
  if (docErr || !doc) return badRequest("Dokument nicht gefunden");

  const { data: blob, error: dlErr } = await supabase.storage.from("documents").download(doc.storage_path);
  if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message ?? "Beleg konnte nicht geladen werden" }, { status: 500 });

  const { data: costTypes } = await supabase
    .from("cost_types").select("id, name, is_heating").eq("property_id", body.property_id).eq("direction", "expense");
  if (!costTypes || costTypes.length === 0) return badRequest("Keine Ausgaben-Kostenarten für dieses Objekt angelegt");

  const costTypeIds = costTypes.map((c) => c.id);
  const costTypeLabel = costTypes.map((c) => `${c.id} = "${c.name}"`).join(", ");

  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  const mime = doc.mime_type ?? "application/pdf";
  const contentBlock: Anthropic.ContentBlockParam = mime.startsWith("image/")
    ? { type: "image", source: { type: "base64", media_type: mime as "image/png", data: base64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };

  const EXTRACT_TOOL: Anthropic.Tool = {
    name: "belegdaten",
    description: "Strukturierte Daten aus einer Rechnung/einem Beleg für eine WEG-Buchung. Nur belegte Fakten, nichts erfinden; unsichere Felder weglassen.",
    input_schema: {
      type: "object",
      properties: {
        cost_type_id: { type: "string", enum: costTypeIds, description: `Passende Kostenart dieser WEG: ${costTypeLabel}` },
        betrkv_no: { type: "integer", minimum: 1, maximum: 17, description: "Nummer nach § 2 BetrKV, falls aus dem Beleg ableitbar" },
        par35a_category: { type: "string", enum: ["household_employment", "household_service", "craftsman"], description: "§ 35a EStG: Beschäftigungsverhältnis/Dienstleistung/Handwerkerleistung, nur falls zutreffend" },
        labor_amount_cents: { type: "integer", description: "Lohn-/Arbeitskostenanteil in Cent (ohne Material), falls im Beleg ausgewiesen" },
        period_start: { type: "string", description: "Leistungszeitraum Beginn, ISO-Datum" },
        period_end: { type: "string", description: "Leistungszeitraum Ende, ISO-Datum" },
        invoice_amount_cents: { type: "integer", description: "Rechnungsbetrag laut Beleg in Cent" },
        invoice_number: { type: "string" },
      },
    },
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1000,
      system:
        "Du extrahierst Rechnungsdaten für die Buchhaltung einer deutschen Wohnungseigentümergemeinschaft (WEG). " +
        "Wähle die Kostenart ausschließlich aus der vorgegebenen Liste (cost_type_id). Erfinde keine Fakten, " +
        "rechne nichts um, lass unsichere Felder weg.",
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "belegdaten" },
      messages: [{ role: "user", content: [contentBlock, { type: "text", text: `Extrahiere die Belegdaten aus "${doc.file_name}" über das Tool belegdaten.` }] }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (toolUse?.type !== "tool_use") return NextResponse.json({ error: "Keine Extraktion möglich" }, { status: 422 });

    const input = toolUse.input as Record<string, unknown>;
    const matchedCostType = costTypes.find((c) => c.id === input.cost_type_id);
    return NextResponse.json({ ...input, cost_type_name: matchedCostType?.name ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Belegerkennung fehlgeschlagen" }, { status: 500 });
  }
}
