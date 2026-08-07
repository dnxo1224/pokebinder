// 즐겨찾기 (ADR-0001)
// GET    /api/favorites              → 찜한 카드 목록
// PUT    /api/favorites { cardId }   → 찜하기   (멱등)
// DELETE /api/favorites { cardId }   → 찜 해제  (멱등)
//
// 수량 개념이 없다. 같은 카드를 여러 장 배치하려면 바인더에서 여러 번 끌어다 놓는다.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEMO_USER_ID = 1; // TODO: auth

async function readCardId(req: Request): Promise<number | null> {
  try {
    const body = (await req.json()) as { cardId?: number };
    const id = Number(body.cardId);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

async function count(): Promise<number> {
  const [row] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM favorites WHERE user_id = $1`,
    [DEMO_USER_ID],
  );
  return row?.n ?? 0;
}

export async function GET() {
  try {
    const rows = await query(
      `SELECT f.card_id, c.name, c.local_id, c.rarity, c.category, c.types,
              c.image_base, c.lang, s.name AS set_name, s.external_id AS set_code
         FROM favorites f
         JOIN cards c ON c.id = f.card_id
         JOIN sets  s ON s.id = c.set_id
        WHERE f.user_id = $1
        ORDER BY f.added_at DESC, f.id DESC`,
      [DEMO_USER_ID],
    );
    return NextResponse.json({ favorites: rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const cardId = await readCardId(req);
  if (cardId === null) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }
  try {
    await query(
      `INSERT INTO favorites (user_id, card_id) VALUES ($1, $2)
       ON CONFLICT (user_id, card_id) DO NOTHING`,
      [DEMO_USER_ID, cardId],
    );
    return NextResponse.json({ ok: true, favorited: true, count: await count() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const cardId = await readCardId(req);
  if (cardId === null) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }
  try {
    await query(`DELETE FROM favorites WHERE user_id = $1 AND card_id = $2`, [
      DEMO_USER_ID,
      cardId,
    ]);
    return NextResponse.json({ ok: true, favorited: false, count: await count() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
