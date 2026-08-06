"use client";
// 카드 검색 — UI 스켈레톤.
// 지금은 레이아웃/컨트롤 배치만 확정한다. 실제 질의·페이징·결과 렌더링은
// 세부 UX 확정 후 붙인다. (칩은 눌러서 모양만 확인할 수 있게 로컬 상태로 동작)
import { useState } from "react";
import { SearchIcon } from "./Icons";

const TYPES = [
  "Grass", "Fire", "Water", "Lightning",
  "Psychic", "Fighting", "Colorless", "Darkness",
  "Metal", "Dragon", "Fairy",
];
const RARITIES = ["Common", "Uncommon", "Rare", "Promo"];
const CATEGORIES = ["Pokemon", "Trainer", "Energy"];

function useToggleSet() {
  const [on, setOn] = useState<string[]>([]);
  const toggle = (v: string) =>
    setOn((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  return { on, toggle, clear: () => setOn([]) };
}

export default function CardSearchUI() {
  const [q, setQ] = useState("");
  const types = useToggleSet();
  const rarities = useToggleSet();
  const categories = useToggleSet();

  const activeCount = types.on.length + rarities.on.length + categories.on.length;

  return (
    <>
      <div className="section-head">
        <h2>카드 검색</h2>
        <span className="count">UI 설계 단계</span>
      </div>

      <div className="searchbar">
        <span className="ico"><SearchIcon /></span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="카드 이름으로 검색 (예: Charizard, 리자몽)"
          aria-label="카드 검색"
        />
        {q && (
          <button className="clear" onClick={() => setQ("")} aria-label="검색어 지우기">
            ×
          </button>
        )}
      </div>

      <div style={{ marginTop: 24, display: "grid", gap: 20 }}>
        <div>
          <div className="field-label">타입</div>
          <div className="chip-row">
            {TYPES.map((t) => (
              <button
                key={t}
                className={`chip${types.on.includes(t) ? " on" : ""}`}
                onClick={() => types.toggle(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="field-label">레어도</div>
          <div className="chip-row">
            {RARITIES.map((r) => (
              <button
                key={r}
                className={`chip${rarities.on.includes(r) ? " on" : ""}`}
                onClick={() => rarities.toggle(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="field-label">카테고리</div>
          <div className="chip-row">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`chip${categories.on.includes(c) ? " on" : ""}`}
                onClick={() => categories.toggle(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section-head">
        <h2 style={{ fontSize: 16 }}>결과</h2>
        <span className="count">
          {activeCount > 0 ? `필터 ${activeCount}개 적용` : "필터 없음"}
        </span>
        <span className="spacer" />
        <button
          className="btn btn-sm"
          onClick={() => {
            setQ("");
            types.clear();
            rarities.clear();
            categories.clear();
          }}
        >
          초기화
        </button>
      </div>

      <div className="empty-state">
        검색 UI만 먼저 잡아둔 상태입니다.
        <br />
        검색 방식(자동완성 / 즉시검색 / 페이징)을 정하면 결과 그리드를 연결합니다.
      </div>
    </>
  );
}
