import { query } from "@/lib/db";
import BinderManager, { type BinderData } from "@/components/BinderManager";

export const dynamic = "force-dynamic";

const DEMO_USER_ID = 1; // TODO: auth

export default async function BindersPage() {
  let binders: BinderData[] = [];
  let dbError = false;

  try {
    const rows = await query<{
      id: number;
      name: string;
      grid_rows: number;
      grid_cols: number;
    }>(
      `SELECT id, name, grid_rows, grid_cols
       FROM binders WHERE user_id = $1 ORDER BY created_at`,
      [DEMO_USER_ID],
    );

    // 각 바인더의 카드(배치 순서대로)
    const cards = await query<{
      binder_id: number;
      entry_id: number;
      position: number | null;
      name: string;
      local_id: string;
      image_base: string | null;
    }>(
      `SELECT bc.binder_id, bc.id AS entry_id, bc.position,
              c.name, c.local_id, c.image_base
       FROM binder_cards bc
       JOIN binders b ON b.id = bc.binder_id
       JOIN cards c ON c.id = bc.card_id
       WHERE b.user_id = $1
       ORDER BY bc.position NULLS LAST, bc.id`,
      [DEMO_USER_ID],
    );

    binders = rows.map((b) => ({
      ...b,
      cards: cards
        .filter((c) => c.binder_id === b.id)
        .map((c) => ({
          entryId: c.entry_id,
          name: c.name,
          localId: c.local_id,
          imageBase: c.image_base,
        })),
    }));
  } catch (e) {
    console.error("binders load failed:", (e as Error).message);
    dbError = true;
  }

  if (dbError) {
    return (
      <>
        <div className="panel-head">내 바인더</div>
        <div className="panel">
          <p>데이터베이스에 연결하지 못했습니다. DB가 실행 중인지 확인하세요.</p>
        </div>
      </>
    );
  }

  return <BinderManager initial={binders} />;
}
