import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { enqueue, ack } from '../db/pgmq';
import type { ChunkMessage, EmbedMessage, IngestChunk } from '../types';

const TARGET_TOKENS_MIN = 300;
const TARGET_TOKENS_MAX = 600;
const OVERLAP_RATIO     = 0.12;
const EMBED_QUEUE       = 'embed_queue';

export async function processChunk(msg: ChunkMessage, msgId: bigint): Promise<void> {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  try {
    const { data: doc } = await supabase
      .from('ingest_documents')
      .select('source_type, document_date')
      .eq('id', msg.document_id)
      .single();

    const sourceType = doc?.source_type ?? 'unknown';

    // Alte Chunks löschen (Re-Ingestion)
    await supabase.from('ingest_chunks').delete().eq('document_id', msg.document_id);

    const rawChunks = split(msg.text, TARGET_TOKENS_MIN, TARGET_TOKENS_MAX, OVERLAP_RATIO);

    const chunks: IngestChunk[] = rawChunks.map((c, i) => ({
      document_id:   msg.document_id,
      tenant_id:     msg.tenant_id,
      chunk_index:   i,
      content:       c.text,
      token_count:   c.tokens,
      section_title: c.sectionTitle ?? null,
      source_type:   sourceType,
      document_date: doc?.document_date ?? null,
    }));

    const embedMsg: EmbedMessage = {
      document_id: msg.document_id,
      tenant_id:   msg.tenant_id,
      chunks,
    };
    await enqueue(EMBED_QUEUE, embedMsg);
    await supabase.from('ingest_documents').update({ status: 'embedding' }).eq('id', msg.document_id);
    await ack('chunk_queue', msgId);

    log('info', msg.document_id, `${chunks.length} Chunks erstellt, in embed_queue eingestellt`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await supabase.from('ingest_documents')
      .update({ status: 'failed', error_message: errMsg }).eq('id', msg.document_id);
    log('error', msg.document_id, `Chunking fehlgeschlagen: ${errMsg}`);
  }
}

interface RawChunk {
  text: string;
  tokens: number;
  sectionTitle?: string;
}

/**
 * Strukturbewusstes Recursive Splitting:
 * §-Absätze → Absätze (\n\n) → Satzenden → Wörter
 */
function split(text: string, minTok: number, maxTok: number, overlapRatio: number): RawChunk[] {
  const paragraphs = extractParagraphsWithTitles(text);
  const chunks: RawChunk[] = [];
  let buffer = '';
  let bufferTitle: string | undefined;

  for (const { text: para, title } of paragraphs) {
    const combined = buffer ? buffer + '\n\n' + para : para;
    if (countTokens(combined) <= maxTok) {
      buffer       = combined;
      bufferTitle  = bufferTitle ?? title;
    } else {
      if (buffer) {
        chunks.push(...splitLong(buffer, maxTok, overlapRatio, bufferTitle));
        // Overlap: letzten ~OVERLAP Anteil mitnehmen
        const overlapWords = buffer.split(/\s+/).slice(-Math.floor(countTokens(buffer) * overlapRatio));
        buffer = overlapWords.join(' ');
        bufferTitle = undefined;
      }
      buffer = para;
      bufferTitle = title;
    }
  }
  if (buffer.trim()) chunks.push(...splitLong(buffer, maxTok, overlapRatio, bufferTitle));

  // Zu kurze Chunks mit Nachfolger zusammenführen
  return mergeShort(chunks, minTok);
}

interface Para { text: string; title?: string }

function extractParagraphsWithTitles(text: string): Para[] {
  // §-Absätze und nummerierte Überschriften extrahieren
  const lines = text.split('\n');
  const paras: Para[] = [];
  let currentTitle: string | undefined;
  let currentLines: string[] = [];

  for (const line of lines) {
    const isSectionHeader =
      /^§\s*\d+/.test(line) ||
      /^\d+[\.\)]\s+[A-ZÄÖÜ]/.test(line) ||
      /^#{1,4}\s/.test(line);

    if (isSectionHeader && currentLines.length > 0) {
      paras.push({ text: currentLines.join('\n').trim(), title: currentTitle });
      currentLines = [];
      currentTitle = line.replace(/^#+\s*/, '').trim();
    } else if (isSectionHeader) {
      currentTitle = line.replace(/^#+\s*/, '').trim();
    } else if (line.trim() === '') {
      if (currentLines.length > 0) {
        paras.push({ text: currentLines.join('\n').trim(), title: currentTitle });
        currentLines = [];
        // Titel bleibt für nächste Para, falls kein neuer Header kommt
      }
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0)
    paras.push({ text: currentLines.join('\n').trim(), title: currentTitle });

  return paras.filter((p) => p.text.length > 0);
}

function splitLong(text: string, maxTok: number, overlapRatio: number, title?: string): RawChunk[] {
  if (countTokens(text) <= maxTok)
    return [{ text, tokens: countTokens(text), sectionTitle: title }];

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: RawChunk[] = [];
  let buf = '';

  for (const s of sentences) {
    const candidate = buf ? buf + ' ' + s : s;
    if (countTokens(candidate) <= maxTok) {
      buf = candidate;
    } else {
      if (buf) {
        chunks.push({ text: buf.trim(), tokens: countTokens(buf), sectionTitle: title });
        const overlapWords = buf.split(/\s+/).slice(-Math.floor(countTokens(buf) * overlapRatio));
        buf = overlapWords.join(' ') + ' ' + s;
      } else {
        // Einzelner Satz zu lang → Wort-Fallback
        chunks.push(...wordFallback(s, maxTok, title));
        buf = '';
      }
    }
  }
  if (buf.trim()) chunks.push({ text: buf.trim(), tokens: countTokens(buf), sectionTitle: title });
  return chunks;
}

function wordFallback(text: string, maxTok: number, title?: string): RawChunk[] {
  const words  = text.split(/\s+/);
  const chunks: RawChunk[] = [];
  let buf: string[] = [];
  for (const w of words) {
    if (countTokens(buf.join(' ') + ' ' + w) > maxTok && buf.length > 0) {
      chunks.push({ text: buf.join(' '), tokens: countTokens(buf.join(' ')), sectionTitle: title });
      buf = [];
    }
    buf.push(w);
  }
  if (buf.length > 0) chunks.push({ text: buf.join(' '), tokens: countTokens(buf.join(' ')), sectionTitle: title });
  return chunks;
}

function mergeShort(chunks: RawChunk[], minTok: number): RawChunk[] {
  const result: RawChunk[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].tokens < minTok && i + 1 < chunks.length) {
      chunks[i + 1] = {
        text: chunks[i].text + '\n\n' + chunks[i + 1].text,
        tokens: chunks[i].tokens + chunks[i + 1].tokens,
        sectionTitle: chunks[i].sectionTitle ?? chunks[i + 1].sectionTitle,
      };
    } else {
      result.push(chunks[i]);
    }
  }
  return result;
}

/** Näherungs-Tokenizer: ~0.75 Tokens/Zeichen (deutsch/englisch) */
function countTokens(text: string): number {
  return Math.ceil(text.length * 0.25);
}

function log(level: string, docId: string, message: string) {
  console.log(JSON.stringify({ level, stage: 'chunk', document_id: docId, message, ts: new Date().toISOString() }));
}
