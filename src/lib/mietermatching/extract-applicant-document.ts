import Anthropic from "@anthropic-ai/sdk";
import type { ApplicantDocType } from "./scoring";

/**
 * KI-Mietermatching MM2 — Extraktion strukturierter Bewerberdaten aus einer
 * hochgeladenen Unterlage (Einkommensnachweis, SCHUFA-Auskunft,
 * Mieterselbstauskunft). Spec §2.3/§9: "hier wird nur strukturiert
 * extrahiert, was zur Erfüllung der Kriterien nötig ist" — kein Bewertungs-
 * urteil, reine Faktenextraktion (wie K1 bei WEG-Buchhaltung). Nur ein
 * Vorschlag: wird nie automatisch in den Bewerber-Datensatz übernommen,
 * sondern muss über "Übernehmen" + explizites Speichern bestätigt werden.
 */

const anthropic = new Anthropic();

export interface ApplicantDocExtraction {
  net_income_cents?: number;
  employment_type?: "unbefristet" | "befristet" | "selbststaendig" | "rentner" | "student";
  household_size?: number;
  schufa_classification?: "none_negative" | "soft_negative" | "hard_negative";
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "bewerberdaten",
  description:
    "Strukturierte Daten aus einer Bewerberunterlage fürs Mietermatching. Nur belegte Fakten, nichts erfinden; " +
    "unsichere oder im Dokument nicht enthaltene Felder weglassen.",
  input_schema: {
    type: "object",
    properties: {
      net_income_cents: { type: "integer", description: "Monatliches Netto-/Auszahlungseinkommen in Cent, falls aus dem Dokument ableitbar (z. B. Gehaltsabrechnung)" },
      employment_type: { type: "string", enum: ["unbefristet", "befristet", "selbststaendig", "rentner", "student"], description: "Beschäftigungsart, falls aus dem Dokument ersichtlich" },
      household_size: { type: "integer", minimum: 1, description: "Anzahl der im Haushalt lebenden Personen, falls in einer Mieterselbstauskunft angegeben" },
      schufa_classification: { type: "string", enum: ["none_negative", "soft_negative", "hard_negative"], description: "Einschätzung einer SCHUFA-Auskunft: keine Negativmerkmale / weiche Negativmerkmale / harte Negativmerkmale" },
    },
  },
};

const DOC_TYPE_CONTEXT: Record<ApplicantDocType, string> = {
  income_proof: "Es handelt sich um einen Einkommensnachweis (z. B. Gehaltsabrechnung, Rentenbescheid).",
  schufa: "Es handelt sich um eine SCHUFA-Auskunft.",
  self_disclosure: "Es handelt sich um eine Mieterselbstauskunft.",
  other: "Der Dokumenttyp ist nicht näher spezifiziert.",
};

/** Ruft Claude für ein einzelnes Bewerberdokument auf. Wirft bei einem
 * API-Fehler; liefert bei fehlender Extraktion ein leeres Objekt. */
export async function extractApplicantDocument(
  blob: Blob, mimeType: string | null, fileName: string, docType: ApplicantDocType,
): Promise<ApplicantDocExtraction> {
  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  const mime = mimeType ?? "application/pdf";
  const contentBlock: Anthropic.ContentBlockParam = mime.startsWith("image/")
    ? { type: "image", source: { type: "base64", media_type: mime as "image/png", data: base64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system:
      "Du extrahierst Bewerberdaten aus Unterlagen für die Wohnungsvermietung (Mietermatching). " +
      "Erfinde keine Fakten, rechne nichts um, lass unsichere oder nicht enthaltene Felder weg. " +
      DOC_TYPE_CONTEXT[docType],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "bewerberdaten" },
    messages: [{ role: "user", content: [contentBlock, { type: "text", text: `Extrahiere die Bewerberdaten aus "${fileName}" über das Tool bewerberdaten.` }] }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (toolUse?.type !== "tool_use") return {};
  return toolUse.input as ApplicantDocExtraction;
}
