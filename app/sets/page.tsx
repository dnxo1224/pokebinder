import { query } from "@/lib/db";
import SetBrowser, { type SetItem } from "@/components/SetBrowser";
import { setArtFor } from "@/lib/setArt";

export const dynamic = "force-dynamic"; // 항상 DB 최신값

interface SetRow {
  external_id: string;
  name: string;
  lang: string;
  release_date: string | null;
  logo_url: string | null;
  card_count_total: number | null;
  ingested: string; // count()는 문자열로 옴
}

async function loadSets(): Promise<SetRow[] | null> {
  try {
    return await query<SetRow>(
      `SELECT s.external_id, s.name, s.lang,
              to_char(s.release_date, 'YYYY-MM-DD') AS release_date,
              s.logo_url, s.card_count_total, COUNT(c.id) AS ingested
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
  const rows = await loadSets();

  if (rows === null) {
    return (
      <>
        <div className="section-head">
          <h2>세트 도감</h2>
        </div>
        <div className="info-box">
          데이터베이스에 연결하지 못했습니다. <code>docker compose up -d</code> 로 DB를
          띄우고 <code>npm run db:migrate</code> 를 실행했는지 확인하세요.
        </div>
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <>
        <div className="section-head">
          <h2>세트 도감</h2>
        </div>
        <div className="info-box">
          아직 적재된 세트가 없습니다. <code>npm run ingest -- --lang en --limit 3</code>{" "}
          으로 샘플 데이터를 넣어보세요.
        </div>
      </>
    );
  }

  const sets: SetItem[] = rows.map((s) => ({
    externalId: s.external_id,
    name: s.name,
    lang: s.lang,
    releaseDate: s.release_date,
    artUrl: setArtFor(s.external_id, s.logo_url),
    total: s.card_count_total,
    ingested: Number(s.ingested),
  }));

  return <SetBrowser sets={sets} />;
}
