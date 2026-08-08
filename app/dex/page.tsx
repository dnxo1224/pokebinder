import Link from "next/link";
import { query } from "@/lib/db";
import CardTile from "@/components/CardTile";
import DexControls from "@/components/dex/DexControls";
import { ImageIcon } from "@/components/Icons";
import {
  CATEGORIES,
  DEFAULT_LANG,
  dexHref,
  isCategory,
  isLang,
  ENERGY_LABEL,
  ENERGY_TYPES,
  FALLBACK_TYPE,
  PAGE_SIZE,
  PICK_KEY,
  TRAINER_LABEL,
  TRAINER_TYPES,
  type CategoryId,
  type LangValue,
} from "@/lib/dex";
import {
  cardsByArtist,
  cardsInSet,
  cardsOfEnergyType,
  cardsOfSpecies,
  cardsOfTrainerType,
  cardsWithoutDex,
  favoritedIds,
  listArtists,
  listEnergyTypes,
  listSets,
  listSpecies,
  listTrainerTypes,
  setDetail,
  speciesName,
  type CardRow,
} from "@/lib/dexQueries";

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

async function loadFavorites(
  lang: LangValue,
  q: string,
  page: number,
): Promise<{ cards: CardRow[]; total: number }> {
  const all = lang === "global";
  const needle = q ? `%${q}%` : null;
  try {
    const rows = await query<CardRow & { total: string }>(
      `SELECT c.id, c.name, c.local_id, c.rarity, c.category, c.image_base, c.types,
              count(*) OVER() AS total
         FROM favorites f
         JOIN cards c ON c.id = f.card_id
        WHERE f.user_id = $1
          AND ($2 OR c.lang = $3)
          AND ($4::text IS NULL OR c.name ILIKE $4 OR c.illustrator ILIKE $4)
        ORDER BY f.added_at DESC, f.id DESC
        LIMIT $5 OFFSET $6`,
      [DEMO_USER_ID, all, lang, needle, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );
    return {
      cards: rows.map(({ total: _t, ...c }) => c),
      total: rows.length > 0 ? Number(rows[0].total) : 0,
    };
  } catch (e) {
    console.error("favorites load failed:", (e as Error).message);
    return { cards: [], total: 0 };
  }
}

export default async function DexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const lang: LangValue = isLang(sp.lang) ? sp.lang : DEFAULT_LANG;
  const cat: CategoryId | null = isCategory(sp.cat) ? sp.cat : null;
  const q = (sp.q ?? "").trim();
  const pickKey = cat ? PICK_KEY[cat] : undefined;
  const pick = pickKey ? (sp[pickKey] ?? "").trim() || null : null;
  const page = Math.max(1, Number(sp.p) || 1);

  const active = cat ? CATEGORIES.find((c) => c.id === cat)! : null;
  const nav = { lang, cat, pick, q };

  return (
    <>
      <div className="section-head">
        <h2>도감</h2>
        {active && <span className="count">{active.label}</span>}
        {active && (
          <>
            <span className="spacer" />
            {/* 3단에 있으면 2단으로, 2단이면 분류 선택으로 */}
            <Link
              href={pick ? dexHref({ lang, cat }) : dexHref({ lang })}
              className="back-link"
            >
              {pick ? `← ${active.label} 목록` : "← 분류 다시 고르기"}
            </Link>
          </>
        )}
      </div>

      <DexControls lang={lang} cat={cat} q={q} pick={pick} />

      {cat === null ? (
        <CategoryChooser lang={lang} />
      ) : cat === "favorites" ? (
        <CardsView
          {...(await loadFavorites(lang, q, page))}
          q={q}
          page={page}
          nav={nav}
          emptyHint="카드의 즐겨찾기 버튼을 누르면 여기에 모입니다."
        />
      ) : cat === "set" ? (
        pick ? <SetCards code={pick} lang={lang} q={q} page={page} nav={nav} /> : <SetList lang={lang} q={q} />
      ) : cat === "dex" ? (
        pick ? <SpeciesCards dex={pick} lang={lang} q={q} page={page} nav={nav} /> : <SpeciesList lang={lang} q={q} />
      ) : cat === "artist" ? (
        pick ? <ArtistCards artist={pick} lang={lang} q={q} page={page} nav={nav} /> : <ArtistList lang={lang} q={q} />
      ) : cat === "trainer" ? (
        pick ? <TypeCards kind="trainer" type={pick} lang={lang} q={q} page={page} nav={nav} />
             : <TypeList kind="trainer" lang={lang} />
      ) : cat === "energy" ? (
        pick ? <TypeCards kind="energy" type={pick} lang={lang} q={q} page={page} nav={nav} />
             : <TypeList kind="energy" lang={lang} />
      ) : cat === "etc" ? (
        <EtcCards lang={lang} q={q} page={page} nav={nav} />
      ) : (
        <NotReady label={active!.label} />
      )}
    </>
  );
}

