import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { enqueue, ack } from '../db/pgmq';
import type { ExtractMessage, ChunkMessage } from '../types';

const CHUNK_QUEUE = 'chunk_queue';

export async function processExtract(msg: ExtractMessage, msgId: bigint): Promise<void> {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  const { data: doc, error } = await supabase
    .from('ingest_documents')
    .select('*')
    .eq('id', msg.document_id)
    .single();

  if (error || !doc) {
    log('warn', msg.document_id, `Dokument nicht gefunden: ${error?.message}`);
    await ack('extract_queue', msgId);
    return;
  }

  await supabase.from('ingest_documents').update({ status: 'extracting' }).eq('id', doc.id);

  try {
    const text = await extractText(doc.mime_type ?? '', doc.storage_path, supabase);
    if (text === null) {
      await supabase.from('ingest_documents')
        .update({ status: 'unsupported' }).eq('id', doc.id);
      await ack('extract_queue', msgId);
      return;
    }

    const chunkMsg: ChunkMessage = {
      document_id: doc.id,
      tenant_id: doc.tenant_id,
      text,
    };
    await enqueue(CHUNK_QUEUE, chunkMsg);
    await supabase.from('ingest_documents').update({ status: 'chunking' }).eq('id', doc.id);
    await ack('extract_queue', msgId);
    log('info', doc.id, `Extrahiert (${text.length} Zeichen), in chunk_queue eingestellt`);
  } catch (err) {
    const msg2 = err instanceof Error ? err.message : String(err);
    await supabase.from('ingest_documents')
      .update({ status: 'failed', error_message: msg2 }).eq('id', doc.id);
    log('error', doc.id, `Extraktion fehlgeschlagen: ${msg2}`);
    // Nicht ack'en → Visibility-Timeout löst Retry aus
  }
}

async function extractText(
  mimeType: string,
  storagePath: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string | null> {
  const buffer = storagePath ? await downloadFromStorage(storagePath, supabase) : null;
  if (!buffer) return null;

  if (mimeType === 'application/pdf') return extractPdf(buffer);
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return extractDocx(buffer);
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return extractXlsx(buffer);
  if (mimeType.startsWith('text/') || mimeType === 'application/json')
    return buffer.toString('utf-8');
  if (mimeType === 'message/rfc822')
    return extractEml(buffer);
  return null; // unsupported
}

async function downloadFromStorage(
  storagePath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Buffer | null> {
  // storagePath Format: bucket/path/to/file
  const slash = storagePath.indexOf('/');
  if (slash === -1) return null;
  const bucket = storagePath.slice(0, slash);
  const path   = storagePath.slice(slash + 1);

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // PDF-Textextraktion via pdfjs-dist (leichtgewichtig, kein OCR)
  // Wenn Text zu kurz → OCR-Pfad via IONOS
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    const pdf   = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it: { str: string }) => it.str).join(' '));
    }
    const text = pages.join('\n\n').trim();
    if (text.length > 100) return text;
    // Scan-Verdacht → OCR
    return extractOcr(buffer);
  } catch {
    return extractOcr(buffer);
  }
}

async function extractOcr(buffer: Buffer): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: config.ionosBearer, baseURL: config.ionosEmbedUrl });
  // IONOS OCR: base64-kodiertes Bild/PDF an vision-fähiges Modell senden
  const base64 = buffer.toString('base64');
  const resp = await client.chat.completions.create({
    model: 'meta-llama/Llama-3.2-90B-Vision-Instruct',
    messages: [{
      role: 'user',
      content: [{
        type: 'image_url',
        image_url: { url: `data:application/pdf;base64,${base64}` },
      }, {
        type: 'text',
        text: 'Extrahiere den vollständigen Text aus diesem Dokument. Gib nur den Text zurück, keine Erklärungen.',
      }],
    }],
    max_tokens: 4096,
  });
  return resp.choices[0]?.message?.content ?? '';
}

async function extractDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth');
  const result  = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX  = require('xlsx');
  const wb    = XLSX.read(buffer, { type: 'buffer' });
  const lines: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_csv(ws) as string;
    lines.push(`## ${sheetName}\n${rows}`);
  }
  return lines.join('\n\n');
}

async function extractEml(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { simpleParser } = require('mailparser');
  const mail  = await simpleParser(buffer);
  const parts: string[] = [];
  if (mail.from?.text)    parts.push(`Von: ${mail.from.text}`);
  if (mail.to?.text)      parts.push(`An: ${mail.to.text}`);
  if (mail.subject)       parts.push(`Betreff: ${mail.subject}`);
  if (mail.date)          parts.push(`Datum: ${mail.date.toISOString()}`);
  parts.push('');
  parts.push(mail.text ?? mail.html?.replace(/<[^>]+>/g, ' ') ?? '');
  return parts.join('\n');
}

function log(level: string, docId: string, message: string) {
  console.log(JSON.stringify({ level, stage: 'extract', document_id: docId, message, ts: new Date().toISOString() }));
}
