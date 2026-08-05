"use client";
// 카드칸 위에 뜨는 바인더 선택 팝오버.
// "내 바인더에 추가" → 바인더 목록이 카드 위에 스크롤 가능한 패널로 열림 → 선택 시 추가.
import { useEffect, useRef, useState } from "react";

interface Binder {
  id: number;
  name: string;
  grid_rows: number;
  grid_cols: number;
  card_count: number;
}

export default function AddToBinder({ cardId }: { cardId: number }) {
  const [open, setOpen] = useState(false);
  const [binders, setBinders] = useState<Binder[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 열릴 때 바인더 목록 로드
  useEffect(() => {
    if (!open) return;
    setBinders(null);
    fetch("/api/binders")
      .then((r) => r.json())
      .then((d) => setBinders(d.binders ?? []))
      .catch(() => setBinders([]));
  }, [open]);

  // 바깥 클릭 / ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 토스트 자동 소멸
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);

  async function add(b: Binder) {
    setBusy(true);
    try {
      const res = await fetch(`/api/binders/${b.id}/cards`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error ?? "추가 실패");
      } else {
        setMsg(`${b.name}에 추가됨 (${d.used}/${d.cap})`);
        setOpen(false);
      }
    } catch {
      setMsg("추가 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="atb" ref={rootRef}>
      <button className="btn-amber atb-trigger" onClick={() => setOpen((v) => !v)}>
        + 내 바인더에 추가
      </button>

      {open && (
        <div className="atb-pop" role="dialog" aria-label="바인더 선택">
          <div className="atb-pop-head">바인더 선택</div>
          <div className="atb-pop-list">
            {binders === null ? (
              <div className="atb-empty">불러오는 중…</div>
            ) : binders.length === 0 ? (
              <div className="atb-empty">
                바인더가 없습니다.
                <br />
                <a href="/binders">바인더 만들기 →</a>
              </div>
            ) : (
              binders.map((b) => {
                const cap = b.grid_rows * b.grid_cols;
                const full = b.card_count >= cap;
                return (
                  <button
                    key={b.id}
                    className="atb-item"
                    disabled={busy || full}
                    onClick={() => add(b)}
                  >
                    <span className="atb-item-name">{b.name}</span>
                    <span className="atb-item-meta">
                      {b.grid_rows}×{b.grid_cols} · {b.card_count}/{cap}
                      {full ? " 가득참" : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {msg && <div className="atb-toast">{msg}</div>}
    </div>
  );
}
