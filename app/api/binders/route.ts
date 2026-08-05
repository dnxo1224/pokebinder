// 바인더 목록/생성 API
// GET  /api/binders            → 바인더 목록 (카드 수 포함)
// POST /api/binders  { name, rows, cols }  → 생성
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEMO_USER_ID = 1; // TODO: auth

export async function GET() {
  try {
    const rows = await query(
      `SELECT b.id, b.name, b.grid_rows, b.grid_cols,
              COUNT(bc.id)::int AS card_count
       FROM binders b
       LEFT JOIN binder_cards bc ON bc.binder_id = b.id
       WHERE b.user_id = $1
       GROUP BY b.id
       ORDER BY b.created_at`,
      [DEMO_USER_ID],
    );
    return NextResponse.json({ binders: rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { name?: string; rows?: number; cols?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const gr = Number(body.rows);
  const gc = Number(body.cols);
  if (!name) {
    return NextResponse.json({ error: "이름을 입력하세요" }, { status: 400 });
  }
  if (![1, 2, 3, 4].includes(gr) || ![1, 2, 3, 4].includes(gc)) {
    return NextResponse.json({ error: "행/열은 1~4만 가능합니다" }, { status: 400 });
  }

  try {
    const rows = await query<{ id: number }>(
      `INSERT INTO binders (user_id, name, grid_rows, grid_cols)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [DEMO_USER_ID, name, gr, gc],
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
