import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { badRequest, unauthorized, withAuth } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic();

// Strukturierte Zielfelder (AI extrahiert nur, rechnet nie — Spec §10).
const EXTRACT_TOOL: Anthropic.Tool = {
  name: "objektdaten",
  description: "Strukturierte Immobiliendaten aus dem Dokument. Nur belegte Fakten, nichts erfinden; fehlende Felder weglassen.",
  input_schema: {
    type: "object",
    properties: {
      objekt: {
        type: "object",
        properties: {
          bezeichnung: { type: "string" },
          stadt: { type: "string" },
          baujahr: { type: "integer" },
          wohnflaeche_qm: { type: "number" },
          grundstuecksflaeche_qm: { type: "number" },
          energieklasse: { type: "string", description: "A+..H" },
          denkmalschutz: { type: "boolean" },
          bodenrichtwert: { type: "number" },
          objektfaktor: { type: "number", description: "Kaufpreis-/Verkehrswert-Multiplikator, falls ableitbar" },
        },
      },
      einheiten: {
        type: "array",
        items: {
          type: "object",
          properties: {
            bezeichnung: { type: "string" },
            typ: { type: "string", description: "wohnung|gewerbe|stellplatz|nebenflaeche" },
            flaeche_qm: { type: "number" },
            etage: { type: "string" },
          },
        },
      },
      mietvertraege: {
        type: "array",
        items: {
          type: "object",
          properties: {
            einheit: { type: "string" },
            kaltmiete_eur_monat: { type: "number" },
            mietart: { type: "string", description: "standard|index|staffel" },
            leerstand: { type: "boolean" },
          },
        },
      },
      potenzialflaechen: {
        type: "array",
        items: {
          type: "object",
          properties: {
            art: { type: "string", description: "dg_unausgebaut|souterrain|dachflaeche_pv|stellplatz|kellerlager|garten|…" },
            flaeche_qm: { type: "number" },
            beschreibung: { type: "string" },
          },
        },
      },
      hinweise: { type: "array", items: { type: "string" }, description: "Auffälligkeiten für die Potenzialanalyse" },
    },
  },
};

async function ladeDokumentBlock(documentId: string): Promise<Anthropic.ContentBlockParam | null> {
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("storage_path, mime_type, file_name")
    .eq("id", documentId)
    .single();
  if (!doc) return null;

  const { data: blob } = await admin.storage.from("documents").download(doc.storage_path);
  if (!blob) return null;

  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  const mime = doc.mime_type ?? "application/octet-stream";

  if (mime === "application/pdf")
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  if (mime.startsWith("image/"))
    return { type: "image", source: { type: "base64", media_type: mime as "image/png", data: base64 } };
  // Fallback: als Text interpretieren
  return { type: "text", text: Buffer.from(base64, "base64").toString("utf8").slice(0, 100_000) };
}

// POST /api/optimization/extract  { text? } | { document_id? }
export async function POST(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const body = await request.json();
  const content: Anthropic.ContentBlockParam[] = [];

  if (body.document_id) {
    const block = await ladeDokumentBlock(body.document_id);
    if (!block) return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
    content.push(block);
  } else if (typeof body.text === "string" && body.text.trim()) {
    content.push({ type: "text", text: body.text.slice(0, 100_000) });
  } else {
    return badRequest("Pflichtfeld: text oder document_id");
  }
  content.push({ type: "text", text: "Extrahiere die Immobiliendaten über das Tool objektdaten." });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system:
        "Du bist ein Daten-Extraktor für eine deutsche Hausverwaltung. Extrahiere ausschließlich " +
        "im Dokument belegte Fakten in das Tool-Schema. Erfinde nichts, rechne nichts, lass Unbekanntes weg.",
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "objektdaten" },
      messages: [{ role: "user", content }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (toolUse?.type !== "tool_use")
      return NextResponse.json({ error: "Keine Extraktion möglich" }, { status: 422 });

    return NextResponse.json({ daten: toolUse.input });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Extraktion fehlgeschlagen" }, { status: 500 });
  }
}
