import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic"; // 항상 DB 최신값

interface SetRow {
  external_id: string;
  name: string;
  lang: string;
  release_date: string | null;
  symbol_url: string | null;
  card_count_total: number | null;
  ingested: string; // count()는 문자열로 옴
}

async function loadSets(): Promise<SetRow[] | null> {
  try {
    return await query<SetRow>(
      `SELECT s.external_id, s.name, s.lang,
              to_char(s.release_date, 'YYYY-MM-DD') AS release_date,
              s.symbol_url, s.card_count_total, COUNT(c.id) AS ingested
       FROM sets s
       LEFT JOIN cards c ON c.set_id = s.id
       GROUP BY s.id
       ORDER BY s.release_date DESC NULLS LAST, s.external_id`,
    );
  } catch (e) {
    console.error("loadSets failed:", (e as Error).message);
    return null; // DB 미연결/미마이그레이션
  }
}

export default async function SetsPage() {
  const sets = await loadSets();

  if (sets === null) {
    return (
      <>
        <h1>세트</h1>
        <div className="notice">
          데이터베이스에 연결하지 못했습니다. <code>docker compose up -d</code> 로 DB를
          띄우고 <code>npm run db:migrate</code> 를 실행했는지 확인하세요.
        </div>
      </>
    );
  }

  if (sets.length === 0) {
    return (
      <>
        <h1>세트</h1>
        <div className="notice">
          아직 적재된 세트가 없습니다. <code>npm run ingest -- --lang en --limit 3</code>{" "}
          으로 샘플 데이터를 넣어보세요.
        </div>
      </>
    );
  }

  return (
    <>
      <h1>세트</h1>
      <p className="muted">{sets.length}개 세트</p>
      <ul className="set-list">
        {sets.map((s) => (
          <li key={`${s.lang}-${s.external_id}`}>
            <Link href={`/sets/${s.external_id}`} className="set-row">
              {s.symbol_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${s.symbol_url}.png`} alt="" />
              ) : (
                <span style={{ width: 34 }} />
              )}
              <span className="name">{s.name}</span>
              <span className="badge">{s.lang}</span>
              <span className="meta">
                {s.ingested}/{s.card_count_total ?? "?"} 적재
                {s.release_date ? ` · ${s.release_date}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
