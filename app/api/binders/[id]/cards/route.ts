// 바인더에 카드 추가 / 빼기
// POST   /api/binders/3/cards  { cardId }   → 추가 (같은 카드 중복 허용: 실물 복본)
// DELETE /api/binders/3/cards  { entryId }  → 해당 항목 1개 제거
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEMO_USER_ID = 1; // TODO: auth

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const binderId = Number(id);
  let body: { cardId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const cardId = Number(body.cardId);
  if (!Number.isInteger(binderId) || !Number.isInteger(cardId)) {
    return NextResponse.json({ error: "binderId, cardId required" }, { status: 400 });
  }

  try {
    // 소유 확인 + 용량 확인 (양면 스프레드: 좌우 2페이지 = rows*cols*2)
    const b = await query<{ cap: number; used: number }>(
      `SELECT (b.grid_rows * b.grid_cols * 2) AS cap,
              (SELECT COUNT(*)::int FROM binder_cards WHERE binder_id = b.id) AS used
       FROM binders b WHERE b.id = $1 AND b.user_id = $2`,
      [binderId, DEMO_USER_ID],
    );
    if (b.length === 0) {
      return NextResponse.json({ error: "바인더를 찾을 수 없습니다" }, { status: 404 });
    }
    if (b[0].used >= b[0].cap) {
      return NextResponse.json(
        { error: `바인더가 가득 찼습니다 (${b[0].cap}칸)` },
        { status: 409 },
      );
    }

    const rows = await query<{ id: number }>(
      `INSERT INTO binder_cards (binder_id, card_id, position)
       VALUES ($1, $2, $3) RETURNING id`,
      [binderId, cardId, b[0].used],
    );
    return NextResponse.json({ ok: true, id: rows[0].id, used: b[0].used + 1, cap: b[0].cap });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const binderId = Number(id);
  let body: { entryId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const entryId = Number(body.entryId);
  if (!Number.isInteger(binderId) || !Number.isInteger(entryId)) {
    return NextResponse.json({ error: "entryId required" }, { status: 400 });
  }

  try {
    await query(
      `DELETE FROM binder_cards bc
       USING binders b
       WHERE bc.id = $1 AND bc.binder_id = b.id
         AND b.id = $2 AND b.user_id = $3`,
      [entryId, binderId, DEMO_USER_ID],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
