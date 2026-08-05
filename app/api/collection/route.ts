// 컬렉션 수량 조회/저장 API.
// GET  /api/collection?variantId=123      → { quantity }
// POST /api/collection  { variantId, quantity }  → 저장(upsert)
//
// ⚠ 인증 미구현: 데모용으로 user_id를 1로 고정한다.
//    실제로는 세션에서 사용자 식별로 교체할 것. (TODO: auth)
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEMO_USER_ID = 1;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const variantId = Number(searchParams.get("variantId"));
  if (!Number.isInteger(variantId)) {
    return NextResponse.json({ error: "variantId required" }, { status: 400 });
  }

  try {
    const rows = await query<{ quantity: number }>(
      `SELECT quantity FROM user_collection WHERE user_id = $1 AND variant_id = $2`,
      [DEMO_USER_ID, variantId],
    );
    return NextResponse.json({ quantity: rows[0]?.quantity ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { variantId?: number; quantity?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const variantId = Number(body.variantId);
  const quantity = Number(body.quantity);
  if (!Number.isInteger(variantId) || !Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json({ error: "variantId, quantity(>=0) required" }, { status: 400 });
  }

  try {
    await query(
      `INSERT INTO user_collection (user_id, variant_id, quantity, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, variant_id)
       DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
      [DEMO_USER_ID, variantId, quantity],
    );
    return NextResponse.json({ ok: true, quantity });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
