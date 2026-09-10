import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { parseStringPromise } from 'xml2js';
import type { SourceConnector, SourceFile } from './interface';

/** Konnektor: WebDAV (NAS, eigenes Dateisystem) */
export const webdavConnector: SourceConnector = {
  async listFiles(cfg) {
    const host    = cfg.host as string;
    const path    = (cfg.path as string | undefined) ?? '/';
    const user    = cfg.username as string | undefined;
    const pass    = cfg.password as string | undefined;

    const body = `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop><getcontenttype/><getlastmodified/><getetag/><displayname/></prop>
</propfind>`;

    const auth = user && pass
      ? 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
      : undefined;

    const xml = await davRequest(host, path, 'PROPFIND', body, auth, { depth: '1' });
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const responses = parsed['D:multistatus']?.['D:response'] ?? [];
    const items = Array.isArray(responses) ? responses : [responses];

    const files: SourceFile[] = [];
    for (const item of items) {
      const href: string = item['D:href'];
      if (href.endsWith('/')) continue;  // Verzeichnis
      const props = item['D:propstat']?.['D:prop'];
      const mime: string  = props?.['D:getcontenttype'] ?? 'application/octet-stream';
      const etag: string  = props?.['D:getetag'] ?? '';
      const name: string  = props?.['D:displayname'] ?? href.split('/').pop() ?? href;
      const contentHash = crypto.createHash('sha256').update(host + href + etag).digest('hex');

      const capturedHref = href;
      files.push({
        externalId: capturedHref,
        title: name,
        mimeType: mime,
        contentHash,
        documentDate: null,
        async fetchContent() {
          const buf = await davGetBuffer(host, capturedHref, auth);
          return buf;
        },
      });
    }
    return files;
  },
};

function davRequest(
  host: string, path: string, method: string,
  body: string, auth: string | undefined,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, host);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request({
      hostname: url.hostname, port: url.port || undefined,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Length': Buffer.byteLength(body),
        ...(auth ? { Authorization: auth } : {}),
        ...extraHeaders,
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (d: Buffer) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function davGetBuffer(host: string, path: string, auth: string | undefined): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, host);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request({
      hostname: url.hostname, port: url.port || undefined,
      path: url.pathname + url.search,
      method: 'GET',
      headers: auth ? { Authorization: auth } : {},
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (d: Buffer) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.end();
  });
}

// xml2js ist eine leichte Abhängigkeit — bei Nichtinstallation Fallback auf einfaches Regex-Parsing
async function parseStringPromise(xml: string, _opts: unknown): Promise<Record<string, unknown>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parseStringPromise: parse } = require('xml2js');
    return parse(xml, _opts);
  } catch {
    throw new Error('xml2js nicht installiert – npm install xml2js im Worker-Verzeichnis');
  }
}
