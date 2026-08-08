// 바인더 사이드바 검색 (ADR-0001)
// GET /api/cards/search?q=&set=&lang=&fav=1&limit=60
//
// 도감의 대분류 구조를 그대로 가져오지 않는다. 사이드바는 268px 라 좁고,
// 구체적으로 고르고 싶으면 이미 도감에서 찜해뒀을 것이기 때문이다.
// 그래서 이름 검색 + 세트 선택 + 언어 + 즐겨찾기 필터만 제공한다.
//
// 언어 기본값은 '전 언어'다. 실물 바인더에는 영어판과 일본판을 섞어 꽂을 수 있다.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEMO_USER_ID = 1; // TODO: auth
const MAX_LIMIT = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const set = (url.searchParams.get("set") ?? "").trim();
  const lang = (url.searchParams.get("lang") ?? "").trim(); // 빈 값 = 전 언어
  const favOnly = url.searchParams.get("fav") === "1";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || 60));

  // 아무 조건도 없으면 결과를 쏟지 않는다 — 도감과 같은 원칙
  if (!q && !set && !favOnly) {
    return NextResponse.json({ cards: [], needsFilter: true });
  }

  try {
    const rows = await query(
      `SELECT c.id, c.name, c.local_id AS "localId", c.image_base AS "imageBase",
              c.lang, s.name AS "setName", s.external_id AS "setCode",
              (f.card_id IS NOT NULL) AS favorited
         FROM cards c
         JOIN sets s ON s.id = c.set_id
         LEFT JOIN favorites f ON f.card_id = c.id AND f.user_id = $1
        WHERE ($2::text = '' OR c.lang = $2)
          AND ($3::text = '' OR s.external_id = $3)
          AND ($4::text IS NULL OR c.name ILIKE $4 OR c.illustrator ILIKE $4)
          AND ($5::boolean = false OR f.card_id IS NOT NULL)
        ORDER BY (f.card_id IS NOT NULL) DESC, c.name, s.release_date DESC NULLS LAST
        LIMIT $6`,
      [DEMO_USER_ID, lang, set, q ? `%${q}%` : null, favOnly, limit],
    );
    return NextResponse.json({ cards: rows, limit });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
