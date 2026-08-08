// 도감 조회 (ADR-0001)
//
// 대분류마다 2단(묶음 목록)과 3단(카드)이 있다. 언어 필터와 검색어는
// 두 단계 모두에 적용된다 — 2단에서는 묶음 이름을, 3단에서는 카드/아티스트 이름을 훑는다.
//
// 도감번호는 항상 COALESCE(manual_dex_ids, dex_ids) 로 읽는다.
// 수작업 라벨(manual_dex_ids)이 TCGdex 원본보다 우선한다.
import { query } from "@/lib/db";
import type { LangValue } from "@/lib/dex";

/** global 이면 전 언어 합집합이라 조건이 사라진다. */
function langArg(lang: LangValue): boolean {
  return lang === "global";
}

function like(q: string): string | null {
  return q ? `%${q}%` : null;
}

export interface CardRow {
  id: number;
  name: string;
  local_id: string;
  rarity: string | null;
  category: string;
  image_base: string | null;
  types: string[] | null;
}

/** 카드 목록의 공통 SELECT. 정렬은 호출부가 정한다.
 *  total 은 윈도 함수로 같이 받는다 — 개수를 세려고 쿼리를 한 번 더 돌리지 않으려고. */
const CARD_COLS = `c.id, c.name, c.local_id, c.rarity, c.category, c.image_base, c.types,
                   count(*) OVER() AS total`;

export interface CardPage {
  cards: CardRow[];
  total: number;
}

type CardRowWithTotal = CardRow & { total: string };

function toPage(rows: CardRowWithTotal[]): CardPage {
  return {
    cards: rows.map(({ total: _t, ...c }) => c),
    total: rows.length > 0 ? Number(rows[0].total) : 0,
  };
}

/** 1-based 페이지를 OFFSET 으로. */
function offset(page: number, size: number): number {
  return Math.max(0, (page - 1) * size);
}

// ── 카드 세트 ────────────────────────────────────────────────────────
export interface SetRow {
  external_id: string;
  name: string;
  lang: string;
  release_date: string | null;
  logo_url: string | null;
  card_count_total: number | null;
  ingested: number;
}

export async function listSets(lang: LangValue, q: string): Promise<SetRow[]> {
  const rows = await query<Omit<SetRow, "ingested"> & { ingested: string }>(
    `SELECT s.external_id, s.name, s.lang,
            to_char(s.release_date, 'YYYY-MM-DD') AS release_date,
            s.logo_url, s.card_count_total, COUNT(c.id) AS ingested
       FROM sets s
       LEFT JOIN cards c ON c.set_id = s.id
      WHERE ($1 OR s.lang = $2)
        AND ($3::text IS NULL OR s.name ILIKE $3 OR s.external_id ILIKE $3)
      GROUP BY s.id
      ORDER BY s.release_date DESC NULLS LAST, s.external_id`,
    [langArg(lang), lang, like(q)],
  );
  return rows.map((r) => ({ ...r, ingested: Number(r.ingested) }));
}

export async function setDetail(code: string, lang: LangValue) {
  const [row] = await query<{ name: string; logo_url: string | null; release_date: string | null }>(
    `SELECT name, logo_url, to_char(release_date, 'YYYY-MM-DD') AS release_date
       FROM sets WHERE external_id = $1 AND ($2 OR lang = $3)
      ORDER BY (lang = $3) DESC LIMIT 1`,
    [code, langArg(lang), lang],
  );
  return row ?? null;
}

export async function cardsInSet(
  code: string,
  lang: LangValue,
  q: string,
  page: number,
  size: number,
): Promise<CardPage> {
  return toPage(
    await query<CardRowWithTotal>(
      `SELECT ${CARD_COLS}
         FROM cards c JOIN sets s ON s.id = c.set_id
        WHERE s.external_id = $1
          AND ($2 OR c.lang = $3)
          AND ($4::text IS NULL OR c.name ILIKE $4 OR c.illustrator ILIKE $4)
        ORDER BY LPAD(regexp_replace(c.local_id, '\\D', '', 'g'), 6, '0'), c.local_id
        LIMIT $5 OFFSET $6`,
      [code, langArg(lang), lang, like(q), size, offset(page, size)],
    ),
  );
}

// ── 포켓몬 도감번호 ──────────────────────────────────────────────────
export interface SpeciesRow {
  dex: string; // NUMERIC 이라 문자열로 온다 (폼 변형은 384.1 같은 소수)
  name: string;
  cards: number;
  image_base: string | null;
}

