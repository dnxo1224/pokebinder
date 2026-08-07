"use client";
// 도감 상단: 언어 선택 + 검색창. 상태는 전부 URL 쿼리에 실린다.
// (새로고침·뒤로가기·링크 공유가 그대로 동작하도록)
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchIcon } from "../Icons";
import { LANGS, DEFAULT_LANG, type LangValue, type CategoryId } from "@/lib/dex";

export default function DexControls({
  lang,
  cat,
  q,
  pick,
}: {
  lang: LangValue;
  cat: CategoryId | null;
  q: string;
  /** 3단으로 들어간 상태인지 (세트 코드 / 도감번호 / 아티스트명) */
  pick?: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [draft, setDraft] = useState(q);

  // 뒤로가기 등으로 URL이 바뀌면 입력창도 따라간다
  useEffect(() => setDraft(q), [q]);

  function push(next: { lang?: LangValue; q?: string }) {
    const sp = new URLSearchParams(params.toString());
    // 조건이 바뀌면 결과 수가 달라진다. 5쪽에 있다가 검색하면 빈 쪽이 나오므로 되돌린다.
    sp.delete("p");

    if (next.lang !== undefined) {
      if (next.lang === DEFAULT_LANG) sp.delete("lang");
      else sp.set("lang", next.lang);
      // 세트 코드는 언어마다 다르다(base1 은 EN 전용). 언어를 바꾸면 그 세트가
      // 존재하지 않아 빈 화면이 되므로 목록으로 되돌린다.
      // 도감번호·아티스트는 언어를 건너 유효하므로 그대로 둔다.
      if (cat === "set") sp.delete("set");
    }
    if (next.q !== undefined) {
      if (next.q.trim()) sp.set("q", next.q.trim());
      else sp.delete("q");
    }
    const s = sp.toString();
    router.push(s ? `/dex?${s}` : "/dex");
  }

  return (
    <div className="dex-controls">
      <div className="chip-row">
        {LANGS.map((l) => (
          <button
            key={l.value}
            className={`chip${lang === l.value ? " on" : ""}`}
            onClick={() => push({ lang: l.value })}
          >
            {l.label}
          </button>
        ))}
      </div>

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: draft });
        }}
      >
        <span className="ico"><SearchIcon /></span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            !cat
              ? "먼저 분류를 고르면 그 안에서 검색합니다"
              : pick
                ? "이 안에서 카드·아티스트 검색"
                : "목록에서 검색"
          }
          aria-label="도감 검색"
          disabled={!cat}
        />
        {draft && (
          <button
            type="button"
            className="clear"
            onClick={() => { setDraft(""); push({ q: "" }); }}
            aria-label="검색어 지우기"
          >
            ×
          </button>
        )}
      </form>
    </div>
  );
}
