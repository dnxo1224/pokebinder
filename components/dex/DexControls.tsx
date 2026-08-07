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
}: {
  lang: LangValue;
  cat: CategoryId | null;
  q: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [draft, setDraft] = useState(q);

  // 뒤로가기 등으로 URL이 바뀌면 입력창도 따라간다
  useEffect(() => setDraft(q), [q]);

  function push(next: { lang?: LangValue; q?: string }) {
    const sp = new URLSearchParams(params.toString());

    if (next.lang !== undefined) {
      if (next.lang === DEFAULT_LANG) sp.delete("lang");
      else sp.set("lang", next.lang);
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
            cat ? "이 분류 안에서 카드·아티스트 검색" : "먼저 분류를 고르면 그 안에서 검색합니다"
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
