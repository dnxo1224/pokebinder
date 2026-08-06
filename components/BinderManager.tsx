"use client";
// 바인더: 선택(탭) / 생성 / 이름변경 / 크기변경 / 삭제 + 편집 모드
//
// 기본 모드 — 펼침면(두 페이지)을 한 화면에 보여준다. (읽기 전용)
// 편집 모드 — 좌측에 '카드 보관함' 사이드바가 열리고, 바인더는 한 면만 보여준다.
//             보관함 → 칸, 칸 → 칸, 칸 → 보관함 을 전부 드래그로 처리하고,
//             바인더 우측 상단 버튼으로 페이지를 넣고 뺀다.
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PlusIcon, TrashIcon } from "./Icons";

// 카드 원본 비율
const CARD_W = 245, CARD_H = 337;
// 스프레드 구성 요소의 고정 여백(px) — globals.css 의 .spread* 규칙과 반드시 일치시킬 것
const SLOT_GAP = 4, PAGE_PAD = 8, RINGS_W = 12, MID_GAP = 8;
// 보관함 호버 미리보기 높이(px) — globals.css 의 .storage-preview 폭 208px × 카드 비율
const PREVIEW_H = 286;

export interface BinderCard {
  position: number;      // 슬롯 번호(0-based)
  name: string;
  localId: string;
  rarity: string | null;
  imageBase: string | null;
}
export interface BinderData {
  id: number;
  name: string;
  grid_rows: number;
  grid_cols: number;
  page_count: number;
  cards: BinderCard[];
}
export interface StorageCard {
  id: number;            // card_storage.id
  name: string;
  localId: string;
  rarity: string | null;
  category: string;
  types: string[] | null;
  imageBase: string | null;
  setName: string;
}

/** 지금 끌고 있는 것이 무엇인지. dragover 에서는 dataTransfer 를 읽을 수 없어 상태로 들고 있는다. */
type Drag =
  | { kind: "storage"; storageId: number }
  | { kind: "slot"; position: number }
  | null;

const SIZES = [1, 2, 3, 4];
/** 바인더 한 권의 최대 페이지 수. API(pages/route.ts) 의 MAX_PAGES 와 맞출 것. */
const MAX_PAGES = 20;

