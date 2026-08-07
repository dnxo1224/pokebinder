import Link from "next/link";
import { query } from "@/lib/db";
import CardTile from "@/components/CardTile";
import DexControls from "@/components/dex/DexControls";
import {
  CATEGORIES,
  DEFAULT_LANG,
  isCategory,
  isLang,
  type CategoryId,
  type LangValue,
} from "@/lib/dex";

export const dynamic = "force-dynamic";

const DEMO_USER_ID = 1; // TODO: auth

/** 대분류 타일에 붙일 개수. 언어 필터를 반영한다. */
async function loadCounts(lang: LangValue): Promise<Record<CategoryId, number | null>> {
  const all = lang === "global";
  try {
    const [row] = await query<Record<string, string>>(
      `SELECT
         (SELECT count(*) FROM favorites WHERE user_id = $2)                       AS favorites,
         (SELECT count(*) FROM sets  WHERE ($1 OR lang = $3))                      AS set,
         (SELECT count(DISTINCT d)
            FROM cards c, unnest(COALESCE(c.manual_dex_ids, c.dex_ids)) AS d
           WHERE ($1 OR c.lang = $3))                                              AS dex,
         (SELECT count(DISTINCT illustrator) FROM cards
           WHERE illustrator IS NOT NULL AND ($1 OR lang = $3))                    AS artist,
         (SELECT count(*) FROM cards WHERE category = 'Trainer' AND ($1 OR lang = $3)) AS trainer,
         (SELECT count(*) FROM cards WHERE category = 'Energy'  AND ($1 OR lang = $3)) AS energy,
         (SELECT count(*) FROM cards
           WHERE category = 'Pokemon' AND ($1 OR lang = $3)
             AND array_length(COALESCE(manual_dex_ids, dex_ids), 1) IS NULL)       AS etc`,
      [all, DEMO_USER_ID, lang],
    );
    return {
      favorites: Number(row.favorites),
      set: Number(row.set),
      dex: Number(row.dex),
      artist: Number(row.artist),
      trainer: Number(row.trainer),
      energy: Number(row.energy),
      etc: Number(row.etc),
    };
  } catch (e) {
    console.error("dex counts failed:", (e as Error).message);
    return { favorites: null, set: null, dex: null, artist: null, trainer: null, energy: null, etc: null };
  }
}

interface CardRow {
  id: number;
  name: string;
  local_id: string;
  rarity: string | null;
  category: string;
  image_base: string | null;
  types: string[] | null;
}

/** 즐겨찾기 대분류. 언어 필터와 검색어를 함께 적용한다. */
async function loadFavorites(lang: LangValue, q: string): Promise<CardRow[]> {
  const all = lang === "global";
  const needle = q ? `%${q}%` : null;
  try {
    return await query<CardRow>(
      `SELECT c.id, c.name, c.local_id, c.rarity, c.category, c.image_base, c.types
         FROM favorites f
         JOIN cards c ON c.id = f.card_id
        WHERE f.user_id = $1
          AND ($2 OR c.lang = $3)
          AND ($4::text IS NULL OR c.name ILIKE $4 OR c.illustrator ILIKE $4)
        ORDER BY f.added_at DESC, f.id DESC`,
      [DEMO_USER_ID, all, lang, needle],
    );
  } catch (e) {
    console.error("favorites load failed:", (e as Error).message);
    return [];
  }
}

export default async function DexPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; cat?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const lang: LangValue = isLang(sp.lang) ? sp.lang : DEFAULT_LANG;
  const cat: CategoryId | null = isCategory(sp.cat) ? sp.cat : null;
  const q = (sp.q ?? "").trim();

  const active = cat ? CATEGORIES.find((c) => c.id === cat)! : null;

  return (
    <>
      <div className="section-head">
        <h2>도감</h2>
        {active && <span className="count">{active.label}</span>}
        {active && (
          <>
            <span className="spacer" />
            <Link href={`/dex${lang === DEFAULT_LANG ? "" : `?lang=${lang}`}`} className="back-link">
              ← 분류 다시 고르기
            </Link>
          </>
        )}
      </div>

      <DexControls lang={lang} cat={cat} q={q} />

      {cat === null ? (
        <CategoryChooser lang={lang} />
      ) : cat === "favorites" ? (
        <FavoritesView lang={lang} q={q} />
      ) : (
        <NotReady label={active!.label} />
      )}
    </>
  );
}

async function CategoryChooser({ lang }: { lang: LangValue }) {
  const counts = await loadCounts(lang);
  const langQ = lang === DEFAULT_LANG ? "" : `&lang=${lang}`;

  return (
    <>
      <p className="dex-hint">
        무엇으로 찾을지 먼저 고르세요. 고른 분류 안에서 검색합니다.
      </p>
      <div className="cat-grid">
        {CATEGORIES.map((c) => {
          const n = counts[c.id];
          const href = c.ready ? `/dex?cat=${c.id}${langQ}` : c.interimHref;
          const body = (
            <>
              <span className="cat-name">
                {c.label}
                {c.temporary && <span className="cat-tag">임시</span>}
                {!c.ready && c.interimHref && <span className="cat-tag">기존 화면</span>}
              </span>
              <span className="cat-desc">{c.desc}</span>
              <span className="cat-foot">
                {n === null ? "—" : <span className="n-md">{n.toLocaleString()}</span>}
                {!c.ready && !c.interimHref && <span className="cat-soon">준비 중</span>}
              </span>
            </>
          );
          return href ? (
            <Link key={c.id} href={href} className="cat-tile">
              {body}
            </Link>
          ) : (
            <div key={c.id} className="cat-tile is-disabled" aria-disabled>
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}

async function FavoritesView({ lang, q }: { lang: LangValue; q: string }) {
  const cards = await loadFavorites(lang, q);

  if (cards.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 24 }}>
        {q ? (
          <>
            <b>{q}</b> 와(과) 일치하는 찜한 카드가 없습니다.
          </>
        ) : (
          <>
            아직 찜한 카드가 없습니다.
            <br />
            카드의 <b>즐겨찾기</b> 버튼을 누르면 여기에 모입니다.
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="section-head" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>카드</h2>
        <span className="count">{cards.length}장</span>
      </div>
      <div className="card-grid">
        {cards.map((c) => (
          <CardTile key={c.id} card={c} favorited />
        ))}
      </div>
    </>
  );
}

function NotReady({ label }: { label: string }) {
  return (
    <div className="empty-state" style={{ marginTop: 24 }}>
      <b>{label}</b> 분류는 아직 준비 중입니다.
    </div>
  );
}
