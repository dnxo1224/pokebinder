// 바인더 페이지 추가 / 삭제 (1~20장)
//
// POST   /api/binders/3/pages  { afterPage }  → afterPage 다음에 빈 페이지 삽입
// DELETE /api/binders/3/pages  { page }       → 그 페이지 삭제 (있던 카드는 보관함으로)
//
// 페이지 p(0-based)는 position p*perPage … (p+1)*perPage-1 을 차지한다.
// 페이지를 끼우거나 빼면 뒤쪽 카드의 position 을 perPage 만큼 통째로 민다.
import { NextResponse } from "next/server";
import { query, withTx } from "@/lib/db";
import type { PoolClient } from "pg";

const DEMO_USER_ID = 1; // TODO: auth
const MAX_PAGES = 20;

interface BinderRow {
  grid_rows: number;
  grid_cols: number;
  page_count: number;
}

async function loadBinder(binderId: number): Promise<BinderRow | null> {
  const rows = await query<BinderRow>(
    `SELECT grid_rows, grid_cols, page_count
       FROM binders WHERE id = $1 AND user_id = $2`,
    [binderId, DEMO_USER_ID],
  );
  return rows[0] ?? null;
}

/**
 * position >= from 인 카드를 delta 만큼 민다.
 * (binder_id, position) 유일 인덱스 때문에 한 번에 옮기면 중간에 충돌하므로,
 * 음수 자리로 피신시켰다가 최종 위치로 옮기는 2단계로 처리한다.
 */
async function shift(c: PoolClient, binderId: number, from: number, delta: number) {
  await c.query(
    `UPDATE binder_cards SET position = -position - 1
      WHERE binder_id = $1 AND position >= $2`,
    [binderId, from],
  );
  await c.query(
    `UPDATE binder_cards SET position = (-position - 1) + $2
      WHERE binder_id = $1 AND position < 0`,
    [binderId, delta],
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const binderId = Number(id);
  let body: { afterPage?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const binder = await loadBinder(binderId);
  if (!binder) {
    return NextResponse.json({ error: "바인더를 찾을 수 없습니다" }, { status: 404 });
  }
  if (binder.page_count >= MAX_PAGES) {
    return NextResponse.json(
      { error: `페이지는 최대 ${MAX_PAGES}장까지입니다` },
      { status: 409 },
    );
  }

  const afterPage = Number(body.afterPage);
  if (!Number.isInteger(afterPage) || afterPage < 0 || afterPage >= binder.page_count) {
    return NextResponse.json({ error: "afterPage 범위를 벗어났습니다" }, { status: 400 });
  }

  const perPage = binder.grid_rows * binder.grid_cols;
  const insertAt = (afterPage + 1) * perPage; // 새 페이지가 차지할 첫 position

  try {
    await withTx(async (c) => {
      await shift(c, binderId, insertAt, perPage);
      await c.query(
        `UPDATE binders SET page_count = page_count + 1 WHERE id = $1 AND user_id = $2`,
        [binderId, DEMO_USER_ID],
      );
    });
    return NextResponse.json({ ok: true, page: afterPage + 1, pageCount: binder.page_count + 1 });
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
  let body: { page?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const binder = await loadBinder(binderId);
  if (!binder) {
    return NextResponse.json({ error: "바인더를 찾을 수 없습니다" }, { status: 404 });
  }
  if (binder.page_count <= 1) {
    return NextResponse.json({ error: "마지막 페이지는 삭제할 수 없습니다" }, { status: 409 });
  }

  const page = Number(body.page);
  if (!Number.isInteger(page) || page < 0 || page >= binder.page_count) {
    return NextResponse.json({ error: "page 범위를 벗어났습니다" }, { status: 400 });
  }

  const perPage = binder.grid_rows * binder.grid_cols;
  const start = page * perPage;
  const end = start + perPage; // 미포함

  try {
    const moved = await withTx(async (c) => {
      // 이 페이지에 있던 카드는 버리지 않고 보관함으로 되돌린다
      const res = await c.query<{ card_id: number }>(
        `SELECT card_id FROM binder_cards
          WHERE binder_id = $1 AND position >= $2 AND position < $3 FOR UPDATE`,
        [binderId, start, end],
      );
      if (res.rowCount) {
        await c.query(
          `INSERT INTO card_storage (user_id, card_id)
           SELECT $1, unnest($2::bigint[])`,
          [DEMO_USER_ID, res.rows.map((r) => r.card_id)],
        );
        await c.query(
          `DELETE FROM binder_cards
            WHERE binder_id = $1 AND position >= $2 AND position < $3`,
          [binderId, start, end],
        );
      }

      await shift(c, binderId, end, -perPage);
      await c.query(
        `UPDATE binders SET page_count = page_count - 1 WHERE id = $1 AND user_id = $2`,
        [binderId, DEMO_USER_ID],
      );
      return res.rowCount ?? 0;
    });

    return NextResponse.json({
      ok: true,
      returnedToStorage: moved,
      pageCount: binder.page_count - 1,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
