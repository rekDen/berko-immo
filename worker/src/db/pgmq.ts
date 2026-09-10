import { Pool } from 'pg';
import { config } from '../config';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl });
  }
  return pool;
}

export interface PgmqMessage<T = unknown> {
  msg_id: bigint;
  read_ct: number;
  enqueued_at: Date;
  vt: Date;
  message: T;
}

export async function enqueue<T>(queue: string, msg: T): Promise<bigint> {
  const { rows } = await getPool().query(
    `select pgmq.send($1, $2::jsonb)`,
    [queue, JSON.stringify(msg)]
  );
  return rows[0].send;
}

export async function readBatch<T>(
  queue: string,
  batchSize: number,
  visibilityTimeout: number
): Promise<PgmqMessage<T>[]> {
  const { rows } = await getPool().query(
    `select * from pgmq.read($1, $2, $3)`,
    [queue, visibilityTimeout, batchSize]
  );
  return rows;
}

export async function ack(queue: string, msgId: bigint): Promise<void> {
  await getPool().query(`select pgmq.delete($1, $2)`, [queue, msgId]);
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
}
