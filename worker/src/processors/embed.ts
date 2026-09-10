import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { config } from '../config';
import { ack } from '../db/pgmq';
import type { EmbedMessage, IngestChunk } from '../types';

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      // IONOS erwartet Base64(key:secret) als Bearer-Token.
      // Das openai-SDK sendet apiKey als „Bearer <apiKey>", daher direkt den
      // Base64-codierten Wert übergeben.
      apiKey:  config.ionosBearer,
      baseURL: config.ionosEmbedUrl,
    });
  }
  return openaiClient;
}

export async function processEmbed(msg: EmbedMessage, msgId: bigint): Promise<void> {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  try {
    const batches = batch(msg.chunks, config.embedBatchSize);
    const allEmbeddings: number[][] = [];

    for (const b of batches) {
      const embeddings = await embedWithRetry(b.map((c) => c.content));
      allEmbeddings.push(...embeddings);
    }

    const rows = msg.chunks.map((c, i) => ({
      document_id:   c.document_id,
      tenant_id:     c.tenant_id,
      chunk_index:   c.chunk_index,
      content:       c.content,
      token_count:   c.token_count,
      section_title: c.section_title,
      source_type:   c.source_type,
      document_date: c.document_date,
      embedding:     JSON.stringify(allEmbeddings[i]),
    }));

    const { error } = await supabase.from('ingest_chunks').insert(rows);
    if (error) throw new Error(error.message);

    await supabase.from('ingest_documents')
      .update({ status: 'indexed', updated_at: new Date().toISOString() })
      .eq('id', msg.document_id);

    await ack('embed_queue', msgId);
    log('info', msg.document_id, `${rows.length} Chunks eingebettet und indexiert`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await supabase.from('ingest_documents')
      .update({ status: 'failed', error_message: errMsg }).eq('id', msg.document_id);
    log('error', msg.document_id, `Embedding fehlgeschlagen: ${errMsg}`);
  }
}

async function embedWithRetry(texts: string[], attempt = 0): Promise<number[][]> {
  try {
    const res = await getClient().embeddings.create({
      model: config.ionosEmbedModel,
      input: texts,
    });
    return res.data.map((d) => d.embedding);
  } catch (err: unknown) {
    // Exponential Backoff bei 429/5xx
    const status = (err as { status?: number }).status;
    if ((status === 429 || (status && status >= 500)) && attempt < 5) {
      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 30_000);
      await sleep(delay);
      return embedWithRetry(texts, attempt + 1);
    }
    throw err;
  }
}

function batch<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Explizit exportiert damit TS weiß dass IngestChunk genutzt wird
export type { IngestChunk };

function log(level: string, docId: string, message: string) {
  console.log(JSON.stringify({ level, stage: 'embed', document_id: docId, message, ts: new Date().toISOString() }));
}
