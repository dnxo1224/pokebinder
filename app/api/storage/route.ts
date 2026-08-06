// 카드 보관함
// GET    /api/storage             → 보관함 목록 (아직 바인더에 배치되지 않은 카드)
// POST   /api/storage { cardId }  → 도감에서 담기
// DELETE /api/storage { id }      → 보관함에서 버리기
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEMO_USER_ID = 1; // TODO: auth

export async function GET() {
  try {
    const rows = await query(
      `SELECT st.id, c.id AS card_id, c.name, c.local_id, c.rarity, c.category,
              c.types, c.image_base, s.name AS set_name, s.external_id AS set_code
         FROM card_storage st
         JOIN cards c ON c.id = st.card_id
         JOIN sets  s ON s.id = c.set_id
        WHERE st.user_id = $1
        ORDER BY st.added_at DESC, st.id DESC`,
      [DEMO_USER_ID],
    );
    return NextResponse.json({ storage: rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { cardId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const cardId = Number(body.cardId);
  if (!Number.isInteger(cardId)) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  try {
    // 같은 카드를 여러 장 담을 수 있다 (실물 복본)
    const rows = await query<{ id: number }>(
      `INSERT INTO card_storage (user_id, card_id) VALUES ($1, $2) RETURNING id`,
      [DEMO_USER_ID, cardId],
    );
    const [{ count }] = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM card_storage WHERE user_id = $1`,
      [DEMO_USER_ID],
    );
    return NextResponse.json({ ok: true, id: rows[0].id, count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  let body: { id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    await query(`DELETE FROM card_storage WHERE id = $1 AND user_id = $2`, [
      id,
      DEMO_USER_ID,
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