export default function BinderManager({
  initial,
  storage,
}: {
  initial: BinderData[];
  storage: StorageCard[];
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<number | null>(initial[0]?.id ?? null);
  const [creating, setCreating] = useState(initial.length === 0);
  const [name, setName] = useState("");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState("");

  // 편집 모드
  const [editMode, setEditMode] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);       // 편집 모드에서 보고 있는 면 (0|1)
  const [drag, setDrag] = useState<Drag>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [overRail, setOverRail] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const [preview, setPreview] = useState<
    { card: StorageCard; top: number; left: number } | null
  >(null);

  // 목록이 바뀌었는데 선택된 게 사라졌으면 첫 번째로
  useEffect(() => {
    if (initial.length === 0) {
      setActiveId(null);
      return;
    }
    if (activeId === null || !initial.some((b) => b.id === activeId)) {
      setActiveId(initial[0].id);
    }
  }, [initial, activeId]);

  const active = initial.find((b) => b.id === activeId) ?? null;

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
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setErr("요청 실패");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("이름을 입력하세요");
      return;
    }
    if (await call("/api/binders", "POST", { name, rows, cols })) {
      setName("");
      setCreating(false);
    }
  }

  const perPage = active ? active.grid_rows * active.grid_cols : 0;
  const pageCount = active?.page_count ?? 0;
  const cap = perPage * pageCount;
  const byPosition = new Map<number, BinderCard>();
  if (active) for (const c of active.cards) byPosition.set(c.position, c);
  // 크기를 줄이면 용량 밖으로 밀려난 카드가 생긴다 (지워지진 않는다)
  const hidden = active ? active.cards.filter((c) => c.position >= cap).length : 0;

  // 보고 있는 페이지가 범위를 벗어나면 (페이지 삭제 직후 등) 끌어당긴다
  const page = Math.min(pageIndex, Math.max(0, pageCount - 1));

  // 실물 바인더는 표지를 열면 1페이지가 '오른쪽 단면'으로 시작한다.
  // 그 뒤로 (2,3) (4,5) … 로 묶이고, 마지막이 홀로 남으면 왼쪽 면만 찬다.
  //   page 0        → [빈 면, 1p]
  //   page 1,2      → [2p, 3p]
  //   page 3,4      → [4p, 5p]
  const spreadStart = page === 0 ? 0 : page - ((page - 1) % 2);
  const leftPage = spreadStart === 0 ? null : spreadStart;
  const rightPage =
    spreadStart === 0 ? 0 : spreadStart + 1 < pageCount ? spreadStart + 1 : null;

  useEffect(() => {
    if (pageIndex > page) setPageIndex(page);
  }, [pageIndex, page]);

  // ── 드래그 동작 ──────────────────────────────────────────────────────
  function slotAction(body: unknown) {
    if (!active) return;
    void call(`/api/binders/${active.id}/slots`, "POST", body);
  }

  // ── 페이지 추가/삭제 ────────────────────────────────────────────────
  async function addPage() {
    if (!active || pageCount >= MAX_PAGES) return;
    if (await call(`/api/binders/${active.id}/pages`, "POST", { afterPage: page })) {
      setPageIndex(page + 1); // 새로 생긴 페이지로 이동
    }
  }

  async function removePage() {
    if (!active || pageCount <= 1) return;
    const onPage = active.cards.filter(
      (c) => c.position >= page * perPage && c.position < (page + 1) * perPage,
    ).length;
    const msg =
      onPage > 0
        ? `${page + 1}페이지를 삭제할까요? 이 페이지의 카드 ${onPage}장은 보관함으로 돌아갑니다.`
        : `${page + 1}페이지를 삭제할까요?`;
    if (!confirm(msg)) return;
    if (await call(`/api/binders/${active.id}/pages`, "DELETE", { page })) {
      setPageIndex(Math.max(0, page - 1));
    }
  }

  function onDropSlot(position: number) {
    setOverSlot(null);
    if (!drag) return;
    if (drag.kind === "storage") {
      slotAction({ action: "place", storageId: drag.storageId, position });
    } else if (drag.position !== position) {
      slotAction({ action: "move", from: drag.position, to: position });
    }
    setDrag(null);
  }

  function onDropRail() {
    setOverRail(false);
    if (drag?.kind === "slot") slotAction({ action: "unplace", position: drag.position });
    setDrag(null);
  }

  /** 드래그가 어떻게 끝나든(성공·취소·ESC) 하이라이트를 모두 끈다. */
  function endDrag() {
    setDrag(null);
    setOverSlot(null);
    setOverRail(false);
    setOverTrash(false);
  }

  /** 보관함 카드를 버린다. 도감에서 한 번 클릭으로 다시 담을 수 있어 확인창은 두지 않는다. */
  function onDropTrash() {
    setOverTrash(false);
    if (drag?.kind === "storage") void call("/api/storage", "DELETE", { id: drag.storageId });
    setDrag(null);
  }

  // ── 스프레드가 항상 한 화면에 들어가도록 카드 폭을 직접 계산 ──────────
  // 가용 영역을 측정해 '가로 제약'과 '세로 제약' 중 작은 쪽을 택한다.
  const fitRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(0);

  useLayoutEffect(() => {
    const el = fitRef.current;
    if (!el || !active) return;
    const { grid_rows: r, grid_cols: c } = active;
    // 기본 모드는 한쪽이 비어 있어도 항상 펼침면(두 면) 폭을 잡는다.
    // 그래야 페이지를 넘겨도 카드 크기가 들쭉날쭉하지 않는다.
    const pages = editMode ? 1 : 2;

    const measure = () => {
      // clientWidth/Height 는 자기 패딩을 포함한다. 스프레드가 실제로 쓸 수 있는
      // 건 content box 이므로 패딩을 빼야 한다. (안 빼면 그만큼 넘쳐서 잘린다)
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const availW = el.clientWidth - padX;
      const availH = el.clientHeight - padY;
      // 가로: 페이지 패딩 + 슬롯간격 (+ 양면이면 링과 가운데 간격까지)
      const hOver =
        pages === 2
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
  }, [active, editMode]);

  // 페이지 한 면의 실제 크기 — 비어 있는 면(표지 안쪽)을 같은 크기로 비워두는 데 쓴다
  const cardH = Math.round((cardW * CARD_H) / CARD_W);
  const pageW = active
    ? active.grid_cols * cardW + (active.grid_cols - 1) * SLOT_GAP + 2 * PAGE_PAD
    : 0;
  const pageH = active
    ? active.grid_rows * cardH + (active.grid_rows - 1) * SLOT_GAP + 2 * PAGE_PAD
    : 0;

  /** 카드가 놓이지 않는 면. 표지 안쪽처럼 비어 있되 자리는 차지한다. */
  function renderVoid(key: string) {
    return <div className="spread-void" key={key} style={{ width: pageW, height: pageH }} />;
  }

  function renderPage(from: number) {
    if (!active) return null;
    return (
      <div
        className="spread-page"
        style={{
          gridTemplateColumns: `repeat(${active.grid_cols}, ${cardW}px)`,
          gridAutoRows: `${Math.round((cardW * CARD_H) / CARD_W)}px`,
        }}
      >
        {Array.from({ length: perPage }, (_, i) => {
          const position = from + i;
          const c = byPosition.get(position) ?? null;
          const isOver = overSlot === position;
          return (
            <div
              className={`slot${c ? " filled" : ""}${isOver ? " over" : ""}`}
              key={position}
              draggable={editMode && !!c}
              onDragStart={
                editMode && c
                  ? (e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", `slot:${position}`);
                      setDrag({ kind: "slot", position });
                    }
                  : undefined
              }
              onDragEnd={endDrag}
              onDragOver={
                editMode
                  ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverSlot(position); }
                  : undefined
              }
              onDragLeave={editMode ? () => setOverSlot((p) => (p === position ? null : p)) : undefined}
              onDrop={editMode ? (e) => { e.preventDefault(); onDropSlot(position); } : undefined}
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

  return (
    <div className="binder-page">
      {/* 툴바: 바인더 선택 + 액션 */}
      <div className="binder-toolbar">
        <div className="binder-tabs">
          {initial.map((b) => (
            <button
              key={b.id}
              className={`binder-tab${b.id === activeId ? " active" : ""}`}
              disabled={editMode}
              onClick={() => {
                setActiveId(b.id);
                setRenaming(false);
                setPageIndex(0); // 다른 바인더는 1페이지부터 연다
              }}
            >
              {b.name}
            </button>
          ))}
          {!editMode && (
            <button className="btn btn-sm btn-primary" onClick={() => setCreating((v) => !v)}>
              + 새 바인더
            </button>
          )}
        </div>

        {active && !renaming && (
          <div className="binder-actions">
            <span className="binder-meta">
              {active.grid_rows}×{active.grid_cols} · {pageCount}p ·{" "}
              {Math.min(active.cards.length, cap)}/{cap}
              {hidden > 0 ? ` · ${hidden}장 숨김` : ""}
            </span>

            {!editMode && (
              <>
                <select
                  className="select-dropdown"
                  value={active.grid_rows}
                  disabled={busy}
                  onChange={(e) =>
                    call(`/api/binders/${active.id}`, "PATCH", { rows: Number(e.target.value) })
                  }
                >
                  {SIZES.map((n) => (
                    <option key={n} value={n}>{n}행</option>
                  ))}
                </select>
                <select
                  className="select-dropdown"
                  value={active.grid_cols}
                  disabled={busy}
                  onChange={(e) =>
                    call(`/api/binders/${active.id}`, "PATCH", { cols: Number(e.target.value) })
                  }
                >
                  {SIZES.map((n) => (
                    <option key={n} value={n}>{n}열</option>
                  ))}
                </select>
                <button
                  className="btn btn-sm"
                  onClick={() => { setRenaming(true); setEditName(active.name); }}
                >
                  이름변경
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`'${active.name}' 바인더를 삭제할까요?`))
                      call(`/api/binders/${active.id}`, "DELETE");
                  }}
                >
                  삭제
                </button>
              </>
            )}

            {/* 편집 모드 토글 — 자리는 그대로, 라벨만 바뀐다 */}
            <button
              className={`btn btn-sm${editMode ? " btn-primary" : ""}`}
              onClick={() => {
                // 보고 있던 페이지는 유지한다 — 8페이지를 편집하고 끝냈는데
                // 1페이지로 튕기면 어디를 고쳤는지 다시 찾아야 한다
                setEditMode((v) => !v);
                setCreating(false);
              }}
            >
              {editMode ? "수정 완료" : "수정하기"}
            </button>
          </div>
        )}

        {active && renaming && (
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
                if (await call(`/api/binders/${active.id}`, "PATCH", { name: editName }))
                  setRenaming(false);
              }}
            >
              저장
            </button>
            <button className="btn btn-sm" onClick={() => setRenaming(false)}>
              취소
            </button>
          </div>
        )}
      </div>

      {/* 생성 폼 */}
      {creating && (
        <div className="form-panel create-panel">
          <form onSubmit={create} className="binder-form">
            <label className="field-label">이름</label>
            <input
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 리자몽 바인더"
            />
            <label className="field-label">한 면 크기</label>
            <select
              className="select-dropdown"
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
            >
              {SIZES.map((n) => (
                <option key={n} value={n}>{n}행</option>
              ))}
            </select>
            <span className="times">×</span>
            <select
              className="select-dropdown"
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
            >
              {SIZES.map((n) => (
                <option key={n} value={n}>{n}열</option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={busy}>
              바인더 만들기
            </button>
            <span className="field-label">최대 4×4 (양면 32칸). 개수 제한 없음.</span>
          </form>
          {err && <div className="form-error">{err}</div>}
        </div>
      )}
      {err && !creating && <div className="form-error">{err}</div>}

      {/* 무대: 보관함 사이드바 + 바인더 */}
      <div className={`binder-stage${editMode ? " editing" : ""}`}>
        <aside
          className={`storage-rail${overRail ? " over" : ""}`}
          aria-hidden={!editMode}
          onDragOver={(e) => {
            if (drag?.kind !== "slot") return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOverRail(true);
          }}
          onDragLeave={() => setOverRail(false)}
          onDrop={(e) => { e.preventDefault(); onDropRail(); }}
        >
          {/* 내부 폭을 고정한 래퍼. 바깥(aside)만 width 를 애니메이션하고 여기는
              항상 268px 이라, 접힐 때 글자가 세로로 접혀 높이가 늘어나지 않는다. */}
          <div className="rail-inner">
          <div className="rail-head">
            <span>카드 보관함</span>
            <span className="n-sm">{storage.length}</span>
          </div>

          {storage.length === 0 ? (
            <p className="rail-empty">
              도감에서 <b>+ 보관함에 담기</b> 로 카드를 담으면 여기에 쌓입니다.
            </p>
          ) : (
            <ul className="rail-list" onMouseLeave={() => setPreview(null)}>
              {storage.map((s) => (
                <li key={s.id}>
                  <div
                    className="rail-row"
                    draggable={editMode}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", `storage:${s.id}`);
                      setDrag({ kind: "storage", storageId: s.id });
                      setPreview(null);
                    }}
                    onDragEnd={endDrag}
                    // onMouseEnter 대신 onMouseOver — 자식 span 에서 올라와도 잡히고,
                    // 위치는 레일 오른쪽 끝에서 계산한다 (화면 폭이 넓어 컨테이너가
                    // 가운데 정렬돼도 미리보기가 레일을 덮지 않게)
                    onMouseOver={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setPreview({
                        card: s,
                        top: Math.max(8, Math.min(r.top, window.innerHeight - PREVIEW_H - 8)),
                        left: r.right + 8,
                      });
                    }}
                  >
                    <span className="rail-num n-sm">{s.localId}</span>
                    <span className="rail-name">{s.name}</span>
                    <span className="rail-set">{s.setName}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* 버리기 — 보관함 카드를 여기로 끌어다 놓으면 보관함에서 지운다.
              바인더 칸에서 끌어온 카드는 여기서 받지 않고(preventDefault 안 함)
              레일로 흘려보내 '보관함으로 되돌리기'가 되게 둔다. */}
          <div
            className={`rail-trash${overTrash ? " over" : ""}`}
            aria-label="보관함에서 버리기"
            onDragOver={(e) => {
              if (drag?.kind !== "storage") return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverTrash(true);
            }}
            onDragLeave={() => setOverTrash(false)}
            onDrop={(e) => {
              if (drag?.kind !== "storage") return;
              e.preventDefault();
              e.stopPropagation();
              onDropTrash();
            }}
          >
            <TrashIcon size={20} />
            <span>{overTrash ? "놓으면 삭제" : "버리기"}</span>
          </div>
          </div>
        </aside>

        {active ? (
          <div className="spread-fit" ref={fitRef}>
            <div className="spread" style={{ visibility: cardW ? "visible" : "hidden" }}>
              {editMode ? (
                renderPage(page * perPage)
              ) : (
                <>
                  {leftPage !== null ? renderPage(leftPage * perPage) : renderVoid("void-l")}
                  <div className="spread-rings" />
                  {rightPage !== null ? renderPage(rightPage * perPage) : renderVoid("void-r")}
                </>
              )}

              {/* 페이지 넣기/빼기 — 편집 모드에서 바인더 우측 상단 */}
              {editMode && (
                <div className="page-tools">
                  <button
                    className="icon-btn"
                    title={
                      pageCount >= MAX_PAGES
                        ? `페이지는 최대 ${MAX_PAGES}장까지입니다`
                        : `${page + 2}페이지로 새 페이지 넣기`
                    }
                    aria-label="페이지 추가"
                    disabled={busy || pageCount >= MAX_PAGES}
                    onClick={addPage}
                  >
                    <PlusIcon />
                  </button>
                  <button
                    className="icon-btn danger"
                    title={
                      pageCount <= 1
                        ? "마지막 페이지는 삭제할 수 없습니다"
                        : `${page + 1}페이지 삭제`
                    }
                    aria-label="페이지 삭제"
                    disabled={busy || pageCount <= 1}
                    onClick={removePage}
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="spread-fit">
            <div className="empty-state">
              아직 바인더가 없습니다. 위 <b>+ 새 바인더</b>로 첫 바인더를 만들어 보세요.
            </div>
          </div>
        )}
      </div>

      {/* 페이지 번호 — 클릭하면 그 페이지로 넘어간다.
          기본 모드에서는 지금 펼쳐진 두 면을 함께 강조한다. */}
      {active && pageCount > 0 && (
        <div className="page-switch">
          {Array.from({ length: pageCount }, (_, p) => {
            const on = editMode ? p === page : p === leftPage || p === rightPage;
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
        </div>
      )}

      {/* 보관함 호버 미리보기 */}
      {editMode && preview && !drag && (
        <div className="storage-preview" style={{ top: preview.top, left: preview.left }}>
          {preview.card.imageBase ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${preview.card.imageBase}/high.webp`} alt={preview.card.name} />
          ) : (
            <div className="noimg">{preview.card.name}</div>
          )}
        </div>
      )}
    </div>
  );
}
