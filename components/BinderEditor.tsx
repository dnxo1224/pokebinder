"use client";
// 개별 바인더 (ADR-0001 Phase 4·5)
//
// 읽기 모드가 기본 — 펼침면으로 배치를 감상한다. 이 앱의 존재 이유가
// "실물을 채우기 전에 어떤 배치가 예쁜지 미리 보기"라 제작 중에도 이 시야를 잃지 않는다.
// 사이드바를 열면 편집 모드가 되고, 사이드바에서 카드를 검색해 칸으로 끌어다 놓는다.
//
// 실물 바인더처럼 1페이지는 오른쪽 단면으로 시작하고, 이후 (2,3) (4,5) 로 묶인다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon, TrashIcon } from "./Icons";

// 카드 원본 비율
const CARD_W = 245, CARD_H = 337;
// 스프레드 구성 요소의 고정 여백(px) — globals.css 의 .spread* 규칙과 반드시 일치시킬 것
const SLOT_GAP = 4, PAGE_PAD = 8, RINGS_W = 12, MID_GAP = 8;
const MAX_PAGES = 60;
/** 페이지 번호를 10개씩 끊어 보여준다 */
const PAGE_BLOCK = 10;
const UNDO_MS = 6000;

export interface PlacedCard {
  position: number;
  cardId: number;
  name: string;
  localId: string;
  rarity: string | null;
  imageBase: string | null;
}
export interface BinderData {
  id: number;
  name: string;
  rows: number;
  cols: number;
  pageCount: number;
  coverSetId: number | null;
  coverLogo: string | null;
  cards: PlacedCard[];
}
interface SearchCard {
  id: number;
  name: string;
  localId: string;
  imageBase: string | null;
  lang: string;
  setName: string;
  setCode: string;
  favorited: boolean;
}

type Drag =
  | { kind: "card"; cardId: number; name: string }
  | { kind: "slot"; position: number }
  | null;

const SIZES = [1, 2, 3, 4];
const LANG_CHIPS = [
  { v: "", label: "전 언어" },
  { v: "en", label: "EN" },
  { v: "ja", label: "JP" },
];

/** 화면 폭 단계. 편집은 데스크톱 전용이다 — 터치에서는 HTML5 드래그가 동작하지 않는다. */
function useWidthTier() {
  const [tier, setTier] = useState<"wide" | "narrow" | "mobile">("wide");
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1200px)");
    const desktop = window.matchMedia("(min-width: 768px)");
    const sync = () => setTier(wide.matches ? "wide" : desktop.matches ? "narrow" : "mobile");
    sync();
    wide.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    return () => {
      wide.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, []);
  return tier;
}

