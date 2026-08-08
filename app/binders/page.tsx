import { query } from "@/lib/db";
import BinderList, { type BinderSummary } from "@/components/BinderList";

export const dynamic = "force-dynamic";

const DEMO_USER_ID = 1; // TODO: auth

/** 커버를 지정하지 않은 바인더의 기본 이미지 (ADR-0001) */
const DEFAULT_COVER_SET = "base1";

export default async function BindersPage() {
  let binders: BinderSummary[] = [];
  let defaultCover: string | null = null;
  let dbError = false;

  try {
    const rows = await query<{
      id: number;
      name: string;
      grid_rows: number;
      grid_cols: number;
      page_count: number;
      placed: string;
      cover_logo: string | null;
    }>(
      `SELECT b.id, b.name, b.grid_rows, b.grid_cols, b.page_count,
              COUNT(bc.id) AS placed,
              cs.logo_url AS cover_logo
         FROM binders b
         LEFT JOIN binder_cards bc ON bc.binder_id = b.id
         LEFT JOIN sets cs ON cs.id = b.cover_set_id
        WHERE b.user_id = $1
        GROUP BY b.id, cs.logo_url
        ORDER BY b.created_at`,
      [DEMO_USER_ID],
    );

    binders = rows.map((b) => ({
      id: b.id,
      name: b.name,
      rows: b.grid_rows,
      cols: b.grid_cols,
      pageCount: b.page_count,
      placed: Number(b.placed),
      coverLogo: b.cover_logo,
    }));

    const [base] = await query<{ logo_url: string | null }>(
      `SELECT logo_url FROM sets WHERE external_id = $1 AND logo_url IS NOT NULL LIMIT 1`,
      [DEFAULT_COVER_SET],
    );
    defaultCover = base?.logo_url ?? null;
  } catch (e) {
    console.error("binders load failed:", (e as Error).message);
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="info-box">
        데이터베이스에 연결하지 못했습니다. DB가 실행 중인지 확인하세요.
      </div>
    );
  }

  return <BinderList binders={binders} defaultCover={defaultCover} />;
}
