// 바인더 칸 배치 — 보관함↔바인더, 칸↔칸 이동
//
// POST /api/binders/3/slots
//   { action: 'place',   storageId, position }  보관함 → 칸
//   { action: 'unplace', position }             칸 → 보관함
//   { action: 'move',    from, to }             칸 → 칸 (대상이 차 있으면 자리 교환)
//
// 두 테이블을 함께 바꾸므로 전부 트랜잭션 안에서 처리한다.
import { NextResponse } from "next/server";
import { query, withTx } from "@/lib/db";

const DEMO_USER_ID = 1; // TODO: auth

/** 슬롯 번호를 잠시 피신시킬 자리. (binder_id, position) 유일 제약을 피하려고 쓴다. */
const TEMP_POSITION = -1;

interface Body {
  action?: string;
  storageId?: number;
  position?: number;
  from?: number;
  to?: number;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const binderId = Number(id);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Number.isInteger(binderId)) {
    return NextResponse.json({ error: "binderId required" }, { status: 400 });
  }

  // 소유 확인 + 용량 (rows*cols*page_count)
  const binder = await query<{ cap: number }>(
    `SELECT (grid_rows * grid_cols * page_count) AS cap
       FROM binders WHERE id = $1 AND user_id = $2`,
    [binderId, DEMO_USER_ID],
  );
  if (binder.length === 0) {
    return NextResponse.json({ error: "바인더를 찾을 수 없습니다" }, { status: 404 });
  }
  const cap = binder[0].cap;
  const inRange = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < cap;

  try {
    switch (body.action) {
      // ── 보관함 → 칸 ─────────────────────────────────────────────────
      case "place": {
        const storageId = Number(body.storageId);
        const position = Number(body.position);
        if (!Number.isInteger(storageId) || !inRange(position)) {
          return NextResponse.json({ error: "storageId, position 필요" }, { status: 400 });
        }

        await withTx(async (c) => {
          // 보관함 항목을 잠그고 꺼낸다 (동시에 두 칸에 넣는 것 방지)
          const st = await c.query<{ card_id: number }>(
            `SELECT card_id FROM card_storage
              WHERE id = $1 AND user_id = $2 FOR UPDATE`,
            [storageId, DEMO_USER_ID],
          );
          if (st.rowCount === 0) throw new Error("보관함에 없는 카드입니다");

          const occupied = await c.query(
            `SELECT 1 FROM binder_cards WHERE binder_id = $1 AND position = $2`,
            [binderId, position],
          );
          if (occupied.rowCount) throw new Error("이미 카드가 있는 칸입니다");

          await c.query(
            `INSERT INTO binder_cards (binder_id, card_id, position) VALUES ($1,$2,$3)`,
            [binderId, st.rows[0].card_id, position],
          );
          await c.query(`DELETE FROM card_storage WHERE id = $1`, [storageId]);
        });
        break;
      }

      // ── 칸 → 보관함 ─────────────────────────────────────────────────
      case "unplace": {
        const position = Number(body.position);
        if (!inRange(position)) {
          return NextResponse.json({ error: "position 필요" }, { status: 400 });
        }

        await withTx(async (c) => {
          const bc = await c.query<{ id: number; card_id: number }>(
            `SELECT id, card_id FROM binder_cards
              WHERE binder_id = $1 AND position = $2 FOR UPDATE`,
            [binderId, position],
          );
          if (bc.rowCount === 0) throw new Error("빈 칸입니다");

          await c.query(`INSERT INTO card_storage (user_id, card_id) VALUES ($1,$2)`, [
            DEMO_USER_ID,
            bc.rows[0].card_id,
          ]);
          await c.query(`DELETE FROM binder_cards WHERE id = $1`, [bc.rows[0].id]);
        });
        break;
      }

      // ── 칸 → 칸 (대상이 차 있으면 교환) ────────────────────────────
      case "move": {
        const from = Number(body.from);
        const to = Number(body.to);
        if (!inRange(from) || !inRange(to)) {
          return NextResponse.json({ error: "from, to 필요" }, { status: 400 });
        }
        if (from === to) break;

        await withTx(async (c) => {
          const src = await c.query<{ id: number }>(
            `SELECT id FROM binder_cards
              WHERE binder_id = $1 AND position = $2 FOR UPDATE`,
            [binderId, from],
          );
          if (src.rowCount === 0) throw new Error("빈 칸입니다");

          const dst = await c.query<{ id: number }>(
            `SELECT id FROM binder_cards
              WHERE binder_id = $1 AND position = $2 FOR UPDATE`,
            [binderId, to],
          );

          if (dst.rowCount === 0) {
            await c.query(`UPDATE binder_cards SET position = $1 WHERE id = $2`, [
              to,
              src.rows[0].id,
            ]);
          } else {
            // 유일 제약 때문에 한 쪽을 임시 자리로 피신시킨 뒤 교환한다
            await c.query(`UPDATE binder_cards SET position = $1 WHERE id = $2`, [
              TEMP_POSITION,
              src.rows[0].id,
            ]);
            await c.query(`UPDATE binder_cards SET position = $1 WHERE id = $2`, [
              from,
              dst.rows[0].id,
            ]);
            await c.query(`UPDATE binder_cards SET position = $1 WHERE id = $2`, [
              to,
              src.rows[0].id,
            ]);
          }
        });
        break;
      }

      default:
        return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
