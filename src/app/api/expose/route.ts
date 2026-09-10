import { NextRequest, NextResponse } from "next/server";
import React from "react";
import Anthropic from "@anthropic-ai/sdk";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { ExposePDF, type ExposeContent } from "@/lib/expose/pdf";

export const dynamic = "force-dynamic";

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const VALID_MEDIA: MediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const isValidMedia = (t: string): t is MediaType => VALID_MEDIA.includes(t as MediaType);

// POST /api/expose
// multipart/form-data: description, type (kauf|miete), price, images[], template?
export async function POST(request: NextRequest) {
  const { user } = await withAuth();
  if (!user) return unauthorized();

  const form = await request.formData();
  const description = (form.get("description") as string | null) ?? "";
  const type        = ((form.get("type") as string | null) ?? "kauf") as "kauf" | "miete";
  const price       = (form.get("price") as string | null) ?? "";
  const imageFiles  = form.getAll("images") as File[];
  const templateFile = form.get("template") as File | null;

  // Convert images → base64 (max 5, only valid types)
  const imageData = await Promise.all(
    imageFiles
      .filter((f) => isValidMedia(f.type))
      .slice(0, 5)
      .map(async (f) => {
        const buf = Buffer.from(await f.arrayBuffer());
        const b64 = buf.toString("base64");
        return { mediaType: f.type as MediaType, base64: b64, dataUri: `data:${f.type};base64,${b64}` };
      }),
  );

  // ── Call Claude Opus for content generation ──────────────────────────────
  const anthropic = new Anthropic();

  const userContent: Anthropic.MessageParam["content"] = [
    // Attach images for vision analysis (max 3 for token efficiency)
    ...imageData.slice(0, 3).map((img) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
    })),
    {
      type: "text" as const,
      text: `Erstelle ein professionelles Immobilien-Exposé auf Deutsch.

Art: ${type === "kauf" ? "Kauf" : "Vermietung"}
Preis: ${price}
Beschreibung: ${description}
${imageData.length > 0 ? `\nDie ${imageData.length} beigefügten Bilder zeigen das Objekt.` : ""}

Antworte NUR mit einem JSON-Objekt (kein Markdown, kein Text drumherum):
{
  "titel": "Prägnanter, ansprechender Titel (max. 80 Zeichen)",
  "beschreibung": "Ausführliche Beschreibung in 3–5 Sätzen, professionell und einladend",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"],
  "lage": "Kurze Lagebeschreibung (1–2 Sätze, leer lassen wenn nicht bekannt)",
  "ausstattung": ["Merkmal 1", "Merkmal 2", "Merkmal 3"],
  "preisinfo": "${type === "kauf" ? "Kaufpreis, Provision, ggf. Nebenkosten" : "Kaltmiete, Nebenkosten, Kaution"}"
}`,
    },
  ];

  let content: ExposeContent;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [{ role: "user", content: userContent }],
    });
    const block = msg.content.find((b) => b.type === "text");
    const raw   = block?.type === "text" ? block.text.trim() : "{}";
    // Strip accidental markdown code fences
    const json  = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    content = JSON.parse(json);
  } catch {
    content = {
      titel:       "Immobilienangebot",
      beschreibung: description,
      highlights:  [],
      lage:        "",
      ausstattung: [],
      preisinfo:   price,
    };
  }

  // ── Render PDF ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(
    React.createElement(ExposePDF, {
      content,
      images: imageData.map((i) => i.dataUri),
      type,
      price,
    }) as any,
  );

  // ── Merge with template (optional) ───────────────────────────────────────
  let finalBuffer: Buffer = pdfBuffer;
  if (templateFile?.type === "application/pdf") {
    try {
      const tplBytes  = await templateFile.arrayBuffer();
      const tplDoc    = await PDFDocument.load(tplBytes);
      const genDoc    = await PDFDocument.load(pdfBuffer);
      const merged    = await PDFDocument.create();

      const tplPages = await merged.copyPages(tplDoc, tplDoc.getPageIndices());
      tplPages.forEach((p) => merged.addPage(p));
      const genPages = await merged.copyPages(genDoc, genDoc.getPageIndices());
      genPages.forEach((p) => merged.addPage(p));

      // Buffer.from copies the data with a concrete ArrayBuffer (not ArrayBufferLike)
      finalBuffer = Buffer.from(await merged.save());
    } catch {
      // Template merge failed silently — return generated PDF only
    }
  }

  return new NextResponse(finalBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="expose-${Date.now()}.pdf"`,
    },
  });
}
