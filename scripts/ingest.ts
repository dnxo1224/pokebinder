// TCGdex 적재: series → sets → cards → card_variants 순으로 upsert.
// 카드는 full detail을 받아 §4 스키마 전 컬럼을 채운다(category/rarity/dex_ids/variants 등).
//
// 사용법:
//   npm run ingest -- --lang en --limit 3        # en 세트 3개만 (기본값)
//   npm run ingest -- --lang ja --set SV3         # ja의 특정 세트 하나
//   npm run ingest -- --lang en --limit 0         # en 전체 (느림: 카드마다 요청)
//
// 주의: TCGdex는 API 키가 없어 rate limit이 관대하지만, 카드별 요청이라
//       전체 적재는 오래 걸린다. 처음엔 --limit로 소량 검증할 것.
import "dotenv/config";
import { Pool } from "pg";
import { getSets, getSet, getCard, type CardFull } from "../lib/tcgdex";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const LANG = arg("lang", "en")!;
const LIMIT = Number(arg("limit", "3"));
const ONLY_SET = arg("set"); // 특정 external_id만
const MAX_CARDS = Number(arg("maxcards", "0")); // 세트당 카드 수 상한(0=무제한). 데모/속도용

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function upsertSeries(serie?: { id: string; name: string }) {
  if (!serie) return null;
  const id = serie.id.toLowerCase(); // canonical
  await pool.query(
    `INSERT INTO series (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [id, serie.name],
  );
  return id;
}

async function upsertSet(lang: string, extId: string): Promise<number> {
  const s = await getSet(lang, extId);
  const seriesId = await upsertSeries(s.serie);
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO sets (lang, external_id, series_id, name, abbreviation,
        card_count_total, card_count_official, release_date, logo_url, symbol_url,
        legal_standard, legal_expanded, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'tcgdex')
     ON CONFLICT (lang, external_id) DO UPDATE SET
        series_id=EXCLUDED.series_id, name=EXCLUDED.name, abbreviation=EXCLUDED.abbreviation,
        card_count_total=EXCLUDED.card_count_total, card_count_official=EXCLUDED.card_count_official,
        release_date=EXCLUDED.release_date, logo_url=EXCLUDED.logo_url, symbol_url=EXCLUDED.symbol_url,
        legal_standard=EXCLUDED.legal_standard, legal_expanded=EXCLUDED.legal_expanded
     RETURNING id`,
    [
      lang, s.id, seriesId, s.name, s.abbreviation?.official ?? null,
      s.cardCount?.total ?? null, s.cardCount?.official ?? null,
      s.releaseDate ?? null, s.logo ?? null, s.symbol ?? null,
      s.legal?.standard ?? null, s.legal?.expanded ?? null,
    ],
  );
  const setId = rows[0].id;

  let cardCount = 0;
  const briefs = MAX_CARDS > 0 ? s.cards.slice(0, MAX_CARDS) : s.cards;
  for (const brief of briefs) {
    const card = await getCard(lang, brief.id);
    const cardId = await upsertCard(setId, lang, card);
    await upsertVariants(cardId, card);
    cardCount++;
  }
  return cardCount;
}

async function upsertCard(setId: number, lang: string, c: CardFull): Promise<number> {
  const j = (v: unknown) => (v == null ? null : JSON.stringify(v));
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO cards (set_id, lang, external_id, local_id, name, category, rarity,
        illustrator, image_base, dex_ids, hp, types, stage, evolve_from, suffix,
        regulation_mark, retreat, abilities, attacks, weaknesses, resistances,
        description, legal_standard, legal_expanded, source, external_source_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,'tcgdex',$25,$26)
     ON CONFLICT (set_id, local_id) DO UPDATE SET
        name=EXCLUDED.name, category=EXCLUDED.category, rarity=EXCLUDED.rarity,
        illustrator=EXCLUDED.illustrator, image_base=EXCLUDED.image_base, dex_ids=EXCLUDED.dex_ids,
        hp=EXCLUDED.hp, types=EXCLUDED.types, stage=EXCLUDED.stage, evolve_from=EXCLUDED.evolve_from,
        suffix=EXCLUDED.suffix, regulation_mark=EXCLUDED.regulation_mark, retreat=EXCLUDED.retreat,
        abilities=EXCLUDED.abilities, attacks=EXCLUDED.attacks, weaknesses=EXCLUDED.weaknesses,
        resistances=EXCLUDED.resistances, description=EXCLUDED.description,
        legal_standard=EXCLUDED.legal_standard, legal_expanded=EXCLUDED.legal_expanded,
        updated_at=EXCLUDED.updated_at
     RETURNING id`,
    [
      setId, lang, c.id, c.localId, c.name, c.category, c.rarity ?? null,
      c.illustrator ?? null, c.image ?? null, c.dexId ?? null, c.hp ?? null,
      c.types ?? null, c.stage ?? null, c.evolveFrom ?? null, c.suffix ?? null,
      c.regulationMark ?? null, c.retreat ?? null,
      j(c.abilities), j(c.attacks), j(c.weaknesses), j(c.resistances),
      c.description ?? null, c.legal?.standard ?? null, c.legal?.expanded ?? null,
      c.id, c.updated ?? null,
    ],
  );
  return rows[0].id;
}

async function upsertVariants(cardId: number, c: CardFull) {
  const detailedId = new Map<string, string | undefined>();
  for (const d of c.variants_detailed ?? []) detailedId.set(d.type, d.variantId);

  // variants 불리언에서 true인 것만 행 생성
  for (const [type, on] of Object.entries(c.variants ?? {})) {
    if (!on) continue;
    await pool.query(
      `INSERT INTO card_variants (card_id, variant_type, tcgdex_variant_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (card_id, variant_type) DO UPDATE SET tcgdex_variant_id=EXCLUDED.tcgdex_variant_id`,
      [cardId, type, detailedId.get(type) ?? null],
    );
  }
  // 어떤 variant도 표시되지 않은 카드는 최소 'normal' 하나 보장
  if (!Object.values(c.variants ?? {}).some(Boolean)) {
    await pool.query(
      `INSERT INTO card_variants (card_id, variant_type) VALUES ($1,'normal')
       ON CONFLICT (card_id, variant_type) DO NOTHING`,
      [cardId],
    );
  }
}

async function main() {
  console.log(`적재 시작: lang=${LANG} ${ONLY_SET ? `set=${ONLY_SET}` : `limit=${LIMIT || "전체"}`}`);
  const sets = await getSets(LANG);
  let targets = sets;
  if (ONLY_SET) targets = sets.filter((s) => s.id === ONLY_SET);
  else if (LIMIT > 0) targets = sets.slice(0, LIMIT);

  let total = 0;
  for (const s of targets) {
    process.stdout.write(`▶ [${LANG}] ${s.id} ${s.name} ... `);
    const n = await upsertSet(LANG, s.id);
    total += n;
    console.log(`${n} cards`);
  }
  console.log(`\n✅ 완료: 세트 ${targets.length}개 / 카드 ${total}장`);
  await pool.end();
}

main().catch((err) => {
  console.error("\n❌ 적재 실패:", err.message);
  process.exit(1);
});
