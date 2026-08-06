"use client";
// 도감에서 카드를 '카드 보관함'에 담는다.
// 바인더에 바로 넣지 않는다 — 배치는 바인더 편집 모드에서 드래그로 한다.
//
// 결과는 버튼 자체의 라벨로 알린다. 타일이 overflow:hidden 이라
// 바깥에 띄우는 토스트는 잘려서 읽을 수 없기 때문이다.
import { useEffect, useState } from "react";

type Feedback =
  | { kind: "idle" }
  | { kind: "ok"; count: number }
  | { kind: "err"; msg: string };

export default function AddToStorage({ cardId }: { cardId: number }) {
  const [fb, setFb] = useState<Feedback>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (fb.kind === "idle") return;
    const t = setTimeout(() => setFb({ kind: "idle" }), 2000);
    return () => clearTimeout(t);
  }, [fb]);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const d = await res.json();
      setFb(res.ok ? { kind: "ok", count: d.count } : { kind: "err", msg: d.error ?? "실패" });
    } catch {
      setFb({ kind: "err", msg: "담기 실패" });
    } finally {
      setBusy(false);
    }
  }

  const label =
    fb.kind === "ok"
      ? `✓ 담김 · 보관함 ${fb.count}장`
      : fb.kind === "err"
        ? fb.msg
        : "+ 보관함에 담기";

  return (
    <div className="atb">
      <button
        className={`btn btn-sm btn-block${fb.kind === "ok" ? " btn-primary" : ""}`}
        onClick={add}
        disabled={busy}
        title={fb.kind === "err" ? fb.msg : undefined}
      >
        {label}
      </button>
    </div>
  );
}
