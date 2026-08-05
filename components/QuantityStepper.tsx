"use client";
// 클라이언트 컴포넌트. 보유 수량을 +/- 하고 /api/collection 에 저장한다.
import { useEffect, useState } from "react";

export default function QuantityStepper({ variantId }: { variantId: number }) {
  const [qty, setQty] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // 최초 보유 수량 조회
  useEffect(() => {
    fetch(`/api/collection?variantId=${variantId}`)
      .then((r) => r.json())
      .then((d) => setQty(d.quantity ?? 0))
      .catch(() => setQty(0))
      .finally(() => setLoaded(true));
  }, [variantId]);

  async function update(next: number) {
    if (next < 0) return;
    setQty(next); // 낙관적 업데이트
    setSaving(true);
    try {
      await fetch("/api/collection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId, quantity: next }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stepper">
      <button onClick={() => update(qty - 1)} disabled={!loaded || qty <= 0}>
        −
      </button>
      <span className="qty">{loaded ? qty : "…"}</span>
      <button onClick={() => update(qty + 1)} disabled={!loaded || saving}>
        +
      </button>
    </div>
  );
}
