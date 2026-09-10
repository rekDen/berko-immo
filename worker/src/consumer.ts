import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { readBatch, enqueue } from './db/pgmq';
import { processExtract } from './processors/extract';
import { processChunk } from './processors/chunk';
import { processEmbed } from './processors/embed';
import type { ExtractMessage, ChunkMessage, EmbedMessage } from './types';

const MAX_RETRIES = config.maxRetries;

let running = true;

export function stopConsumers() {
  running = false;
}

export async function runExtractConsumer(): Promise<void> {
  log('info', 'extract_queue', 'Consumer gestartet');
  while (running) {
    const messages = await readBatch<ExtractMessage>(
      'extract_queue', config.extractConcurrency, config.visibilityTimeout
    );

    await Promise.all(messages.map(async (msg) => {
      if (msg.read_ct > MAX_RETRIES) {
        await moveToDlq('extract_queue', msg.message, `Max-Retries (${MAX_RETRIES}) erreicht`, msg.message.document_id);
        return;
      }
      await processExtract(msg.message, msg.msg_id);
    }));

    if (messages.length === 0) await sleep(config.pollIntervalMs);
  }
}

export async function runChunkConsumer(): Promise<void> {
  log('info', 'chunk_queue', 'Consumer gestartet');
  while (running) {
    const messages = await readBatch<ChunkMessage>(
      'chunk_queue', config.chunkConcurrency, config.visibilityTimeout
    );

    await Promise.all(messages.map(async (msg) => {
      if (msg.read_ct > MAX_RETRIES) {
        await moveToDlq('chunk_queue', msg.message, `Max-Retries (${MAX_RETRIES}) erreicht`, msg.message.document_id);
        return;
      }
      await processChunk(msg.message, msg.msg_id);
    }));

    if (messages.length === 0) await sleep(config.pollIntervalMs);
  }
}

export async function runEmbedConsumer(): Promise<void> {
  log('info', 'embed_queue', 'Consumer gestartet');
  while (running) {
    const messages = await readBatch<EmbedMessage>(
      'embed_queue', config.embedConcurrency, config.visibilityTimeout
    );

    await Promise.all(messages.map(async (msg) => {
      if (msg.read_ct > MAX_RETRIES) {
        await moveToDlq('embed_queue', msg.message, `Max-Retries (${MAX_RETRIES}) erreicht`, msg.message.document_id);
        return;
      }
      await processEmbed(msg.message, msg.msg_id);
    }));

    if (messages.length === 0) await sleep(config.pollIntervalMs);
  }
}

async function moveToDlq(
  queueName: string,
  message: unknown,
  errorMessage: string,
  documentId?: string
): Promise<void> {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  // tenant_id aus Nachricht extrahieren
  const tenantId = (message as Record<string, string>).tenant_id ?? null;

  await supabase.from('ingest_failed_jobs').insert({
    tenant_id:     tenantId,
    queue_name:    queueName,
    message:       message as object,
    error_message: errorMessage,
  });

  if (documentId) {
    await supabase.from('ingest_documents')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', documentId);
  }

  log('warn', queueName, `Job in DLQ verschoben: ${errorMessage}`);
}

// Scheduler: fällige Quellen synchronisieren
export async function runScheduler(): Promise<void> {
  log('info', 'scheduler', 'Scheduler gestartet');
  const { supabaseStorageConnector } = await import('./connectors/storage');
  const { supabaseTableConnector }   = await import('./connectors/supabase-table');
  const { webdavConnector }          = await import('./connectors/webdav');
  const { gdriveConnector }          = await import('./connectors/gdrive');
  const { dropboxConnector }         = await import('./connectors/dropbox');

  const connectors = {
    supabase_storage: supabaseStorageConnector,
    supabase_table:   supabaseTableConnector,
    webdav:           webdavConnector,
    gdrive:           gdriveConnector,
    dropbox:          dropboxConnector,
  };

  while (running) {
    await sleep(config.schedulerIntervalMs);
    if (!running) break;

    const supabase = createClient(config.supabaseUrl, config.supabaseKey);
    const now = new Date();

    const { data: sources } = await supabase
      .from('ingestion_sources')
      .select('*')
      .eq('status', 'active')
      .or(`last_synced_at.is.null,last_synced_at.lt.${new Date(now.getTime() - 60_000).toISOString()}`);

    for (const source of sources ?? []) {
      const connector = connectors[source.source_type as keyof typeof connectors];
      if (!connector) continue;

      try {
        const files = await connector.listFiles(source.config, source.credential_ref);
        for (const file of files) {
          // Idempotenz: bei gleichem content_hash überspringen
          const { data: existing } = await supabase
            .from('ingest_documents')
            .select('id, content_hash, document_version')
            .eq('source_id', source.id)
            .eq('external_id', file.externalId)
            .maybeSingle();

          if (existing?.content_hash === file.contentHash) continue;

          let docId: string;
          if (existing) {
            // Re-Ingestion: Version hochzählen
            const { data: updated } = await supabase
              .from('ingest_documents')
              .update({
                content_hash:     file.contentHash,
                status:           'pending',
                document_version: (existing.document_version ?? 1) + 1,
                error_message:    null,
              })
              .eq('id', existing.id)
              .select('id')
              .single();
            docId = updated!.id;
          } else {
            // Erst Datei in Supabase Storage hochladen
            const content = await file.fetchContent();
            const storagePath = `ingestion/${source.tenant_id}/${source.id}/${file.externalId.replace(/\//g, '_')}`;
            await supabase.storage.from('documents').upload(storagePath, content, {
              contentType: file.mimeType, upsert: true,
            });

            const { data: newDoc } = await supabase
              .from('ingest_documents')
              .insert({
                tenant_id:    source.tenant_id,
                source_id:    source.id,
                source_type:  source.source_type,
                external_id:  file.externalId,
                title:        file.title,
                mime_type:    file.mimeType,
                storage_path: storagePath,
                content_hash: file.contentHash,
                document_date: file.documentDate,
                status: 'pending',
              })
              .select('id')
              .single();
            docId = newDoc!.id;
          }

          await enqueue('extract_queue', { document_id: docId, tenant_id: source.tenant_id });
        }

        await supabase.from('ingestion_sources')
          .update({ last_synced_at: now.toISOString() })
          .eq('id', source.id);

        log('info', 'scheduler', `Quelle ${source.name} synchronisiert (${files.length} Dateien)`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await supabase.from('ingestion_sources')
          .update({ status: 'error' })
          .eq('id', source.id);
        log('error', 'scheduler', `Sync-Fehler für Quelle ${source.name}: ${errMsg}`);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function log(level: string, stage: string, message: string) {
  console.log(JSON.stringify({ level, stage, message, ts: new Date().toISOString() }));
}