export async function listSpecies(lang: LangValue, q: string): Promise<SpeciesRow[]> {
  // 대표 이름은 '가장 짧은 이름'을 쓴다. 'Charizard ex' 같은 파생형보다
  // 기본형이 짧아 종 이름으로 적합하다.
  const rows = await query<{ dex: string; name: string; cards: string; image_base: string | null }>(
    `SELECT d::text AS dex,
            (array_agg(c.name ORDER BY length(c.name), c.name))[1] AS name,
            count(*) AS cards,
            (array_agg(c.image_base ORDER BY (c.image_base IS NULL), length(c.name)))[1] AS image_base
       FROM cards c, unnest(COALESCE(c.manual_dex_ids, c.dex_ids)) AS d
      WHERE ($1 OR c.lang = $2)
      GROUP BY d
     HAVING ($3::text IS NULL
             OR d::text ILIKE $3
             OR (array_agg(c.name ORDER BY length(c.name), c.name))[1] ILIKE $3)
      ORDER BY d`,
    [langArg(lang), lang, like(q)],
  );
  return rows.map((r) => ({ ...r, cards: Number(r.cards) }));
}

export async function cardsOfSpecies(
  dex: string,
  lang: LangValue,
  q: string,
  page: number,
  size: number,
): Promise<CardPage> {
  return toPage(
    await query<CardRowWithTotal>(
      `SELECT ${CARD_COLS}
         FROM cards c JOIN sets s ON s.id = c.set_id
        WHERE COALESCE(c.manual_dex_ids, c.dex_ids) @> ARRAY[$1::numeric]
          AND ($2 OR c.lang = $3)
          AND ($4::text IS NULL OR c.name ILIKE $4 OR c.illustrator ILIKE $4)
        ORDER BY s.release_date DESC NULLS LAST, c.local_id
        LIMIT $5 OFFSET $6`,
      [dex, langArg(lang), lang, like(q), size, offset(page, size)],
    ),
  );
}

export async function speciesName(dex: string, lang: LangValue): Promise<string | null> {
  const [row] = await query<{ name: string }>(
    `SELECT (array_agg(c.name ORDER BY length(c.name), c.name))[1] AS name
       FROM cards c
      WHERE COALESCE(c.manual_dex_ids, c.dex_ids) @> ARRAY[$1::numeric]
        AND ($2 OR c.lang = $3)`,
    [dex, langArg(lang), lang],
  );
  return row?.name ?? null;
}

// ── 아티스트 ─────────────────────────────────────────────────────────
export interface ArtistRow {
  illustrator: string;
  cards: number;
}

export async function listArtists(lang: LangValue, q: string): Promise<ArtistRow[]> {
  const rows = await query<{ illustrator: string; cards: string }>(
    `SELECT illustrator, count(*) AS cards
       FROM cards
      WHERE illustrator IS NOT NULL
        AND ($1 OR lang = $2)
        AND ($3::text IS NULL OR illustrator ILIKE $3)
      GROUP BY illustrator
      ORDER BY count(*) DESC, illustrator`,
    [langArg(lang), lang, like(q)],
  );
  return rows.map((r) => ({ ...r, cards: Number(r.cards) }));
}

export async function cardsByArtist(
  artist: string,
  lang: LangValue,
  q: string,
  page: number,
  size: number,
): Promise<CardPage> {
  return toPage(
    await query<CardRowWithTotal>(
      `SELECT ${CARD_COLS}
         FROM cards c JOIN sets s ON s.id = c.set_id
        WHERE c.illustrator = $1
          AND ($2 OR c.lang = $3)
          AND ($4::text IS NULL OR c.name ILIKE $4)
        ORDER BY s.release_date DESC NULLS LAST, c.local_id
        LIMIT $5 OFFSET $6`,
      [artist, langArg(lang), lang, like(q), size, offset(page, size)],
    ),
  );
}

// ── 트레이너 / 에너지 ────────────────────────────────────────────────
// 하위 타입은 목록에 없는 값을 전부 폴백 자리로 접는다.
// (트레이너의 희귀 2종·구형 NULL → 'classic', 에너지의 NULL → 'other')

export interface TypeRow {
  type: string;
  cards: number;
}

/** 정해진 타입 목록 안이면 그대로, 아니면 폴백으로 접는 SQL 식. */
function bucketExpr(column: string, known: readonly string[], fallback: string): string {
  const list = known.map((t) => `'${t}'`).join(",");
  return `CASE WHEN ${column} IN (${list}) THEN ${column} ELSE '${fallback}' END`;
}

