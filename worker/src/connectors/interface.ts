export interface SourceFile {
  externalId: string;     // eindeutiger Bezeichner je Quelle (Pfad, Drive-ID, etc.)
  title: string;
  mimeType: string;
  contentHash: string;    // SHA-256
  documentDate: string | null;
  /** Lädt den rohen Dateiinhalt als Buffer */
  fetchContent(): Promise<Buffer>;
}

export interface SourceConnector {
  /** Gibt alle aktuellen Dateien der Quelle zurück (inkrementell per ETag/Cursor). */
  listFiles(config: Record<string, unknown>, credentialRef: string | null): Promise<SourceFile[]>;
}
