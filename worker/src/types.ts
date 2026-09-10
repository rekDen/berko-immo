export type SourceType = 'upload' | 'supabase_storage' | 'supabase_table' | 'gdrive' | 'dropbox' | 'webdav' | 'imap';

export type DocumentStatus =
  | 'pending' | 'extracting' | 'chunking' | 'embedding' | 'indexed' | 'failed' | 'unsupported';

export interface IngestDocument {
  id: string;
  tenant_id: string;
  source_id: string | null;
  source_type: SourceType;
  external_id: string | null;
  title: string | null;
  mime_type: string | null;
  storage_path: string | null;
  content_hash: string;
  document_version: number;
  document_date: string | null;
  status: DocumentStatus;
  error_message: string | null;
}

export interface IngestChunk {
  document_id: string;
  tenant_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  section_title: string | null;
  source_type: string;
  document_date: string | null;
}

export interface ExtractMessage {
  document_id: string;
  tenant_id: string;
}

export interface ChunkMessage {
  document_id: string;
  tenant_id: string;
  text: string;
  section_title?: string;
}

export interface EmbedMessage {
  document_id: string;
  tenant_id: string;
  chunks: IngestChunk[];
}

export interface IngestionSource {
  id: string;
  tenant_id: string;
  source_type: SourceType;
  name: string;
  config: Record<string, unknown>;
  credential_ref: string | null;
  sync_interval_minutes: number;
  last_synced_at: string | null;
  status: 'active' | 'paused' | 'error';
}
