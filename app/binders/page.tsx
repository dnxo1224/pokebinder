import { query } from "@/lib/db";
import BinderManager, {
  type BinderData,
  type StorageCard,
} from "@/components/BinderManager";

export const dynamic = "force-dynamic";

const DEMO_USER_ID = 1; // TODO: auth

export default async function BindersPage() {
  let binders: BinderData[] = [];
  let storage: StorageCard[] = [];
  let dbError = false;

  try {
    const rows = await query<{
      id: number;
      name: string;
      grid_rows: number;
      grid_cols: number;
      page_count: number;
    }>(
      `SELECT id, name, grid_rows, grid_cols, page_count
       FROM binders WHERE user_id = $1 ORDER BY created_at`,
      [DEMO_USER_ID],
    );

    // 배치된 카드 — position 이 곧 슬롯 번호다
    const placed = await query<{
      binder_id: number;
      position: number;
      name: string;
      local_id: string;
      rarity: string | null;
      image_base: string | null;
    }>(
      `SELECT bc.binder_id, bc.position,
              c.name, c.local_id, c.rarity, c.image_base
       FROM binder_cards bc
       JOIN binders b ON b.id = bc.binder_id
       JOIN cards c ON c.id = bc.card_id
       WHERE b.user_id = $1
       ORDER BY bc.position`,
      [DEMO_USER_ID],
    );

    binders = rows.map((b) => ({
      ...b,
      cards: placed
        .filter((c) => c.binder_id === b.id)
        .map((c) => ({
          position: c.position,
          name: c.name,
          localId: c.local_id,
          rarity: c.rarity,
          imageBase: c.image_base,
        })),
    }));

    // 보관함 — 아직 어느 바인더에도 놓이지 않은 카드
    const st = await query<{
      id: number;
      name: string;
      local_id: string;
      rarity: string | null;
      category: string;
      types: string[] | null;
      image_base: string | null;
      set_name: string;
    }>(
      `SELECT st.id, c.name, c.local_id, c.rarity, c.category, c.types,
              c.image_base, s.name AS set_name
       FROM card_storage st
       JOIN cards c ON c.id = st.card_id
       JOIN sets  s ON s.id = c.set_id
       WHERE st.user_id = $1
       ORDER BY s.name, LPAD(regexp_replace(c.local_id, '\\D', '', 'g'), 6, '0'), c.local_id`,
      [DEMO_USER_ID],
    );
    storage = st.map((r) => ({
      id: r.id,
      name: r.name,
      localId: r.local_id,
      rarity: r.rarity,
      category: r.category,
      types: r.types,
      imageBase: r.image_base,
      setName: r.set_name,
    }));
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

  return <BinderManager initial={binders} storage={storage} />;
}
