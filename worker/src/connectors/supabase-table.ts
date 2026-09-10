import crypto from 'crypto';
import { Pool } from 'pg';
import type { SourceConnector, SourceFile } from './interface';

let pool: Pool | null = null;
function getPool(databaseUrl: string): Pool {
  if (!pool) pool = new Pool({ connectionString: databaseUrl });
  return pool;
}

// Tabellen, die nie indexiert werden sollen (System / interne Tabellen)
const EXCLUDED_TABLES = new Set([
  'ingest_documents', 'ingest_chunks', 'ingest_failed_jobs', 'ingestion_sources',
  'schema_migrations', 'spatial_ref_sys',
  // pgmq-interne Tabellen
]);
const EXCLUDED_SCHEMAS = new Set(['pg_catalog', 'information_schema', 'pgmq', 'storage', 'auth', 'realtime', 'supabase_functions', 'vault', 'extensions']);

// Postgres-Typen, die als Freitext sinnvoll sind
const TEXT_TYPES = new Set(['text', 'varchar', 'character varying', 'char', 'bpchar', 'name']);

interface ColumnMeta {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TableRow {
  [col: string]: unknown;
}

/**
 * Konnektor: Supabase-Postgres — liest alle Tabellen des public-Schemas
 * und indexiert deren Textspalten.
 *
 * config (optional):
 *   tables:        string[]   — nur diese Tabellen (leer = alle)
 *   exclude:       string[]   — diese Tabellen überspringen
 *   title_columns: Record<table, col>  — je Tabelle die Titelspalte
 *   batch_size:    number     — Zeilen pro Chunk-Dokument (default: 1)
 */
export const supabaseTableConnector: SourceConnector = {
  async listFiles(cfg) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL fehlt');

    const db = getPool(databaseUrl);

    const allowList  = (cfg.tables  as string[] | undefined) ?? [];
    const denyList   = new Set((cfg.exclude as string[] | undefined) ?? []);
    const titleCols  = (cfg.title_columns as Record<string, string> | undefined) ?? {};
    const batchSize  = (cfg.batch_size as number | undefined) ?? 1;

    // ── 1. Alle user-Tabellen + ihre Textspalten ermitteln ──
    const { rows: cols } = await db.query<ColumnMeta>(`
      select c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where t.table_type = 'BASE TABLE'
        and c.table_schema not in (${[...EXCLUDED_SCHEMAS].map((_, i) => `$${i + 1}`).join(',')})
      order by c.table_schema, c.table_name, c.ordinal_position
    `, [...EXCLUDED_SCHEMAS]);

    // Textspalten je Tabelle gruppieren
    const tableTextCols = new Map<string, { schema: string; columns: string[] }>();
    for (const col of cols) {
      const key = `${col.table_schema}.${col.table_name}`;
      if (EXCLUDED_TABLES.has(col.table_name)) continue;
      if (denyList.has(col.table_name)) continue;
      if (allowList.length > 0 && !allowList.includes(col.table_name)) continue;
      if (!TEXT_TYPES.has(col.data_type)) continue;

      if (!tableTextCols.has(key)) {
        tableTextCols.set(key, { schema: col.table_schema, columns: [] });
      }
      tableTextCols.get(key)!.columns.push(col.column_name);
    }

    // ── 2. Je Tabelle: Zeilen lesen und als SourceFile zurückgeben ──
    const files: SourceFile[] = [];

    for (const [key, { schema, columns }] of tableTextCols) {
      const tableName = key.split('.')[1];
      if (columns.length === 0) continue;

      // updated_at prüfen (für Änderungserkennung)
      const hasUpdatedAt = cols.some(
        (c) => c.table_schema === schema && c.table_name === tableName && c.column_name === 'updated_at'
      );

      const selectCols = [...new Set(['id', ...columns, ...(hasUpdatedAt ? ['updated_at'] : [])])];
      const quotedCols = selectCols.map((c) => `"${c}"`).join(', ');

      let rows: TableRow[] = [];
      try {
        const result = await db.query<TableRow>(
          `select ${quotedCols} from "${schema}"."${tableName}" limit 10000`
        );
        rows = result.rows;
      } catch (err) {
        console.warn(`supabase_table: Tabelle ${key} übersprungen:`, (err as Error).message);
        continue;
      }

      // Zeilenweise (oder gebündelt per batch_size) als Dokumente behandeln
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const textParts: string[] = [];
        for (const row of batch) {
          // Titel-Zeile
          const titleCol = titleCols[tableName]
            ?? columns.find((c) => ['name', 'title', 'betreff', 'subject', 'label'].includes(c))
            ?? columns[0];
          const titleVal = String(row[titleCol] ?? '').trim();
          if (titleVal) textParts.push(`## ${titleVal}`);

          // Alle Textspalten als Key-Value
          for (const col of columns) {
            const val = row[col];
            if (val == null || val === '') continue;
            textParts.push(`**${col}**: ${String(val)}`);
          }
          textParts.push('');
        }

        const text = textParts.join('\n').trim();
        if (!text) continue;

        // Content-Hash aus Text (Änderungserkennung)
        const lastUpdated = hasUpdatedAt
          ? String(batch[batch.length - 1]?.updated_at ?? '')
          : '';
        const contentHash = crypto
          .createHash('sha256')
          .update(key + ':' + i + ':' + lastUpdated + ':' + text.slice(0, 500))
          .digest('hex');

        const titleCol = titleCols[tableName]
          ?? columns.find((c) => ['name', 'title', 'betreff', 'subject', 'label'].includes(c))
          ?? columns[0];
        const firstTitle = String(batch[0]?.[titleCol] ?? `${tableName} #${i}`);

        const capturedText = text;
        files.push({
          externalId:  `${key}:row:${i}`,
          title:       batchSize === 1 ? firstTitle : `${tableName} (${i}–${i + batch.length - 1})`,
          mimeType:    'text/plain',
          contentHash,
          documentDate: null,
          async fetchContent() {
            return Buffer.from(capturedText, 'utf-8');
          },
        });
      }
    }

    return files;
  },
};
