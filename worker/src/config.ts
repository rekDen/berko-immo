const ionosKey    = required('IONOS_API_KEY');
const ionosSecret = required('IONOS_API_SECRET');

// IONOS AI Model Hub: Bearer-Token = Base64(key:secret)
export const IONOS_BEARER = Buffer.from(`${ionosKey}:${ionosSecret}`).toString('base64');

export const config = {
  supabaseUrl:      required('SUPABASE_URL'),
  supabaseKey:      required('SUPABASE_SERVICE_ROLE_KEY'),  // Service-Role, nur im Worker
  databaseUrl:      required('DATABASE_URL'),               // direkter PG-Zugriff für pgmq
  ionosBearer:      IONOS_BEARER,
  ionosEmbedModel:  process.env.IONOS_EMBED_MODEL ?? 'BAAI/bge-m3',
  ionosEmbedDim:    parseInt(process.env.IONOS_EMBED_DIM ?? '1024'),
  ionosEmbedUrl:    process.env.IONOS_EMBED_URL ?? 'https://openai.inference.de-txl.ionos.com/v1',

  extractConcurrency: parseInt(process.env.EXTRACT_CONCURRENCY ?? '3'),
  chunkConcurrency:   parseInt(process.env.CHUNK_CONCURRENCY ?? '5'),
  embedConcurrency:   parseInt(process.env.EMBED_CONCURRENCY ?? '3'),

  maxRetries:         parseInt(process.env.MAX_RETRIES ?? '5'),
  visibilityTimeout:  parseInt(process.env.VISIBILITY_TIMEOUT_SEC ?? '60'),
  pollIntervalMs:     parseInt(process.env.POLL_INTERVAL_MS ?? '2000'),
  schedulerIntervalMs: parseInt(process.env.SCHEDULER_INTERVAL_MS ?? '60000'),

  embedBatchSize: parseInt(process.env.EMBED_BATCH_SIZE ?? '20'),
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
