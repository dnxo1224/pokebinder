// TCGdex 적재: series → sets → cards → card_variants 순으로 upsert.
// 카드는 full detail을 받아 §4 스키마 전 컬럼을 채운다(category/rarity/dex_ids/variants 등).
//
// 사용법:
//   npm run ingest -- --lang en --limit 3            # en 세트 3개만 (기본값)
//   npm run ingest -- --lang ja --set SV3             # ja의 특정 세트 하나
//   npm run ingest -- --lang en --limit 0             # en 전체
//   npm run ingest -- --lang en --limit 0 --concurrency 12
//   npm run ingest -- --lang en --limit 0 --force     # 이미 있는 카드도 다시 받기
//
// 대량 적재(전체 언어) 대응:
//   · 카드 요청은 --concurrency 개를 동시에 돌린다 (기본 10)
//   · 이미 DB에 있는 카드는 건너뛴다 → 중간에 끊겨도 재실행하면 이어서 진행됨
//   · 카드 하나가 실패해도 전체를 죽이지 않고 계속 진행, 끝에 실패 목록을 보여준다
import "dotenv/config";
import { Pool } from "pg";
import { getSets, getSet, getCard, type CardFull } from "../lib/tcgdex";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const LANG = arg("lang", "en")!;
const LIMIT = Number(arg("limit", "3"));
const ONLY_SET = arg("set"); // 특정 external_id만
const MAX_CARDS = Number(arg("maxcards", "0")); // 세트당 카드 수 상한(0=무제한). 데모/속도용
const CONCURRENCY = Math.max(1, Number(arg("concurrency", "10")));
const FORCE = flag("force"); // 이미 있는 카드도 다시 받는다
// 특정 카테고리만 골라 다시 받는다 (예: --refetch Trainer,Energy)
// 새 컬럼을 추가한 뒤 전체를 다시 받지 않고 해당 카드만 채울 때 쓴다.
const REFETCH = arg("refetch");
const REFETCH_CATS = REFETCH
  ? new Set(REFETCH.split(",").map((s) => s.trim()).filter(Boolean))
  : null;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: CONCURRENCY + 2 });

/** 동시에 limit개까지만 fn을 돌리는 아주 단순한 워커 풀. */
async function pMap<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

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

async function upsertSetRow(lang: string, s: Awaited<ReturnType<typeof getSet>>): Promise<number> {
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
  return rows[0].id;
}

