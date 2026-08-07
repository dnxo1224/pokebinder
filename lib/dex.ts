// 도감의 대분류·언어 정의 (ADR-0001)
// 여기가 도감 구조의 단일 출처다. 라우팅·UI·쿼리가 전부 이 상수를 참조한다.

export const LANGS = [
  { value: "en", label: "EN" },
  { value: "ja", label: "JP" },
  { value: "global", label: "GLOBAL" },
] as const;

export type LangValue = (typeof LANGS)[number]["value"];
export const DEFAULT_LANG: LangValue = "en";

export function isLang(v: string | undefined): v is LangValue {
  return !!v && LANGS.some((l) => l.value === v);
}

/** 언어 필터를 SQL 조건으로. global 이면 전 언어 합집합이라 조건이 없다. */
export function langWhere(lang: LangValue, column = "lang"): { sql: string; params: string[] } {
  return lang === "global"
    ? { sql: "TRUE", params: [] }
    : { sql: `${column} = $LANG`, params: [lang] };
}

export type CategoryId =
  | "favorites"
  | "set"
  | "dex"
  | "artist"
  | "trainer"
  | "energy"
  | "etc";

export interface Category {
  id: CategoryId;
  label: string;
  desc: string;
  /** 아직 화면이 없는 대분류는 준비 중으로 표시한다 */
  ready: boolean;
  /**
   * 도감으로 옮기기 전까지 임시로 연결할 기존 화면.
   * 재편 도중에도 기능이 끊기지 않게 하는 다리다. 옮기고 나면 제거한다.
   */
  interimHref?: string;
  /** 임시 분류(라벨링 후 소멸) */
  temporary?: boolean;
}

/**
 * 순서에 의미가 있다.
 *   즐겨찾기(개인) │ 세트·도감번호·아티스트(묶음 축) │ 트레이너·에너지(카드 종류) │ etc(임시)
 */
export const CATEGORIES: Category[] = [
  { id: "favorites", label: "즐겨찾기", desc: "찜해둔 카드를 모아 봅니다.", ready: true },
  {
    id: "set",
    label: "카드 세트",
    desc: "발매 세트별로 카드를 훑어봅니다.",
    ready: false,
    interimHref: "/sets",
  },
  { id: "dex", label: "포켓몬 도감번호", desc: "포켓몬 종별로 카드를 모아 봅니다.", ready: false },
  { id: "artist", label: "아티스트", desc: "카드를 그린 일러스트레이터로 찾습니다.", ready: false },
  { id: "trainer", label: "트레이너", desc: "서포트·아이템·스타디움·도구.", ready: false },
  { id: "energy", label: "에너지", desc: "기본 에너지와 특수 에너지.", ready: false },
  { id: "etc", label: "etc", desc: "아직 분류되지 않은 카드입니다.", ready: false, temporary: true },
];

export function isCategory(v: string | undefined): v is CategoryId {
  return !!v && CATEGORIES.some((c) => c.id === v);
}

/** 도감 링크를 한 곳에서 만든다. 쿼리 키가 흩어지지 않게. */
export function dexHref(params: {
  lang?: LangValue;
  cat?: CategoryId | null;
  q?: string | null;
}): string {
  const sp = new URLSearchParams();
  if (params.lang && params.lang !== DEFAULT_LANG) sp.set("lang", params.lang);
  if (params.cat) sp.set("cat", params.cat);
  if (params.q) sp.set("q", params.q);
  const s = sp.toString();
  return s ? `/dex?${s}` : "/dex";
}
