import crypto from 'crypto';
import type { SourceConnector, SourceFile } from './interface';

const DBX = 'https://api.dropboxapi.com/2';
const DBX_CONTENT = 'https://content.dropboxapi.com/2';

/**
 * Konnektor: Dropbox
 * config: { folder_path?, cursor? }
 * credential_ref → access_token (aus OAuth2-Flow)
 */
export const dropboxConnector: SourceConnector = {
  async listFiles(cfg, _credentialRef) {
    const accessToken = cfg.access_token as string | undefined;
    if (!accessToken) throw new Error('Dropbox: access_token fehlt in config');

    const folderPath = (cfg.folder_path as string | undefined) ?? '';
    const existingCursor = cfg.cursor as string | undefined;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const files: SourceFile[] = [];

    if (existingCursor) {
      // Inkrementell über Cursor
      let cursor = existingCursor;
      let hasMore = true;
      while (hasMore) {
        const res = await fetch(`${DBX}/files/list_folder/continue`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ cursor }),
        });
        if (!res.ok) throw new Error(`Dropbox cursor error: ${await res.text()}`);
        const data = await res.json() as {
          entries: DropboxEntry[];
          cursor: string;
          has_more: boolean;
        };
        cursor = data.cursor;
        hasMore = data.has_more;
        files.push(...entriesToFiles(data.entries, accessToken));
      }
    } else {
      // Initialer Sync
      let hasMore = true;
      let cursor = '';
      const startRes = await fetch(`${DBX}/files/list_folder`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ path: folderPath, recursive: true }),
      });
      if (!startRes.ok) throw new Error(`Dropbox list error: ${await startRes.text()}`);
      const startData = await startRes.json() as {
        entries: DropboxEntry[];
        cursor: string;
        has_more: boolean;
      };
      cursor  = startData.cursor;
      hasMore = startData.has_more;
      files.push(...entriesToFiles(startData.entries, accessToken));

      while (hasMore) {
        const res = await fetch(`${DBX}/files/list_folder/continue`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ cursor }),
        });
        if (!res.ok) throw new Error(`Dropbox continue error: ${await res.text()}`);
        const data = await res.json() as {
          entries: DropboxEntry[];
          cursor: string;
          has_more: boolean;
        };
        cursor  = data.cursor;
        hasMore = data.has_more;
        files.push(...entriesToFiles(data.entries, accessToken));
      }
    }

    return files;
  },
};

interface DropboxEntry {
  '.tag': string;
  name: string;
  path_lower: string;
  content_hash?: string;
  client_modified?: string;
}

function entriesToFiles(entries: DropboxEntry[], accessToken: string): SourceFile[] {
  return entries
    .filter((e) => e['.tag'] === 'file')
    .map((f) => {
      const contentHash = f.content_hash
        ?? crypto.createHash('sha256').update(f.path_lower).digest('hex');
      const filePath = f.path_lower;

      return {
        externalId: filePath,
        title: f.name,
        mimeType: guessMime(f.name),
        contentHash,
        documentDate: f.client_modified ? f.client_modified.slice(0, 10) : null,
        async fetchContent() {
          const res = await fetch(`${DBX_CONTENT}/files/download`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
            },
          });
          if (!res.ok) throw new Error(`Dropbox download error: ${await res.text()}`);
          return Buffer.from(await res.arrayBuffer());
        },
      };
    });
}

function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    md: 'text/markdown',
    html: 'text/html',
    eml: 'message/rfc822',
  };
  return map[ext ?? ''] ?? 'application/octet-stream';
}
