import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { SourceConnector, SourceFile } from './interface';

/** Konnektor: Supabase Storage – indexiert alle Dateien eines Buckets/Ordners */
export const supabaseStorageConnector: SourceConnector = {
  async listFiles(cfg) {
    const supabase = createClient(config.supabaseUrl, config.supabaseKey);
    const bucket = cfg.bucket as string;
    const folder = (cfg.folder as string | undefined) ?? '';

    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    if (error) throw new Error(`Storage list error: ${error.message}`);

    const files: SourceFile[] = [];
    for (const item of data ?? []) {
      if (item.id === null) continue; // Verzeichnis-Platzhalter überspringen
      const path = folder ? `${folder}/${item.name}` : item.name;
      const externalId = `${bucket}/${path}`;

      const meta = item.metadata as Record<string, string> | null;
      const etag = meta?.eTag ?? meta?.etag ?? '';
      const contentHash = crypto.createHash('sha256').update(externalId + etag).digest('hex');

      files.push({
        externalId,
        title: item.name,
        mimeType: meta?.mimetype ?? 'application/octet-stream',
        contentHash,
        documentDate: null,
        async fetchContent() {
          const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
          if (dlErr || !blob) throw new Error(`Storage download error: ${dlErr?.message}`);
          return Buffer.from(await blob.arrayBuffer());
        },
      });
    }
    return files;
  },
};
