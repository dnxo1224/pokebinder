import { Pool, type PoolClient, type QueryResultRow } from "pg";

// 커넥션 풀은 프로세스당 하나만 만든다.
// Next.js dev 모드는 HMR로 모듈이 재평가될 수 있어 globalThis에 캐싱한다.
const globalForDb = globalThis as unknown as { _pgPool?: Pool };

export const pool =
  globalForDb._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb._pgPool = pool;

/** 얇은 질의 헬퍼. 사용: const rows = await query<Row>('SELECT ...', [params]) */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never);
  return res.rows;
}

/**
 * 트랜잭션 헬퍼. 보관함↔바인더 이동처럼 두 테이블을 함께 바꿔야 하는 작업에 쓴다.
 * 콜백이 throw 하면 롤백하고 그대로 다시 던진다.
 */
export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
