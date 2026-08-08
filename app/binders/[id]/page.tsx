import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import BinderEditor, { type BinderData } from "@/components/BinderEditor";

export const dynamic = "force-dynamic";

const DEMO_USER_ID = 1; // TODO: auth
const DEFAULT_COVER_SET = "base1";

interface BinderRow {
  id: number;
  name: string;
  grid_rows: number;
  grid_cols: number;
  page_count: number;
  cover_set_id: number | null;
  cover_logo: string | null;
}

export default async function BinderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const binderId = Number(id);
  if (!Number.isInteger(binderId)) notFound();

  let binder: BinderData | null = null;
  let coverOptions: { id: number; name: string; logo: string }[] = [];
  let defaultCover: string | null = null;
  let dbError = false;

  // notFound() 는 이 try 안에서 부르지 않는다. 제어 흐름용 예외를 던지는데
  // catch 가 그걸 삼켜서 'DB 연결 실패' 메시지로 둔갑시키기 때문이다.
  try {
    const [row] = await query<BinderRow>(
      `SELECT b.id, b.name, b.grid_rows, b.grid_cols, b.page_count, b.cover_set_id,
              cs.logo_url AS cover_logo
         FROM binders b
         LEFT JOIN sets cs ON cs.id = b.cover_set_id
        WHERE b.id = $1 AND b.user_id = $2`,
      [binderId, DEMO_USER_ID],
    );

    if (row) {
      const placed = await query<{
        position: number;
        card_id: number;
        name: string;
        local_id: string;
        rarity: string | null;
        image_base: string | null;
      }>(
        `SELECT bc.position, bc.card_id, c.name, c.local_id, c.rarity, c.image_base
           FROM binder_cards bc
           JOIN cards c ON c.id = bc.card_id
          WHERE bc.binder_id = $1
          ORDER BY bc.position`,
        [binderId],
      );

      binder = {
        id: row.id,
        name: row.name,
        rows: row.grid_rows,
        cols: row.grid_cols,
        pageCount: row.page_count,
        coverSetId: row.cover_set_id,
        coverLogo: row.cover_logo,
        cards: placed.map((c) => ({
          position: c.position,
          cardId: c.card_id,
          name: c.name,
          localId: c.local_id,
          rarity: c.rarity,
          imageBase: c.image_base,
        })),
      };

      // 커버로 고를 수 있는 세트 — 로고가 있는 것만 (157개, 전부 EN)
      coverOptions = await query<{ id: number; name: string; logo: string }>(
        `SELECT id, name, logo_url AS logo
           FROM sets WHERE logo_url IS NOT NULL
          ORDER BY release_date DESC NULLS LAST, name`,
      );

      const [base] = await query<{ logo_url: string | null }>(
        `SELECT logo_url FROM sets WHERE external_id = $1 AND logo_url IS NOT NULL LIMIT 1`,
        [DEFAULT_COVER_SET],
      );
      defaultCover = base?.logo_url ?? null;
    }
  } catch (e) {
    console.error("binder load failed:", (e as Error).message);
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="info-box">
        데이터베이스에 연결하지 못했습니다. DB가 실행 중인지 확인하세요.
      </div>
    );
  }
  if (!binder) notFound();

  return (
    <BinderEditor binder={binder} coverOptions={coverOptions} defaultCover={defaultCover} />
  );
}