/* ── 1단: 대분류 선택 ─────────────────────────────────────────────── */

async function CategoryChooser({ lang }: { lang: LangValue }) {
  const counts = await loadCounts(lang);

  return (
    <>
      <p className="dex-hint">무엇으로 찾을지 먼저 고르세요. 고른 분류 안에서 검색합니다.</p>
      <div className="cat-grid">
        {CATEGORIES.map((c) => {
          const n = counts[c.id];
          const href = c.ready ? dexHref({ lang, cat: c.id }) : null;
          const body = (
            <>
              <span className="cat-name">
                {c.label}
                {c.temporary && <span className="cat-tag">임시</span>}
              </span>
              <span className="cat-desc">{c.desc}</span>
              <span className="cat-foot">
                {n === null ? "—" : <span className="n-md">{n.toLocaleString()}</span>}
                {!c.ready && <span className="cat-soon">준비 중</span>}
              </span>
            </>
          );
          return href ? (
            <Link key={c.id} href={href} className="cat-tile">{body}</Link>
          ) : (
            <div key={c.id} className="cat-tile is-disabled" aria-disabled>{body}</div>
          );
        })}
      </div>
    </>
  );
}

/* ── 2단: 묶음 목록 ───────────────────────────────────────────────── */

async function SetList({ lang, q }: { lang: LangValue; q: string }) {
  const sets = await listSets(lang, q);
  if (sets.length === 0) return <NoMatch q={q} what="세트" />;

  return (
    <>
      <ListHead n={sets.length} unit="개 세트" q={q} />
      <div className="set-grid">
        {sets.map((s) => (
          <Link
            key={`${s.lang}-${s.external_id}`}
            href={dexHref({ lang, cat: "set", pick: s.external_id })}
            className="set-card"
          >
            <div className="art">
              <span className="lang">{s.lang}</span>
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${s.logo_url}.png`} alt="" loading="lazy" />
              ) : (
                <span className="art-slot"><span className="box"><ImageIcon /></span>로고 없음</span>
              )}
            </div>
            <div className="body">
              <span className="name">{s.name}</span>
              <span className="sub">
                {s.external_id}
                {s.release_date ? ` · ${s.release_date}` : ""}
              </span>
              <div className="foot">
                <span>{s.card_count_total ?? s.ingested}장</span>
                <span className="go">→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

async function SpeciesList({ lang, q }: { lang: LangValue; q: string }) {
  const species = await listSpecies(lang, q);
  if (species.length === 0) return <NoMatch q={q} what="포켓몬" />;

  return (
    <>
      <ListHead n={species.length} unit="종" q={q} />
      <div className="species-grid">
        {species.map((s) => (
          <Link
            key={s.dex}
            href={dexHref({ lang, cat: "dex", pick: s.dex })}
            className="species-tile"
          >
            <span className="thumb">
              {s.image_base ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${s.image_base}/low.webp`} alt="" loading="lazy" />
              ) : (
                <span className="noimg"><ImageIcon size={16} /></span>
              )}
            </span>
            <span className="info">
              <span className="dexno n-sm">#{s.dex}</span>
              <span className="sname">{s.name}</span>
              <span className="cnt n-sm">{s.cards}장</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

async function ArtistList({ lang, q }: { lang: LangValue; q: string }) {
  const artists = await listArtists(lang, q);
  if (artists.length === 0) return <NoMatch q={q} what="아티스트" />;

  return (
    <>
      <ListHead n={artists.length} unit="명" q={q} />
      <div className="artist-grid">
        {artists.map((a) => (
          <Link
            key={a.illustrator}
            href={dexHref({ lang, cat: "artist", pick: a.illustrator })}
            className="artist-tile"
          >
            <span className="aname">{a.illustrator}</span>
            <span className="cnt n-sm">{a.cards.toLocaleString()}장</span>
          </Link>
        ))}
      </div>
    </>
  );
}

/** 트레이너·에너지의 하위 타입 목록. 개수순이 아니라 정해진 순서로 보여준다. */
async function TypeList({ kind, lang }: { kind: "trainer" | "energy"; lang: LangValue }) {
  const known = kind === "trainer" ? TRAINER_TYPES : ENERGY_TYPES;
  const label = kind === "trainer" ? TRAINER_LABEL : ENERGY_LABEL;
  const fallback = FALLBACK_TYPE[kind];

  const rows = kind === "trainer"
    ? await listTrainerTypes(known, lang)
    : await listEnergyTypes(known, lang);

  const byType = new Map(rows.map((r) => [r.type, r.cards]));
  const order = [...known, fallback];
  const shown = order.filter((t) => (byType.get(t) ?? 0) > 0);

  if (shown.length === 0) return <NoMatch q="" what="카드" />;

  return (
    <>
      <ListHead n={shown.length} unit="종류" q="" />
      <div className="cat-grid">
        {shown.map((t) => (
          <Link key={t} href={dexHref({ lang, cat: kind, pick: t })} className="cat-tile">
            <span className="cat-name">
              {label[t] ?? t}
              {t === fallback && <span className="cat-tag">구분 없음</span>}
            </span>
            <span className="cat-desc">
              {t === "classic"
                ? "2003년 이전 카드. 당시엔 서포트·아이템 구분이 없었습니다."
                : t === "other"
                  ? "타입 정보가 없는 카드입니다."
                  : ""}
            </span>
            <span className="cat-foot">
              <span className="n-md">{(byType.get(t) ?? 0).toLocaleString()}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

/* ── 3단: 카드 ────────────────────────────────────────────────────── */

/** 페이지 링크를 만들 때 필요한 현재 위치 */
interface Nav {
  lang: LangValue;
  cat: CategoryId | null;
  pick: string | null;
  q: string;
}

async function SetCards({
  code, lang, q, page, nav,
}: { code: string; lang: LangValue; q: string; page: number; nav: Nav }) {
  const [detail, res] = await Promise.all([
    setDetail(code, lang),
    cardsInSet(code, lang, q, page, PAGE_SIZE),
  ]);
  return (
    <>
      <PickHead
        title={detail?.name ?? code}
        sub={`${code}${detail?.release_date ? ` · ${detail.release_date}` : ""}`}
        logo={detail?.logo_url ?? null}
      />
      <CardsView {...res} q={q} page={page} nav={nav} />
    </>
  );
}

async function SpeciesCards({
  dex, lang, q, page, nav,
}: { dex: string; lang: LangValue; q: string; page: number; nav: Nav }) {
  const [name, res] = await Promise.all([
    speciesName(dex, lang),
    cardsOfSpecies(dex, lang, q, page, PAGE_SIZE),
  ]);
  return (
    <>
      <PickHead title={name ?? `#${dex}`} sub={`도감번호 #${dex}`} />
      <CardsView {...res} q={q} page={page} nav={nav} />
    </>
  );
}

async function ArtistCards({
  artist, lang, q, page, nav,
}: { artist: string; lang: LangValue; q: string; page: number; nav: Nav }) {
  const res = await cardsByArtist(artist, lang, q, page, PAGE_SIZE);
  return (
    <>
      <PickHead title={artist} sub="일러스트레이터" />
      <CardsView {...res} q={q} page={page} nav={nav} />
    </>
  );
}

async function TypeCards({
  kind, type, lang, q, page, nav,
}: { kind: "trainer" | "energy"; type: string; lang: LangValue; q: string; page: number; nav: Nav }) {
  const known = kind === "trainer" ? TRAINER_TYPES : ENERGY_TYPES;
  const label = kind === "trainer" ? TRAINER_LABEL : ENERGY_LABEL;
  const res = kind === "trainer"
    ? await cardsOfTrainerType(known, type, lang, q, page, PAGE_SIZE)
    : await cardsOfEnergyType(known, type, lang, q, page, PAGE_SIZE);

  return (
    <>
      <PickHead
        title={label[type] ?? type}
        sub={kind === "trainer" ? "트레이너" : "에너지"}
      />
      <CardsView {...res} q={q} page={page} nav={nav} />
    </>
  );
}

async function EtcCards({
  lang, q, page, nav,
}: { lang: LangValue; q: string; page: number; nav: Nav }) {
  const res = await cardsWithoutDex(lang, q, page, PAGE_SIZE);
  return (
    <>
      <p className="dex-hint">
        포켓몬 카드인데 도감번호가 비어 있는 카드입니다. 라벨링이 끝나면 이 분류는 사라집니다.
      </p>
      <CardsView
        {...res}
        q={q}
        page={page}
        nav={nav}
        emptyHint="분류되지 않은 카드가 없습니다."
      />
    </>
  );
}

/* ── 공통 ─────────────────────────────────────────────────────────── */

function ListHead({ n, unit, q }: { n: number; unit: string; q: string }) {
  return (
    <div className="section-head" style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 16 }}>{q ? `"${q}" 검색 결과` : "목록"}</h2>
      <span className="count">
        {n.toLocaleString()}
        {unit}
      </span>
    </div>
  );
}

function PickHead({ title, sub, logo }: { title: string; sub: string; logo?: string | null }) {
  return (
    <section className="detail-head" style={{ marginTop: 24 }}>
      <div className="sym">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${logo}.png`} alt="" />
        ) : (
          <span style={{ color: "var(--muted)" }}><ImageIcon size={22} /></span>
        )}
      </div>
      <div>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
    </section>
  );
}

async function CardsView({
  cards,
  total,
  q,
  page,
  nav,
  emptyHint,
}: {
  cards: CardRow[];
  total: number;
  q: string;
  page: number;
  nav: Nav;
  emptyHint?: string;
}) {
  if (cards.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 24 }}>
        {q ? (
          <>
            <b>{q}</b> 와(과) 일치하는 카드가 없습니다.
          </>
        ) : page > 1 ? (
          "이 쪽에는 카드가 없습니다."
        ) : (
          (emptyHint ?? "카드가 없습니다.")
        )}
      </div>
    );
  }

  const favs = await favoritedIds(DEMO_USER_ID, cards.map((c) => c.id));
  const pages = Math.ceil(total / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE + 1;

  return (
    <>
      <div className="section-head" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>카드</h2>
        <span className="count">
          {pages > 1
            ? `${from.toLocaleString()}–${(from + cards.length - 1).toLocaleString()} / ${total.toLocaleString()}장`
            : `${total.toLocaleString()}장`}
        </span>
      </div>
      <div className="card-grid">
        {cards.map((c) => (
          <CardTile key={c.id} card={c} favorited={favs.has(c.id)} />
        ))}
      </div>
      <Pager page={page} pages={pages} nav={nav} />
    </>
  );
}

/** 앞뒤 이동 + 현재 위치. 최대 20쪽 남짓이라 번호를 다 늘어놓지 않는다. */
function Pager({ page, pages, nav }: { page: number; pages: number; nav: Nav }) {
  if (pages <= 1) return null;
  const href = (p: number) => dexHref({ ...nav, page: p });
  return (
    <nav className="pager" aria-label="페이지">
      {page > 1 ? (
        <Link className="btn btn-sm" href={href(page - 1)}>← 이전</Link>
      ) : (
        <span className="btn btn-sm" aria-disabled>← 이전</span>
      )}
      <span className="pager-pos n-sm">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link className="btn btn-sm" href={href(page + 1)}>다음 →</Link>
      ) : (
        <span className="btn btn-sm" aria-disabled>다음 →</span>
      )}
    </nav>
  );
}

function NoMatch({ q, what }: { q: string; what: string }) {
  return (
    <div className="empty-state" style={{ marginTop: 24 }}>
      {q ? (
        <>
          <b>{q}</b> 와(과) 일치하는 {what}이(가) 없습니다.
        </>
      ) : (
        `${what} 데이터가 없습니다.`
      )}
    </div>
  );
}

function NotReady({ label }: { label: string }) {
  return (
    <div className="empty-state" style={{ marginTop: 24 }}>
      <b>{label}</b> 분류는 아직 준비 중입니다.
    </div>
  );
}
