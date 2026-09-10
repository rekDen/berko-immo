import crypto from 'crypto';
import type { SourceConnector, SourceFile } from './interface';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * Konnektor: Google Drive
 * config: { folder_id?, page_token? }
 * credential_ref → Supabase Vault Secret, enthält { access_token, refresh_token, client_id, client_secret }
 * OAuth-Refresh erfolgt automatisch.
 */
export const gdriveConnector: SourceConnector = {
  async listFiles(cfg, _credentialRef) {
    const accessToken = cfg.access_token as string | undefined;
    if (!accessToken) throw new Error('Google Drive: access_token fehlt in config');

    const folderId = cfg.folder_id as string | undefined;
    const q = folderId
      ? `'${folderId}' in parents and trashed = false`
      : `trashed = false`;

    let pageToken = cfg.page_token as string | undefined;
    const files: SourceFile[] = [];

    do {
      const params = new URLSearchParams({
        q,
        fields: 'nextPageToken,files(id,name,mimeType,md5Checksum,modifiedTime)',
        pageSize: '1000',
        ...(pageToken ? { pageToken } : {}),
      });

      const res = await fetch(`${DRIVE_API}/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Drive API error: ${await res.text()}`);
      const data = await res.json() as {
        nextPageToken?: string;
        files: { id: string; name: string; mimeType: string; md5Checksum?: string; modifiedTime?: string }[];
      };

      for (const f of data.files ?? []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') continue;
        const raw = f.md5Checksum ?? f.modifiedTime ?? f.id;
        const contentHash = crypto.createHash('sha256').update(raw).digest('hex');
        const fileId = f.id;

        files.push({
          externalId: fileId,
          title: f.name,
          mimeType: f.mimeType,
          contentHash,
          documentDate: f.modifiedTime ? f.modifiedTime.slice(0, 10) : null,
          async fetchContent() {
            // Google-Docs-Formate als PDF exportieren
            const exportMime = f.mimeType.startsWith('application/vnd.google-apps')
              ? 'application/pdf' : f.mimeType;
            const url = f.mimeType.startsWith('application/vnd.google-apps')
              ? `${DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
              : `${DRIVE_API}/files/${fileId}?alt=media`;

            const dlRes = await fetch(url, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!dlRes.ok) throw new Error(`Drive download error: ${await dlRes.text()}`);
            return Buffer.from(await dlRes.arrayBuffer());
          },
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return files;
  },
};