async function upsertCard(setId: number, lang: string, c: CardFull): Promise<number> {
  const j = (v: unknown) => (v == null ? null : JSON.stringify(v));
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO cards (set_id, lang, external_id, local_id, name, category, rarity,
        illustrator, image_base, dex_ids, hp, types, stage, evolve_from, suffix,
        regulation_mark, retreat, abilities, attacks, weaknesses, resistances,
        description, legal_standard, legal_expanded, source, external_source_id, updated_at,
        trainer_type, energy_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,'tcgdex',$25,$26,$27,$28)
     ON CONFLICT (set_id, local_id) DO UPDATE SET
        name=EXCLUDED.name, category=EXCLUDED.category, rarity=EXCLUDED.rarity,
        illustrator=EXCLUDED.illustrator, image_base=EXCLUDED.image_base, dex_ids=EXCLUDED.dex_ids,
        hp=EXCLUDED.hp, types=EXCLUDED.types, stage=EXCLUDED.stage, evolve_from=EXCLUDED.evolve_from,
        suffix=EXCLUDED.suffix, regulation_mark=EXCLUDED.regulation_mark, retreat=EXCLUDED.retreat,
        abilities=EXCLUDED.abilities, attacks=EXCLUDED.attacks, weaknesses=EXCLUDED.weaknesses,
        resistances=EXCLUDED.resistances, description=EXCLUDED.description,
        legal_standard=EXCLUDED.legal_standard, legal_expanded=EXCLUDED.legal_expanded,
        updated_at=EXCLUDED.updated_at,
        trainer_type=EXCLUDED.trainer_type, energy_type=EXCLUDED.energy_type
     RETURNING id`,
    [
      setId, lang, c.id, c.localId, c.name, c.category, c.rarity ?? null,
      c.illustrator ?? null, c.image ?? null, c.dexId ?? null, c.hp ?? null,
      c.types ?? null, c.stage ?? null, c.evolveFrom ?? null, c.suffix ?? null,
      c.regulationMark ?? null, c.retreat ?? null,
      j(c.abilities), j(c.attacks), j(c.weaknesses), j(c.resistances),
      c.description ?? null, c.legal?.standard ?? null, c.legal?.expanded ?? null,
      c.id, c.updated ?? null,
      c.trainerType ?? null, c.energyType ?? null,
    ],
  );
  return rows[0].id;
}

async function upsertVariants(cardId: number, c: CardFull) {
  const detailedId = new Map<string, string | undefined>();
  for (const d of c.variants_detailed ?? []) detailedId.set(d.type, d.variantId);

  for (const [type, on] of Object.entries(c.variants ?? {})) {
    if (!on) continue;
    await pool.query(
      `INSERT INTO card_variants (card_id, variant_type, tcgdex_variant_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (card_id, variant_type) DO UPDATE SET tcgdex_variant_id=EXCLUDED.tcgdex_variant_id`,
      [cardId, type, detailedId.get(type) ?? null],
    );
  }
  if (!Object.values(c.variants ?? {}).some(Boolean)) {
    await pool.query(
      `INSERT INTO card_variants (card_id, variant_type) VALUES ($1,'normal')
       ON CONFLICT (card_id, variant_type) DO NOTHING`,
      [cardId],
    );
  }
}

interface QueueItem {
  setId: number;
  setExtId: string;
  localId: string;
  cardId: string; // TCGdex 카드 id (getCard 인자)
}

function fmtEta(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m${String(s % 60).padStart(2, "0")}s`;
}

async function main() {
  console.log(
    `적재 시작: lang=${LANG} ${ONLY_SET ? `set=${ONLY_SET}` : `limit=${LIMIT || "전체"}`} concurrency=${CONCURRENCY}${FORCE ? " force" : ""}`,
  );

  const sets = await getSets(LANG);
  let targets = sets;
  if (ONLY_SET) targets = sets.filter((s) => s.id === ONLY_SET);
  else if (LIMIT > 0) targets = sets.slice(0, LIMIT);

  // 이미 적재된 카드는 (external_id, local_id) 쌍으로 한 번에 조회해 건너뛴다.
  // 크래시 후 재실행해도 처음부터 다시 받지 않도록 하는 핵심 장치.
  const already = new Set<string>();
  // --refetch 대상 카드의 키. 카테고리는 DB에만 있고 세트 목록(brief)에는 없어서
  // 여기서 미리 만들어 둔다.
  const refetchKeys = new Set<string>();
  if (!FORCE) {
    const { rows } = await pool.query<{ set_ext: string; local_id: string; category: string }>(
      `SELECT s.external_id AS set_ext, c.local_id, c.category
         FROM cards c JOIN sets s ON s.id = c.set_id
        WHERE c.lang = $1`,
      [LANG],
    );
    for (const r of rows) {
      const key = `${r.set_ext}|${r.local_id}`;
      if (REFETCH_CATS?.has(r.category)) {
        refetchKeys.add(key); // 다시 받을 대상이므로 건너뛰기 목록에 넣지 않는다
      } else {
        already.add(key);
      }
    }
    if (REFETCH_CATS) {
      console.log(`↻ ${[...REFETCH_CATS].join("/")} ${refetchKeys.size}장만 다시 받습니다`);
    } else if (already.size > 0) {
      console.log(`↺ 이미 적재된 카드 ${already.size}장은 건너뜁니다 (--force 로 무시 가능)`);
    }
  }

  // 1단계: 세트 메타 + 카드 목록 확보. 세트 요청은 적으므로 순차로 충분하다.
  // 세트 하나가 실패해도(예: 이상한 id) 전체를 죽이지 않고 다음 세트로 넘어간다 —
  // 안 하면 카드 하나 실패는 버티면서 세트 하나 실패로 나머지 수백 세트가 통째로 날아간다.
  const queue: QueueItem[] = [];
  const failedSets: { setExtId: string; error: string }[] = [];
  for (const s of targets) {
    try {
      const detail = await getSet(LANG, s.id);
      const setId = await upsertSetRow(LANG, detail);
      const briefs = MAX_CARDS > 0 ? detail.cards.slice(0, MAX_CARDS) : detail.cards;
      let queued = 0;
      for (const b of briefs) {
        const key = `${s.id}|${b.localId}`;
        if (!FORCE && already.has(key)) continue;
        // --refetch 가 걸리면 그 카테고리에 속한 '기존' 카드만 대상으로 삼는다.
        // (신규 카드는 카테고리를 알 수 없으니 이 모드에서는 건드리지 않는다)
        if (REFETCH_CATS && !refetchKeys.has(key)) continue;
        queue.push({ setId, setExtId: s.id, localId: b.localId, cardId: b.id });
        queued++;
      }
      console.log(`▶ [${LANG}] ${s.id} ${detail.name} ... ${queued}/${briefs.length}장 대기열`);
    } catch (e) {
      failedSets.push({ setExtId: s.id, error: (e as Error).message });
      console.log(`⚠ [${LANG}] ${s.id} 세트 조회 실패, 건너뜀: ${(e as Error).message}`);
    }
  }

  if (queue.length === 0) {
    console.log("\n✅ 새로 받을 카드가 없습니다 (이미 전부 적재됨).");
    if (failedSets.length > 0) {
      console.log(`⚠ 세트 조회 실패 ${failedSets.length}건 (다시 실행하면 재시도됩니다):`);
      for (const f of failedSets) console.log(`   ${f.setExtId}: ${f.error}`);
    }
    await pool.end();
    return;
  }

  // 2단계: 전체 세트를 합친 카드 대기열을 동시 처리한다.
  console.log(`\n▶ 카드 ${queue.length}장 적재 시작 (동시 ${CONCURRENCY}개)`);
  const t0 = Date.now();
  let done = 0;
  const failed: { setExtId: string; localId: string; error: string }[] = [];

  await pMap(queue, CONCURRENCY, async (item) => {
    try {
      const card = await getCard(LANG, item.cardId);
      const cardId = await upsertCard(item.setId, LANG, card);
      await upsertVariants(cardId, card);
    } catch (e) {
      failed.push({ setExtId: item.setExtId, localId: item.localId, error: (e as Error).message });
    } finally {
      done++;
      if (done % 100 === 0 || done === queue.length) {
        const elapsed = Date.now() - t0;
        const rate = done / (elapsed / 1000); // 장/초
        const remain = queue.length - done;
        const eta = rate > 0 ? fmtEta((remain / rate) * 1000) : "?";
        console.log(
          `  ${done}/${queue.length} (${rate.toFixed(1)}장/초, 남은시간 ${eta}, 실패 ${failed.length})`,
        );
      }
    }
  });

  console.log(
    `\n✅ 완료: 세트 ${targets.length - failedSets.length}/${targets.length}개 / 신규 카드 ${queue.length - failed.length}장`,
  );
  if (failedSets.length > 0) {
    console.log(`⚠ 세트 조회 실패 ${failedSets.length}건 (다시 실행하면 이것만 재시도됩니다):`);
    for (const f of failedSets) console.log(`   ${f.setExtId}: ${f.error}`);
  }
  if (failed.length > 0) {
    console.log(`⚠ 카드 적재 실패 ${failed.length}건 (다시 실행하면 이것만 재시도됩니다):`);
    for (const f of failed.slice(0, 20)) console.log(`   ${f.setExtId}-${f.localId}: ${f.error}`);
    if (failed.length > 20) console.log(`   … 외 ${failed.length - 20}건`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("\n❌ 적재 실패:", err.message);
  process.exit(1);
});
