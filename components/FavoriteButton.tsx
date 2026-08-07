"use client";
// 카드 즐겨찾기 토글 (ADR-0001)
// 도감과 바인더를 잇는 유일한 접점. 도감에서 찜해두면 바인더 사이드바에서
// "즐겨찾기만" 필터로 걸러 쓴다.
//
// 낙관적 갱신: 누르는 즉시 상태를 바꾸고, 실패하면 되돌린다.
// 카드 타일이 overflow:hidden 이라 바깥에 토스트를 띄우면 잘리므로,
// 결과는 버튼 자신의 모양으로만 알린다.
import { useState } from "react";
import { StarIcon } from "./Icons";

export default function FavoriteButton({
  cardId,
  initial = false,
  label = true,
}: {
  cardId: number;
  initial?: boolean;
  label?: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // 타일 전체가 링크인 자리에서도 쓸 수 있게 이벤트를 가둔다
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const next = !on;
    setOn(next); // 낙관적
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/favorites", {
        method: next ? "PUT" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setOn(!next); // 되돌리기
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`fav-btn${on ? " on" : ""}${label ? "" : " icon-only"}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={on ? "즐겨찾기 해제" : "즐겨찾기"}
      title={failed ? "실패했습니다. 다시 눌러 주세요" : on ? "즐겨찾기 해제" : "즐겨찾기"}
    >
      <StarIcon filled={on} />
      {label && <span>{failed ? "실패" : on ? "찜함" : "즐겨찾기"}</span>}
    </button>
  );
}
