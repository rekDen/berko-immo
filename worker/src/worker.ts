import { runExtractConsumer, runChunkConsumer, runEmbedConsumer, runScheduler, stopConsumers } from './consumer';
import { closePool } from './db/pgmq';

// Graceful Shutdown
let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: 'info', message: 'Worker fährt herunter...', ts: new Date().toISOString() }));
  stopConsumers();
  // Laufende Jobs zu Ende verarbeiten (max. 30 s)
  await new Promise((r) => setTimeout(r, 5_000));
  await closePool();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function main() {
  console.log(JSON.stringify({ level: 'info', message: 'Ingestion-Worker startet', ts: new Date().toISOString() }));

  await Promise.all([
    runExtractConsumer(),
    runChunkConsumer(),
    runEmbedConsumer(),
    runScheduler(),
  ]);
}

main().catch((err) => {
  console.error(JSON.stringify({ level: 'fatal', message: String(err), ts: new Date().toISOString() }));
  process.exit(1);
});
