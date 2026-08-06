"use client";
// 세트 도감: 상단 검색 + 발행 연도 필터 + 카드형 그리드.
// 세트 수가 많지 않아 서버에서 전부 받아 클라이언트에서 필터링한다.
// (전체 적재 시 수백 개 규모라 이 방식으로 충분)
import Link from "next/link";
import { useMemo, useState } from "react";
import { ImageIcon, SearchIcon } from "./Icons";

export interface SetItem {
  externalId: string;
  name: string;
  lang: string;
  releaseDate: string | null;
  artUrl: string | null;
  total: number | null;
  ingested: number;
}

type SortKey = "recent" | "name" | "size";

const ALL_YEARS = "all";

export default function SetBrowser({ sets }: { sets: SetItem[] }) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState<string>(ALL_YEARS);
  const [sort, setSort] = useState<SortKey>("recent");

  // 발행 연도 목록 — 실제 데이터에 있는 연도만, 최신순
  const years = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sets) {
      const y = s.releaseDate?.slice(0, 4);
      if (y) counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [sets]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let filtered = sets;

    if (needle) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.externalId.toLowerCase().includes(needle) ||
          s.lang.toLowerCase() === needle,
      );
    }
    if (year !== ALL_YEARS) {
      filtered = filtered.filter((s) => s.releaseDate?.startsWith(year));
    }

    const sorted = [...filtered];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "size") {
      sorted.sort((a, b) => (b.total ?? b.ingested) - (a.total ?? a.ingested));
    } else {
      sorted.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
    }
    return sorted;
  }, [sets, q, year, sort]);

  const filtered = q.trim() !== "" || year !== ALL_YEARS;

  return (
    <>
      <div className="section-head">
        <h2>세트 도감</h2>
        <span className="count">
          {filtered ? `${shown.length} / ${sets.length}` : sets.length}개 세트
        </span>
      </div>

      {/* 검색 + 발행 연도 필터 */}
      <div className="filter-row">
        <div className="searchbar">
          <span className="ico"><SearchIcon /></span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="세트 이름이나 코드로 검색 (예: Base Set, base1, en)"
            aria-label="세트 검색"
          />
          {q && (
            <button className="clear" onClick={() => setQ("")} aria-label="검색어 지우기">
              ×
            </button>
          )}
        </div>

        <select
          className="select-dropdown"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          aria-label="발행 연도"
        >
          <option value={ALL_YEARS}>전체 연도</option>
          {years.map(([y, n]) => (
            <option key={y} value={y}>
              {y}년 ({n})
            </option>
          ))}
        </select>
      </div>

      <div className="chip-row">
        <button className={`chip${sort === "recent" ? " on" : ""}`} onClick={() => setSort("recent")}>
          최신순
        </button>
        <button className={`chip${sort === "name" ? " on" : ""}`} onClick={() => setSort("name")}>
          이름순
        </button>
        <button className={`chip${sort === "size" ? " on" : ""}`} onClick={() => setSort("size")}>
          카드 많은순
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          조건에 맞는 세트가 없습니다.
        </div>
      ) : (
        <div className="set-grid" style={{ marginTop: 24 }}>
          {shown.map((s) => (
            <Link key={`${s.lang}-${s.externalId}`} href={`/sets/${s.externalId}`} className="set-card">
              {/* 아트 슬롯 — 커스텀 이미지는 lib/setArt.ts 에서 지정 */}
              <div className="art">
                <span className="lang">{s.lang}</span>
                {s.artUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.artUrl} alt="" loading="lazy" />
                ) : (
                  <span className="art-slot">
                    <span className="box"><ImageIcon /></span>
                    이미지 준비 중
                  </span>
                )}
              </div>

              <div className="body">
                <span className="name">{s.name}</span>
                <span className="sub">
                  {s.externalId}
                  {s.releaseDate ? ` · ${s.releaseDate}` : ""}
                </span>
                <div className="foot">
                  <span>{s.total ?? s.ingested}장</span>
                  <span className="go">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
