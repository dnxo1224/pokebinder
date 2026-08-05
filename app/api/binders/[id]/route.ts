// 개별 바인더: 이름변경/크기변경, 삭제
// PATCH  /api/binders/3  { name?, rows?, cols? }
// DELETE /api/binders/3
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEMO_USER_ID = 1; // TODO: auth

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const binderId = Number(id);
  if (!Number.isInteger(binderId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  let body: { name?: string; rows?: number; cols?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: "이름을 입력하세요" }, { status: 400 });
    vals.push(n);
    sets.push(`name = $${vals.length}`);
  }
  if (body.rows !== undefined) {
    const r = Number(body.rows);
    if (![1, 2, 3, 4].includes(r))
      return NextResponse.json({ error: "행은 1~4만 가능합니다" }, { status: 400 });
    vals.push(r);
    sets.push(`grid_rows = $${vals.length}`);
  }
  if (body.cols !== undefined) {
    const c = Number(body.cols);
    if (![1, 2, 3, 4].includes(c))
      return NextResponse.json({ error: "열은 1~4만 가능합니다" }, { status: 400 });
    vals.push(c);
    sets.push(`grid_cols = $${vals.length}`);
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  vals.push(binderId, DEMO_USER_ID);
  try {
    await query(
      `UPDATE binders SET ${sets.join(", ")}
       WHERE id = $${vals.length - 1} AND user_id = $${vals.length}`,
      vals,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const binderId = Number(id);
  if (!Number.isInteger(binderId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    // binder_cards는 ON DELETE CASCADE로 함께 삭제됨
    await query(`DELETE FROM binders WHERE id = $1 AND user_id = $2`, [
      binderId,
      DEMO_USER_ID,
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