async function listTypes(
  category: "Trainer" | "Energy",
  column: "trainer_type" | "energy_type",
  known: readonly string[],
  fallback: string,
  lang: LangValue,
): Promise<TypeRow[]> {
  const rows = await query<{ type: string; cards: string }>(
    `SELECT ${bucketExpr(column, known, fallback)} AS type, count(*) AS cards
       FROM cards
      WHERE category = $1 AND ($2 OR lang = $3)
      GROUP BY 1`,
    [category, langArg(lang), lang],
  );
  // 정렬은 호출부가 정한 순서를 따르므로 여기서는 map 만 만든다
  return rows.map((r) => ({ ...r, cards: Number(r.cards) }));
}

export const listTrainerTypes = (known: readonly string[], lang: LangValue) =>
  listTypes("Trainer", "trainer_type", known, "classic", lang);

export const listEnergyTypes = (known: readonly string[], lang: LangValue) =>
  listTypes("Energy", "energy_type", known, "other", lang);

async function cardsOfType(
  category: "Trainer" | "Energy",
  column: "trainer_type" | "energy_type",
  known: readonly string[],
  fallback: string,
  type: string,
  lang: LangValue,
  q: string,
  page: number,
  size: number,
): Promise<CardPage> {
  // 폴백 자리는 '목록에 없는 값 전부'라서 조건이 반대가 된다
  const list = known.map((t) => `'${t}'`).join(",");
  const cond =
    type === fallback
      ? `(c.${column} IS NULL OR c.${column} NOT IN (${list}))`
      : `c.${column} = $6`;

  return toPage(
    await query<CardRowWithTotal>(
      `SELECT ${CARD_COLS}
         FROM cards c JOIN sets s ON s.id = c.set_id
        WHERE c.category = $1
          AND ($2 OR c.lang = $3)
          AND ($4::text IS NULL OR c.name ILIKE $4 OR c.illustrator ILIKE $4)
          AND ${cond}
        ORDER BY s.release_date DESC NULLS LAST, c.local_id
        LIMIT $5 OFFSET ${type === fallback ? "$6" : "$7"}`,
      type === fallback
        ? [category, langArg(lang), lang, like(q), size, offset(page, size)]
        : [category, langArg(lang), lang, like(q), size, type, offset(page, size)],
    ),
  );
}

export const cardsOfTrainerType = (
  known: readonly string[], type: string, lang: LangValue, q: string, page: number, size: number,
) => cardsOfType("Trainer", "trainer_type", known, "classic", type, lang, q, page, size);

export const cardsOfEnergyType = (
  known: readonly string[], type: string, lang: LangValue, q: string, page: number, size: number,
) => cardsOfType("Energy", "energy_type", known, "other", type, lang, q, page, size);

// ── etc — 포켓몬인데 도감번호가 없는 카드 ────────────────────────────
// 수작업 라벨링(manual_dex_ids)이 끝나면 사라질 임시 분류다. (ADR-0001)
export async function cardsWithoutDex(
  lang: LangValue,
  q: string,
  page: number,
  size: number,
): Promise<CardPage> {
  return toPage(
    await query<CardRowWithTotal>(
      `SELECT ${CARD_COLS}
         FROM cards c JOIN sets s ON s.id = c.set_id
        WHERE c.category = 'Pokemon'
          AND ($1 OR c.lang = $2)
          AND array_length(COALESCE(c.manual_dex_ids, c.dex_ids), 1) IS NULL
          AND ($3::text IS NULL OR c.name ILIKE $3 OR c.illustrator ILIKE $3)
        ORDER BY s.release_date DESC NULLS LAST, c.local_id
        LIMIT $4 OFFSET $5`,
      [langArg(lang), lang, like(q), size, offset(page, size)],
    ),
  );
}

// ── 즐겨찾기 표시용 ──────────────────────────────────────────────────
/** 주어진 카드들 중 이미 찜한 것의 id 집합. 타일마다 조회하지 않으려고 한 번에 받는다. */
export async function favoritedIds(userId: number, cardIds: number[]): Promise<Set<number>> {
  if (cardIds.length === 0) return new Set();
  const rows = await query<{ card_id: number }>(
    `SELECT card_id FROM favorites WHERE user_id = $1 AND card_id = ANY($2::bigint[])`,
    [userId, cardIds],
  );
  return new Set(rows.map((r) => r.card_id));
}
