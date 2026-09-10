import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { ionosToken, hasIonos } from "@/lib/ingestion/embed";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface SearchResult {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  section_title: string | null;
  source_type: string;
  document_date: string | null;
  rrf_score: number;
  search_mode: "hybrid" | "fts";
  title?: string;
  link?: string | null;
}

// Baut aus external_id ("public.{tabelle}:{id}") bzw. Upload einen App-Link.
function buildSourceLink(sourceType: string | null, externalId: string | null): string | null {
  if (sourceType === "upload") return "/dokumente";
  if (sourceType === "supabase_table" && externalId) {
    const m = externalId.match(/^public\.([a-z_]+):(.+)$/);
    if (m) {
      const table = m[1];
      const id    = m[2];
      switch (table) {
        case "properties": return `/objekte/${id}`;
        case "contacts":   return `/kontakte/${id}`;
        case "contracts":  return `/vertraege/${id}`;
        case "tickets":    return `/vorgaenge/${id}`;
        case "deadlines":  return `/deadlines`;
        case "emails":     return `/emails`;
        case "szenario":
        case "massnahme":  return `/immobilienoptimierung`;
        default:           return null;
      }
    }
  }
  return null;
}

// Reichert Treffer mit Dokument-Titel + Link an und dedupliziert pro Dokument.
async function enrichAndDedupe(
  supabase: NonNullable<Awaited<ReturnType<typeof withAuth>>["supabase"]>,
  results: SearchResult[],
): Promise<SearchResult[]> {
  const docIds = [...new Set(results.map((r) => r.document_id))];
  if (!docIds.length) return [];

  const { data: docs } = await supabase
    .from("ingest_documents")
    .select("id, external_id, title, source_type")
    .in("id", docIds);

  const map = new Map((docs ?? []).map((d) => [d.id, d]));

  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    if (seen.has(r.document_id)) continue;   // pro Dokument nur der relevanteste Chunk
    seen.add(r.document_id);
    const d = map.get(r.document_id);
    out.push({
      ...r,
      title: (d?.title as string) || r.section_title || "Quelle",
      link:  buildSourceLink((d?.source_type as string) ?? r.source_type, (d?.external_id as string) ?? null),
    });
  }
  return out;
}

// Sonnet versteht die Anfrage und beantwortet sie belegt anhand der Quellen.
async function generateAnswer(q: string, sources: SearchResult[]): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !sources.length) return null;

  const context = sources
    .map((r, i) => {
      const title = r.title || r.section_title || `Quelle ${i + 1}`;
      return `[${i + 1}] ${title}\n${r.content}`;
    })
    .join("\n\n---\n\n");

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system:
        "Du bist Akturios Wissensassistent für die Immobilienverwaltung. " +
        "Erfasse zuerst genau, wonach gefragt wird (Absicht, gemeinte Entität, Zeitbezug), " +
        "und beantworte die Frage dann präzise und auf Deutsch AUSSCHLIESSLICH anhand der " +
        "bereitgestellten Quellen. Belege jede Aussage mit der Quellennummer in eckigen " +
        "Klammern, z. B. [1] oder [2][3]. Wenn die Quellen die Frage nicht (vollständig) " +
        "beantworten, sage das klar. Erfinde nichts, was nicht in den Quellen steht.",
      messages: [
        {
          role: "user",
          content: `Frage: ${q}\n\nQuellen:\n\n${context}`,
        },
      ],
    });

    // Mit adaptivem Thinking ist content[0] evtl. ein thinking-Block → Textblöcke gezielt sammeln
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

// Deutsche Frage-/Störwörter, die eine UND-Volltextsuche unnötig einschränken.
const STOPWORDS = new Set([
  "wer", "was", "wie", "wo", "wann", "warum", "wieso", "weshalb", "wodurch",
  "welche", "welcher", "welches", "welchen", "welchem",
  "ist", "sind", "war", "waren", "bin", "bist", "seid",
  "hat", "habe", "haben", "hatte", "hatten", "wird", "werden",
  "gibt", "es", "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einen", "einem", "einer", "eines",
  "mir", "mich", "mein", "meine", "du", "ich", "sie", "er",
  "bitte", "zeige", "zeig", "finde", "find", "suche", "such",
  "nenne", "liste", "gib", "sag", "erkläre", "erklaer",
  "von", "vom", "für", "fuer", "mit", "und", "oder", "im", "in", "am", "an", "auf", "zu",
]);