export default function BinderEditor({
  binder,
  coverOptions,
  defaultCover,
}: {
  binder: BinderData;
  coverOptions: { id: number; name: string; logo: string }[];
  defaultCover: string | null;
}) {
  const router = useRouter();
  const tier = useWidthTier();

  const [editing, setEditing] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState(binder.name);
  const [coverOpen, setCoverOpen] = useState(false);

  // 드래그
  const [drag, setDrag] = useState<Drag>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [overRail, setOverRail] = useState(false);

  // 되돌리기 — 빼기는 되돌릴 수 없는 동작이라 짧게 기회를 준다
  const [undo, setUndo] = useState<{ cardId: number; position: number } | null>(null);

  // 사이드바 검색
  const [q, setQ] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [langFilter, setLangFilter] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [results, setResults] = useState<SearchCard[] | null>(null);
  const [searching, setSearching] = useState(false);

  // 모바일에서는 편집에 들어갈 수 없다
  useEffect(() => {
    if (tier === "mobile" && editing) setEditing(false);
  }, [tier, editing]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo]);

  const perPage = binder.rows * binder.cols;
  const cap = perPage * binder.pageCount;
  const byPosition = new Map(binder.cards.map((c) => [c.position, c]));
  const hidden = binder.cards.filter((c) => c.position >= cap).length;

  const page = Math.min(pageIndex, Math.max(0, binder.pageCount - 1));
  // 1페이지는 오른쪽 단면(표지 안쪽), 이후 (2,3) (4,5) …
  const spreadStart = page === 0 ? 0 : page - ((page - 1) % 2);
  const leftPage = spreadStart === 0 ? null : spreadStart;
  const rightPage =
    spreadStart === 0 ? 0 : spreadStart + 1 < binder.pageCount ? spreadStart + 1 : null;
  // 편집 모드도 양면이 기본. 좁아지면 단면으로 떨어진다.
  const twoUp = !editing || tier === "wide";

  useEffect(() => {
    if (pageIndex > page) setPageIndex(page);
  }, [pageIndex, page]);

  // ── 검색 ─────────────────────────────────────────────────────────
  const runSearch = useCallback(async () => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (setFilter) sp.set("set", setFilter);
    if (langFilter) sp.set("lang", langFilter);
    if (favOnly) sp.set("fav", "1");
    if (!q.trim() && !setFilter && !favOnly) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const d = await fetch(`/api/cards/search?${sp}`).then((r) => r.json());
      setResults(d.cards ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [q, setFilter, langFilter, favOnly]);

  // 필터(칩)는 즉시 반영, 검색어는 form submit 으로
  useEffect(() => {
    if (!editing) return;
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, setFilter, langFilter, favOnly]);

  // ── 서버 호출 ─────────────────────────────────────────────────────
  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error ?? "요청 실패");
        return null;
      }
      router.refresh();
      return d;
    } catch {
      setErr("요청 실패");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const slotAction = (body: unknown) => call(`/api/binders/${binder.id}/slots`, "POST", body);

  function endDrag() {
    setDrag(null);
    setOverSlot(null);
    setOverRail(false);
  }

  async function onDropSlot(position: number) {
    setOverSlot(null);
    if (!drag) return;
    if (drag.kind === "card") {
      await slotAction({ action: "place", cardId: drag.cardId, position });
    } else if (drag.position !== position) {
      await slotAction({ action: "move", from: drag.position, to: position });
    }
    endDrag();
  }

  async function onDropRail() {
    setOverRail(false);
    if (drag?.kind === "slot") {
      const d = await slotAction({ action: "remove", position: drag.position });
      if (d?.removedCardId) setUndo({ cardId: d.removedCardId, position: drag.position });
    }
    endDrag();
  }

  async function doUndo() {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    await slotAction({ action: "place", cardId: u.cardId, position: u.position });
  }

  // ── 페이지 추가/삭제 ──────────────────────────────────────────────
  async function addPage() {
    if (binder.pageCount >= MAX_PAGES) return;
    if (await call(`/api/binders/${binder.id}/pages`, "POST", { afterPage: page })) {
      setPageIndex(page + 1);
    }
  }
  async function removePage() {
    if (binder.pageCount <= 1) return;
    const onPage = binder.cards.filter(
      (c) => c.position >= page * perPage && c.position < (page + 1) * perPage,
    ).length;
    const msg = onPage > 0
      ? `${page + 1}페이지를 삭제할까요? 이 페이지의 카드 ${onPage}장도 함께 빠집니다.`
      : `${page + 1}페이지를 삭제할까요?`;
    if (!confirm(msg)) return;
    if (await call(`/api/binders/${binder.id}/pages`, "DELETE", { page })) {
      setPageIndex(Math.max(0, page - 1));
    }
  }

  // ── 스프레드가 항상 한 화면에 들어가도록 카드 폭을 직접 계산 ──────
  const fitRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(0);

  useLayoutEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const r = binder.rows, c = binder.cols;
    const pages = twoUp ? 2 : 1;

    const measure = () => {
      // clientWidth/Height 는 자기 패딩을 포함한다. 스프레드가 쓸 수 있는 건
      // content box 이므로 패딩을 빼야 한다. (안 빼면 그만큼 넘쳐서 잘린다)
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const availW = el.clientWidth - padX;
      const availH = el.clientHeight - padY;
      const hOver = pages === 2
        ? 4 * PAGE_PAD + 2 * (c - 1) * SLOT_GAP + RINGS_W + 2 * MID_GAP
        : 2 * PAGE_PAD + (c - 1) * SLOT_GAP;
      const vOver = 2 * PAGE_PAD + (r - 1) * SLOT_GAP;
      const byWidth = (availW - hOver) / (c * pages);
      const byHeight = ((availH - vOver) / r) * (CARD_W / CARD_H);
      setCardW(Math.max(24, Math.floor(Math.min(byWidth, byHeight))));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [binder.rows, binder.cols, twoUp]);

  const cardH = Math.round((cardW * CARD_H) / CARD_W);
  const pageW = binder.cols * cardW + (binder.cols - 1) * SLOT_GAP + 2 * PAGE_PAD;
  const pageH = binder.rows * cardH + (binder.rows - 1) * SLOT_GAP + 2 * PAGE_PAD;

  function renderVoid(key: string) {
    return <div className="spread-void" key={key} style={{ width: pageW, height: pageH }} />;
  }

  function renderPage(from: number) {
    return (
      <div
        className="spread-page"
        style={{
          gridTemplateColumns: `repeat(${binder.cols}, ${cardW}px)`,
          gridAutoRows: `${cardH}px`,
        }}
      >
        {Array.from({ length: perPage }, (_, i) => {
          const position = from + i;
          const c = byPosition.get(position) ?? null;
          const isOver = overSlot === position;
          return (
            <div
              key={position}
              className={`slot${c ? " filled" : ""}${isOver ? " over" : ""}`}
              draggable={editing && !!c}
              onDragStart={editing && c ? (e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", `slot:${position}`);
                setDrag({ kind: "slot", position });
              } : undefined}
              onDragEnd={endDrag}
              onDragOver={editing ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverSlot(position);
              } : undefined}
              onDragLeave={editing ? () => setOverSlot((p) => (p === position ? null : p)) : undefined}
              onDrop={editing ? (e) => { e.preventDefault(); void onDropSlot(position); } : undefined}
            >
              {c ? (
                c.imageBase ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${c.imageBase}/low.webp`} alt={c.name} loading="lazy" draggable={false} />
                ) : (
                  <span className="slot-noimg">{c.name}</span>
                )
              ) : (
                <span className="slot-empty">{position + 1}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // 페이지 번호는 10개씩 끊는다
  const blockStart = Math.floor(page / PAGE_BLOCK) * PAGE_BLOCK;
  const blockEnd = Math.min(blockStart + PAGE_BLOCK, binder.pageCount);

  return (
    <div className="binder-page">
      {/* 툴바 */}
      <div className="binder-toolbar">
        <Link href="/binders" className="back-link">← 바인더 목록</Link>

        {renaming ? (
          <div className="binder-actions">
            <input
              className="text-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={async () => {
                if (await call(`/api/binders/${binder.id}`, "PATCH", { name: editName }))
                  setRenaming(false);
              }}
            >
              저장
            </button>
            <button className="btn btn-sm" onClick={() => { setRenaming(false); setEditName(binder.name); }}>
              취소
            </button>
          </div>
        ) : (
          <>
            <span className="binder-title">{binder.name}</span>
            <div className="binder-actions">
              <span className="binder-meta">
                {binder.rows}×{binder.cols} · {binder.pageCount}p ·{" "}
                {Math.min(binder.cards.length, cap)}/{cap}
                {hidden > 0 ? ` · ${hidden}장 숨김` : ""}
              </span>

              {!editing && (
                <>
                  <select
                    className="select-dropdown"
                    value={binder.rows}
                    disabled={busy}
                    onChange={(e) => call(`/api/binders/${binder.id}`, "PATCH", { rows: Number(e.target.value) })}
                  >
                    {SIZES.map((n) => <option key={n} value={n}>{n}행</option>)}
                  </select>
                  <select
                    className="select-dropdown"
                    value={binder.cols}
                    disabled={busy}
                    onChange={(e) => call(`/api/binders/${binder.id}`, "PATCH", { cols: Number(e.target.value) })}
                  >
                    {SIZES.map((n) => <option key={n} value={n}>{n}열</option>)}
                  </select>
                  <button className="btn btn-sm" onClick={() => setCoverOpen(true)}>커버</button>
                  <button className="btn btn-sm" onClick={() => { setRenaming(true); setEditName(binder.name); }}>
                    이름변경
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={busy}
                    onClick={async () => {
                      if (confirm(`'${binder.name}' 바인더를 삭제할까요?`)) {
                        if (await call(`/api/binders/${binder.id}`, "DELETE")) router.push("/binders");
                      }
                    }}
                  >
                    삭제
                  </button>
                </>
              )}

              {tier === "mobile" ? (
                <span className="binder-meta">편집은 넓은 화면에서</span>
              ) : (
                <button
                  className={`btn btn-sm${editing ? " btn-primary" : ""}`}
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? "수정 완료" : "수정하기"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {err && <div className="form-error">{err}</div>}

      {/* 무대: 검색 사이드바 + 바인더 */}
      <div className={`binder-stage${editing ? " editing" : ""}`}>
        <aside
          className="storage-rail"
          aria-hidden={!editing}
          onDragOver={(e) => {
            if (drag?.kind !== "slot") return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOverRail(true);
          }}
          onDragLeave={() => setOverRail(false)}
          onDrop={(e) => { e.preventDefault(); void onDropRail(); }}
        >
          <div className="rail-inner">
            <form className="rail-search" onSubmit={(e) => { e.preventDefault(); void runSearch(); }}>
              <span className="ico"><SearchIcon /></span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="카드 이름 검색"
                aria-label="카드 검색"
              />
            </form>

            <div className="rail-filters">
              <button
                type="button"
                className={`chip${favOnly ? " on" : ""}`}
                onClick={() => setFavOnly((v) => !v)}
              >
                ★ 즐겨찾기
              </button>
              {LANG_CHIPS.map((l) => (
                <button
                  key={l.v}
                  type="button"
                  className={`chip${langFilter === l.v ? " on" : ""}`}
                  onClick={() => setLangFilter(l.v)}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <div className="rail-filters">
              <input
                className="text-input rail-set"
                value={setFilter}
                onChange={(e) => setSetFilter(e.target.value)}
                placeholder="세트 코드 (예: base1)"
                aria-label="세트 코드"
              />
            </div>

            <ul className="rail-list">
              {searching ? (
                <li className="rail-note">찾는 중…</li>
              ) : results === null ? (
                <li className="rail-note">
                  이름을 검색하거나 즐겨찾기·세트로 걸러 보세요.
                </li>
              ) : results.length === 0 ? (
                <li className="rail-note">일치하는 카드가 없습니다.</li>
              ) : (
                results.map((c) => (
                  <li key={c.id}>
                    <div
                      className="rail-row"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "copy";
                        e.dataTransfer.setData("text/plain", `card:${c.id}`);
                        setDrag({ kind: "card", cardId: c.id, name: c.name });
                      }}
                      onDragEnd={endDrag}
                    >
                      <span className="rail-thumb">
                        {c.imageBase ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`${c.imageBase}/low.webp`} alt="" loading="lazy" draggable={false} />
                        ) : null}
                      </span>
                      <span className="rail-text">
                        <span className="rail-name">
                          {c.favorited && <span className="rail-fav">★</span>}
                          {c.name}
                        </span>
                        <span className="rail-set-name">
                          {c.setName} · {c.lang} · {c.localId}
                        </span>
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* 빼기 구역 — 칸에서 끌어온 카드를 여기 놓으면 빠진다 */}
          {drag?.kind === "slot" && (
            <div className={`rail-dropzone${overRail ? " over" : ""}`}>
              <TrashIcon size={40} />
              <span>여기에 놓으면 바인더에서 뺍니다</span>
            </div>
          )}
        </aside>

        <div className="spread-fit" ref={fitRef}>
          <div className="spread" style={{ visibility: cardW ? "visible" : "hidden" }}>
            {twoUp ? (
              <>
                {leftPage !== null ? renderPage(leftPage * perPage) : renderVoid("void-l")}
                <div className="spread-rings" />
                {rightPage !== null ? renderPage(rightPage * perPage) : renderVoid("void-r")}
              </>
            ) : (
              renderPage(page * perPage)
            )}

            {editing && (
              <div className="page-tools">
                <button
                  className="icon-btn"
                  title={binder.pageCount >= MAX_PAGES ? `페이지는 최대 ${MAX_PAGES}장까지입니다` : `${page + 2}페이지로 새 페이지 넣기`}
                  aria-label="페이지 추가"
                  disabled={busy || binder.pageCount >= MAX_PAGES}
                  onClick={addPage}
                >
                  <PlusIcon />
                </button>
                <button
                  className="icon-btn danger"
                  title={binder.pageCount <= 1 ? "마지막 페이지는 삭제할 수 없습니다" : `${page + 1}페이지 삭제`}
                  aria-label="페이지 삭제"
                  disabled={busy || binder.pageCount <= 1}
                  onClick={removePage}
                >
                  <TrashIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 페이지 번호 — 10개 단위 블록 */}
      {binder.pageCount > 1 && (
        <div className="page-switch">
          {blockStart > 0 && (
            <>
              <button className="page-num" onClick={() => setPageIndex(0)}>처음</button>
              <button
                className="page-num ellipsis"
                aria-label="이전 10페이지"
                onClick={() => setPageIndex(Math.max(0, blockStart - PAGE_BLOCK))}
              >
                …
              </button>
            </>
          )}
          {Array.from({ length: blockEnd - blockStart }, (_, i) => {
            const p = blockStart + i;
            const on = twoUp ? p === leftPage || p === rightPage : p === page;
            return (
              <button
                key={p}
                className={`page-num${on ? " on" : ""}`}
                aria-current={on ? "page" : undefined}
                onClick={() => setPageIndex(p)}
              >
                {p + 1}
              </button>
            );
          })}
          {blockEnd < binder.pageCount && (
            <>
              <button
                className="page-num ellipsis"
                aria-label="다음 10페이지"
                onClick={() => setPageIndex(Math.min(binder.pageCount - 1, blockEnd))}
              >
                …
              </button>
              <button className="page-num" onClick={() => setPageIndex(binder.pageCount - 1)}>끝</button>
            </>
          )}
        </div>
      )}

      {/* 빼기 되돌리기 */}
      {undo && (
        <div className="undo-toast">
          <span>카드를 뺐습니다.</span>
          <button className="btn btn-sm" onClick={doUndo} disabled={busy}>실행 취소</button>
        </div>
      )}

      {coverOpen && (
        <CoverPicker
          options={coverOptions}
          current={binder.coverSetId}
          defaultCover={defaultCover}
          onClose={() => setCoverOpen(false)}
          onPick={async (setId) => {
            await call(`/api/binders/${binder.id}`, "PATCH", { coverSetId: setId });
            setCoverOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** 커버 고르기 — 로고가 있는 세트만 나온다 (157개, 전부 EN) */
function CoverPicker({
  options, current, defaultCover, onClose, onPick,
}: {
  options: { id: number; name: string; logo: string }[];
  current: number | null;
  defaultCover: string | null;
  onClose: () => void;
  onPick: (setId: number | null) => void;
}) {
  const [q, setQ] = useState("");
  const shown = q.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()))
    : options;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="커버 고르기">
        <div className="modal-head">
          <span>바인더 커버</span>
          <button className="btn btn-sm" onClick={onClose}>닫기</button>
        </div>
        <div className="searchbar" style={{ margin: "0 16px" }}>
          <span className="ico"><SearchIcon /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="세트 이름으로 찾기" />
        </div>
        <div className="cover-grid">
          <button
            className={`cover-opt${current === null ? " on" : ""}`}
            onClick={() => onPick(null)}
          >
            {defaultCover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${defaultCover}.png`} alt="" loading="lazy" />
            )}
            <span>기본</span>
          </button>
          {shown.map((o) => (
            <button
              key={o.id}
              className={`cover-opt${current === o.id ? " on" : ""}`}
              onClick={() => onPick(o.id)}
              title={o.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${o.logo}.png`} alt="" loading="lazy" />
              <span>{o.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
