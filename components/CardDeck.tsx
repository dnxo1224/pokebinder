"use client";
// 메인 히어로의 3D 코버플로우 덱 — 자동 전환.
//
// 상태는 '정수 인덱스' 하나뿐이고, 카드 이동은 전부 CSS transition이 처리한다.
// (직접 프레임을 그리지 않으므로 보간·관성·포인터 캡처 관련 버그가 생길 여지가 없다)
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface DeckCard {
  id: number;
  name: string;
  localId: string;
  rarity: string | null;
  imageBase: string | null;
  setName: string;
  setCode: string;
}

/** 자동 전환 간격 */
const INTERVAL_MS = 3800;
/** 중앙에서 이 개수 넘게 떨어진 카드는 그리지 않는다 */
const VISIBLE = 4;

/** i번 카드가 현재 인덱스 기준으로 몇 칸 떨어져 있는지 (–n/2 ~ n/2 로 감싼다) */
function wrapOffset(i: number, index: number, n: number): number {
  let o = (((i - index) % n) + n) % n;
  if (o > n / 2) o -= n;
  return o;
}

export default function CardDeck({ cards }: { cards: DeckCard[] }) {
  const n = cards.length;
  const router = useRouter();
  const [index, setIndex] = useState(0);
  // 멈춤 사유는 서로 독립이다. 하나로 합치면 마우스가 스쳐 지나갈 때
  // 포커스가 남아 있는데도 재생이 재개된다.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  const go = useCallback(
    (dir: number) => setIndex((i) => (((i + dir) % n) + n) % n),
    [n],
  );

  useEffect(() => {
    if (n < 2 || paused) return;
    // 모션 민감 설정이면 자동 재생하지 않는다 (좌우 버튼·점으로만 이동)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      // 백그라운드 탭에서는 넘기지 않는다 — 돌아왔을 때 엉뚱한 카드에 가 있지 않게
      if (document.hidden) return;
      setIndex((i) => (i + 1) % n);
    }, INTERVAL_MS);

    return () => clearInterval(id);
  }, [n, paused]);

  if (n === 0) {
    return (
      <div className="deck-empty">
        아직 보여줄 카드가 없습니다.
        <br />
        <code>npm run ingest -- --lang en --limit 3</code> 으로 카드를 적재하세요.
      </div>
    );
  }

  return (
    <>
      <div
        className="deck"
        role="group"
        aria-label="인기 카드"
        tabIndex={0}
        // 읽는 동안엔 멈춘다 (마우스와 키보드 포커스를 따로 센다)
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
          if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        }}
      >
        {cards.map((c, i) => {
          const o = wrapOffset(i, index, n);
          const a = Math.abs(o);
          if (a > VISIBLE) return null;

          // 회전은 과하게 눕지 않도록 제한 — 옆 카드도 그림이 읽혀야 한다
          const co = Math.max(-2, Math.min(2, o));
          const isCenter = o === 0;

          return (
            <div
              key={c.id}
              className={`deck-card${isCenter ? " is-center" : ""}`}
              style={{
                transform:
                  `translate(-50%, -50%)` +
                  ` translateX(${o * 58}%)` +
                  ` translateZ(${-a * 80}px)` +
                  ` rotateY(${-co * 26}deg)` +
                  ` scale(${Math.max(0.66, 1 - a * 0.08)})`,
                zIndex: 100 - a * 10,
                opacity: a > VISIBLE - 0.8 ? 0 : 1,
              }}
              onClick={() => {
                if (isCenter) router.push(`/sets/${c.setCode}`);
              }}
            >
              {c.imageBase ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${c.imageBase}/high.webp`}
                  alt={c.name}
                  draggable={false}
                  loading={a <= 1 ? "eager" : "lazy"}
                />
              ) : (
                <span className="noimg">{c.name}</span>
              )}
              {isCenter && (
                <span className="deck-caption">
                  <span className="n">{c.name}</span>
                  <span className="m">
                    {c.setName} · {c.localId}
                    {c.rarity ? ` · ${c.rarity}` : ""}
                  </span>
                </span>
              )}
            </div>
          );
        })}

        {n > 1 && (
          <>
            <button className="deck-nav prev" aria-label="이전 카드" onClick={() => go(-1)}>
              ‹
            </button>
            <button className="deck-nav next" aria-label="다음 카드" onClick={() => go(1)}>
              ›
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="deck-dots" role="tablist" aria-label="카드 선택">
          {cards.map((c, i) => (
            <button
              key={c.id}
              className={`deck-dot${i === index ? " on" : ""}`}
              role="tab"
              aria-selected={i === index}
              aria-label={c.name}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </>
  );
}
