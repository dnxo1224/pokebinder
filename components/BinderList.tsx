"use client";
// 바인더 목록 (ADR-0001 Phase 4)
// 카드형 그리드로 늘어놓고, 누르면 개별 바인더로 들어간다.
// 생성도 여기서 한다 — 이름 + 행×열만 정하고 페이지는 기본 10장으로 시작한다.
// (실물 바인더도 '몇 포켓짜리인가'가 먼저고 장수는 채우면서 늘린다)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlusIcon } from "./Icons";

export interface BinderSummary {
  id: number;
  name: string;
  rows: number;
  cols: number;
  pageCount: number;
  placed: number;
  /** 지정한 커버 세트의 로고. null 이면 기본 커버를 쓴다 */
  coverLogo: string | null;
}

const SIZES = [1, 2, 3, 4];

export default function BinderList({
  binders,
  defaultCover,
}: {
  binders: BinderSummary[];
  defaultCover: string | null;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(binders.length === 0);
  const [name, setName] = useState("");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("이름을 입력하세요");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/binders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, rows, cols }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "생성 실패");
        return;
      }
      setName("");
      setCreating(false);
      router.push(`/binders/${d.id}`); // 만들자마자 그 바인더로
    } catch {
      setErr("생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-head">
        <h2>바인더 제작</h2>
        <span className="count">{binders.length}권</span>
        <span className="spacer" />
        {!creating && (
          <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
            + 새 바인더
          </button>
        )}
      </div>

      {creating && (
        <div className="form-panel">
          <form onSubmit={create} className="binder-form">
            <label className="field-label">이름</label>
            <input
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 리자몽 바인더"
              autoFocus
            />
            <label className="field-label">한 면 크기</label>
            <select className="select-dropdown" value={rows} onChange={(e) => setRows(Number(e.target.value))}>
              {SIZES.map((n) => <option key={n} value={n}>{n}행</option>)}
            </select>
            <span className="times">×</span>
            <select className="select-dropdown" value={cols} onChange={(e) => setCols(Number(e.target.value))}>
              {SIZES.map((n) => <option key={n} value={n}>{n}열</option>)}
            </select>
            <button className="btn btn-primary" disabled={busy}>바인더 만들기</button>
            {binders.length > 0 && (
              <button type="button" className="btn" onClick={() => { setCreating(false); setErr(null); }}>
                취소
              </button>
            )}
            <span className="field-label">페이지는 10장으로 시작하고 편집에서 늘립니다.</span>
          </form>
          {err && <div className="form-error">{err}</div>}
        </div>
      )}

      {binders.length === 0 && !creating ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          아직 바인더가 없습니다. <b>+ 새 바인더</b>로 첫 바인더를 만들어 보세요.
        </div>
      ) : (
        <div className="binder-grid" style={{ marginTop: 24 }}>
          {binders.map((b) => {
            const cap = b.rows * b.cols * b.pageCount;
            const logo = b.coverLogo ?? defaultCover;
            return (
              <Link key={b.id} href={`/binders/${b.id}`} className="binder-card">
                <div className="cover">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${logo}.png`} alt="" loading="lazy" />
                  ) : (
                    <span className="noimg"><PlusIcon /></span>
                  )}
                </div>
                <div className="body">
                  <span className="bname">{b.name}</span>
                  <span className="bmeta n-sm">
                    {b.rows}×{b.cols} · {b.pageCount}p
                  </span>
                  <div className="fill">
                    <i style={{ width: `${cap ? Math.min(100, (b.placed / cap) * 100) : 0}%` }} />
                  </div>
                  <span className="bmeta n-sm">
                    {b.placed} / {cap}칸
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
