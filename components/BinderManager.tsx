"use client";
// 바인더: 선택(탭) / 생성 / 이름변경 / 크기변경 / 삭제
// 선택된 바인더 하나를 '양면 스프레드'로 화면에 가득 채워 보여준다.
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// 카드 원본 비율
const CARD_W = 245, CARD_H = 337;
// 스프레드 구성 요소의 고정 여백(px) — CSS와 반드시 일치시킬 것
const SLOT_GAP = 4, PAGE_PAD = 6, RINGS_W = 10, MID_GAP = 8;

export interface BinderCard {
  entryId: number;
  name: string;
  localId: string;
  imageBase: string | null;
}
export interface BinderData {
  id: number;
  name: string;
  grid_rows: number;
  grid_cols: number;
  cards: BinderCard[];
}

const SIZES = [1, 2, 3, 4];

export default function BinderManager({ initial }: { initial: BinderData[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<number | null>(initial[0]?.id ?? null);
  const [creating, setCreating] = useState(initial.length === 0);
  const [name, setName] = useState("");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

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

  // 양면 스프레드: 좌우 2페이지
  const perPage = active ? active.grid_rows * active.grid_cols : 0;
  const cap = perPage * 2;
  const slots: (BinderCard | null)[] = active
    ? Array.from({ length: cap }, (_, i) => active.cards[i] ?? null)
    : [];

  // ── 스프레드가 항상 한 화면에 들어가도록 카드 폭을 직접 계산 ──────────
  // 가용 영역을 측정해 '가로 제약'과 '세로 제약' 중 작은 쪽을 택한다.
  const fitRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(0);

  useLayoutEffect(() => {
    const el = fitRef.current;
    if (!el || !active) return;
    const { grid_rows: r, grid_cols: c } = active;

    const measure = () => {
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      // 가로: 카드 8~2장분 + 슬롯간격 + 페이지 패딩 ×4 + 링 + 가운데 간격 ×2
      const hOver = 4 * PAGE_PAD + 2 * (c - 1) * SLOT_GAP + RINGS_W + 2 * MID_GAP;
      const vOver = 2 * PAGE_PAD + (r - 1) * SLOT_GAP;
      const byWidth = (availW - hOver) / (c * 2);
      const byHeight = ((availH - vOver) / r) * (CARD_W / CARD_H);
      setCardW(Math.max(24, Math.floor(Math.min(byWidth, byHeight))));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

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
        {slots.slice(from, from + perPage).map((c, i) => (
          <div className={`slot${c ? " filled" : ""}`} key={from + i}>
            {c ? (
              <>
                {c.imageBase ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${c.imageBase}/low.webp`} alt={c.name} loading="lazy" />
                ) : (
                  <span className="slot-noimg">{c.name}</span>
                )}
                <button
                  className="slot-remove"
                  title="바인더에서 빼기"
                  onClick={() =>
                    call(`/api/binders/${active.id}/cards`, "DELETE", { entryId: c.entryId })
                  }
                >
                  ×
                </button>
              </>
            ) : (
              <span className="slot-empty">{from + i + 1}</span>
            )}
          </div>
        ))}
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
              onClick={() => {
                setActiveId(b.id);
                setEditing(false);
              }}
            >
              {b.name}
            </button>
          ))}
          <button className="btn-amber" onClick={() => setCreating((v) => !v)}>
            + 새 바인더
          </button>
        </div>

        {active && !editing && (
          <div className="binder-actions">
            <span className="binder-meta">
              {active.grid_rows}×{active.grid_cols} 양면 · {active.cards.length}/{cap}
            </span>
            <select
              className="select-dropdown"
              value={active.grid_rows}
              disabled={busy}
              onChange={(e) =>
                call(`/api/binders/${active.id}`, "PATCH", { rows: Number(e.target.value) })
              }
            >
              {SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}행
                </option>
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
                <option key={n} value={n}>
                  {n}열
                </option>
              ))}
            </select>
            <button
              className="btn-amber"
              onClick={() => {
                setEditing(true);
                setEditName(active.name);
              }}
            >
              이름변경
            </button>
            <button
              className="btn-danger"
              disabled={busy}
              onClick={() => {
                if (confirm(`'${active.name}' 바인더를 삭제할까요?`))
                  call(`/api/binders/${active.id}`, "DELETE");
              }}
            >
              삭제
            </button>
          </div>
        )}

        {active && editing && (
          <div className="binder-actions">
            <input
              className="text-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <button
              className="btn-amber"
              disabled={busy}
              onClick={async () => {
                if (await call(`/api/binders/${active.id}`, "PATCH", { name: editName }))
                  setEditing(false);
              }}
            >
              저장
            </button>
            <button className="btn-dark" onClick={() => setEditing(false)}>
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
                <option key={n} value={n}>
                  {n}행
                </option>
              ))}
            </select>
            <span className="times">×</span>
            <select
              className="select-dropdown"
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
            >
              {SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}열
                </option>
              ))}
            </select>
            <button className="btn-submit" disabled={busy}>
              바인더 만들기
            </button>
            <span className="micro">
              최대 4×4 (양면 {4 * 4 * 2}칸). 개수 제한 없음.
            </span>
          </form>
          {err && <div className="form-error">{err}</div>}
        </div>
      )}
      {err && !creating && <div className="form-error">{err}</div>}

      {/* 양면 스프레드 */}
      {active ? (
        <div className="spread-fit" ref={fitRef}>
          <div className="spread" style={{ visibility: cardW ? "visible" : "hidden" }}>
            {renderPage(0)}
            <div className="spread-rings" />
            {renderPage(perPage)}
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
  );
}
