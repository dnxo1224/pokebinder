"use client";
// 바인더 관리: 생성 / 이름변경 / 크기변경 / 삭제 + 배치 미리보기(그리드).
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [name, setName] = useState("");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

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
    if (await call("/api/binders", "POST", { name, rows, cols })) setName("");
  }

  return (
    <>
      <div className="panel-head">내 바인더</div>

      {/* 생성 폼 */}
      <div className="form-panel">
        <form onSubmit={create} className="binder-form">
          <label className="field-label">이름</label>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 리자몽 바인더"
          />
          <label className="field-label">크기</label>
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
        </form>
        {err && <div className="form-error">{err}</div>}
        <div className="dotted-divider" />
        <p className="micro">최대 4×4까지 만들 수 있습니다. 바인더 개수는 제한이 없습니다.</p>
      </div>

      {/* 바인더 목록 */}
      {initial.length === 0 ? (
        <div className="empty-state">
          아직 바인더가 없습니다. 위에서 첫 바인더를 만들어 보세요.
        </div>
      ) : (
        initial.map((b) => {
          const cap = b.grid_rows * b.grid_cols;
          const slots = Array.from({ length: cap }, (_, i) => b.cards[i] ?? null);
          return (
            <section className="binder-block" key={b.id}>
              <div className="binder-bar">
                {editingId === b.id ? (
                  <>
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
                        if (await call(`/api/binders/${b.id}`, "PATCH", { name: editName }))
                          setEditingId(null);
                      }}
                    >
                      저장
                    </button>
                    <button className="btn-dark" onClick={() => setEditingId(null)}>
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <span className="binder-name">{b.name}</span>
                    <span className="binder-meta">
                      {b.grid_rows}×{b.grid_cols} · {b.cards.length}/{cap}
                    </span>
                    <div className="binder-actions">
                      <select
                        className="select-dropdown"
                        value={b.grid_rows}
                        onChange={(e) =>
                          call(`/api/binders/${b.id}`, "PATCH", { rows: Number(e.target.value) })
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
                        value={b.grid_cols}
                        onChange={(e) =>
                          call(`/api/binders/${b.id}`, "PATCH", { cols: Number(e.target.value) })
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
                          setEditingId(b.id);
                          setEditName(b.name);
                        }}
                      >
                        이름변경
                      </button>
                      <button
                        className="btn-danger"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`'${b.name}' 바인더를 삭제할까요?`))
                            call(`/api/binders/${b.id}`, "DELETE");
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div
                className="binder-grid"
                style={{ gridTemplateColumns: `repeat(${b.grid_cols}, 1fr)` }}
              >
                {slots.map((c, i) => (
                  <div className={`slot${c ? " filled" : ""}`} key={i}>
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
                            call(`/api/binders/${b.id}/cards`, "DELETE", { entryId: c.entryId })
                          }
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <span className="slot-empty">{i + 1}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