// Bereinigt eine natürlichsprachliche Frage zu reinen Suchbegriffen für die
// Volltextsuche. Bei leerem Ergebnis wird die Originalanfrage zurückgegeben.
function cleanQueryForFts(q: string): string {
  const tokens = q
    .toLowerCase()
    .replace(/[?!.,;:()"'„“»«]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const kept = tokens.filter((t) => !STOPWORDS.has(t));
  const cleaned = kept.join(" ").trim();
  return cleaned.length >= 2 ? cleaned : q;
}

// GET /api/ingestion/search?q=&source_type=&date_from=&date_to=&limit=
export async function GET(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { searchParams } = request.nextUrl;
  const q          = searchParams.get("q");
  const sourceType = searchParams.get("source_type") ?? undefined;
  const dateFrom   = searchParams.get("date_from") ?? undefined;
  const dateTo     = searchParams.get("date_to") ?? undefined;
  const limit      = parseInt(searchParams.get("limit") ?? "10");

  if (!q) return badRequest("Pflichtparameter: q");

  // Für die Volltextsuche Frage-/Störwörter entfernen (Original bleibt für
  // Embedding und die Sonnet-Antwort erhalten).
  const ftsQuery = cleanQueryForFts(q);

  let results: SearchResult[] = [];
  let searchMode: "hybrid" | "fts" = "fts";

  // ── Hybrid-Search (Vektor + FTS) wenn IONOS konfiguriert ────────────────
  if (hasIonos()) {
    try {
      const client = new OpenAI({
        apiKey:  ionosToken(), // "Authorization: Bearer <token>"
        baseURL: process.env.IONOS_EMBED_URL ?? "https://openai.inference.de-txl.ionos.com/v1",
      });
      const embRes      = await client.embeddings.create({
        model: process.env.IONOS_EMBED_MODEL ?? "BAAI/bge-m3",
        input: q,
      });
      const queryVector = embRes.data[0].embedding;

      const { data, error } = await supabase.rpc("ingest_hybrid_search", {
        p_tenant_id:    tenantId,
        p_query_text:   ftsQuery,
        p_query_vector: JSON.stringify(queryVector),
        p_match_count:  Math.max(limit, 12),
        p_source_type:  sourceType ?? null,
        p_date_from:    dateFrom ?? null,
        p_date_to:      dateTo ?? null,
      });

      if (!error && data?.length) {
        results    = (data as SearchResult[]).map((r) => ({ ...r, search_mode: "hybrid" as const }));
        searchMode = "hybrid";
      }
    } catch {
      // IONOS nicht erreichbar → FTS-Fallback
    }
  }

  // ── FTS-Fallback (Volltextsuche, kein IONOS nötig) ──────────────────────
  if (!results.length) {
    let query = supabase
      .from("ingest_chunks")
      .select("id, document_id, chunk_index, content, section_title, source_type, document_date")
      .eq("tenant_id", tenantId)
      .textSearch("fts", ftsQuery, { type: "websearch", config: "german" })
      .order("id")
      .limit(Math.max(limit, 12));

    if (sourceType) query = query.eq("source_type", sourceType);
    if (dateFrom)   query = query.gte("document_date", dateFrom);
    if (dateTo)     query = query.lte("document_date", dateTo);

    const { data: ftsData, error: ftsErr } = await query;
    if (ftsErr) return NextResponse.json({ error: ftsErr.message }, { status: 500 });

    results = (ftsData ?? []).map((r, i) => ({
      id:            r.id,
      document_id:   r.document_id,
      chunk_index:   r.chunk_index,
      content:       r.content,
      section_title: r.section_title,
      source_type:   r.source_type,
      document_date: r.document_date,
      rrf_score:     1 / (60 + i + 1),
      search_mode:   "fts" as const,
    }));
    searchMode = "fts";
  }

  // Titel + Links anreichern, pro Dokument deduplizieren, auf limit kürzen
  const sources = (await enrichAndDedupe(supabase, results)).slice(0, limit);

  const answer = await generateAnswer(q, sources);
  return NextResponse.json({ query: q, search_mode: searchMode, results: sources, answer });
}
