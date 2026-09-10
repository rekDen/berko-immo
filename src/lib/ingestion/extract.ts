import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { extractText as pdfExtractText, getDocumentProxy } from "unpdf";
import Anthropic from "@anthropic-ai/sdk";

// OCR-Fallback für gescannte PDFs (ohne Textebene): Claude liest den Text per Vision.
async function extractPdfWithClaude(buffer: Buffer): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";
  // Anthropic-Request-Limit ~32 MB; base64 bläht ~33 % auf → konservativ deckeln
  if (buffer.length > 24 * 1024 * 1024) {
    throw new Error("Gescanntes PDF zu groß für OCR (max. ~24 MB).");
  }

  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 32000,
    thinking: { type: "disabled" }, // reine Textextraktion, kein Reasoning nötig
    system:
      "Du bist ein präziser OCR-Textextraktor. Gib den gesamten sichtbaren Textinhalt " +
      "des Dokuments wörtlich, vollständig und in natürlicher Lesereihenfolge zurück. " +
      "Keine Zusammenfassung, keine Kommentare, keine Formatierungshinweise — nur der reine Text.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
          },
          { type: "text", text: "Extrahiere den vollständigen Text aus diesem Dokument." },
        ],
      },
    ],
  });

  const msg = await stream.finalMessage();
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// Extrahiert reinen Text aus einer hochgeladenen Datei.
// Unterstützt: PDF, DOCX, XLSX/XLS, TXT, MD, HTML, JSON.
// Wirft einen Fehler bei nicht unterstütztem Typ oder Extraktionsfehler,
// damit der Aufrufer das Dokument auf "failed" setzen kann.
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  onOcr?: () => void,   // wird aufgerufen, wenn auf Claude-OCR umgeschaltet wird
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeType.toLowerCase();

  // ── PDF ────────────────────────────────────────────────
  if (mime.includes("pdf") || ext === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await pdfExtractText(pdf, { mergePages: true });
    const extracted = (Array.isArray(text) ? text.join("\n") : text).trim();
    if (extracted.length >= 20) return extracted;
    // Keine Textebene → gescanntes PDF → OCR via Claude (Vision)
    onOcr?.();
    return await extractPdfWithClaude(buffer);
  }

  // ── DOCX ───────────────────────────────────────────────
  if (mime.includes("wordprocessingml") || ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }

  // ── XLSX / XLS ─────────────────────────────────────────
  if (mime.includes("spreadsheetml") || mime.includes("ms-excel") || ext === "xlsx" || ext === "xls") {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      if (csv.trim()) parts.push(`# ${name}\n${csv}`);
    }
    return parts.join("\n\n").trim();
  }

  // ── HTML ───────────────────────────────────────────────
  if (mime.includes("html") || ext === "html" || ext === "htm") {
    return stripHtml(buffer.toString("utf8")).trim();
  }

  // ── JSON ───────────────────────────────────────────────
  if (mime.includes("json") || ext === "json") {
    const raw = buffer.toString("utf8");
    try {
      return JSON.stringify(JSON.parse(raw), null, 2).trim();
    } catch {
      return raw.trim(); // ungültiges JSON → als Klartext behandeln
    }
  }

  // ── Klartext (TXT, MD, sonstiges Textformat) ──────────
  if (mime.startsWith("text/") || ["txt", "md", "markdown", "csv"].includes(ext)) {
    return buffer.toString("utf8").trim();
  }

  throw new Error(`Nicht unterstützter Dateityp: ${mimeType || ext || "unbekannt"}`);
}

// Einfaches HTML-Tag-Stripping ohne zusätzliche Library.
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}
