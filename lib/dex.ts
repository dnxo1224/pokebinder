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
  /** 임시 분류(라벨링 후 소멸) */
  temporary?: boolean;
}

/**
 * 순서에 의미가 있다.
 *   즐겨찾기(개인) │ 세트·도감번호·아티스트(묶음 축) │ 트레이너·에너지(카드 종류) │ etc(임시)
 */
export const CATEGORIES: Category[] = [
  { id: "favorites", label: "즐겨찾기", desc: "찜해둔 카드를 모아 봅니다.", ready: true },
  { id: "set", label: "카드 세트", desc: "발매 세트별로 카드를 훑어봅니다.", ready: true },
  { id: "dex", label: "포켓몬 도감번호", desc: "포켓몬 종별로 카드를 모아 봅니다.", ready: true },
  { id: "artist", label: "아티스트", desc: "카드를 그린 일러스트레이터로 찾습니다.", ready: true },
  { id: "trainer", label: "트레이너", desc: "서포트·아이템·도구·스타디움.", ready: true },
  { id: "energy", label: "에너지", desc: "기본 에너지와 특수 에너지.", ready: true },
  { id: "etc", label: "etc", desc: "아직 분류되지 않은 카드입니다.", ready: true, temporary: true },
];

export function isCategory(v: string | undefined): v is CategoryId {
  return !!v && CATEGORIES.some((c) => c.id === v);
}

/**
 * 대분류 안에서 하나를 고른 상태(3단)를 가리키는 쿼리 키.
 * 대분류마다 키가 다르므로 여기서만 정의한다.
 */
export const PICK_KEY: Partial<Record<CategoryId, string>> = {
  set: "set",
  dex: "dex",
  artist: "artist",
  trainer: "type",
  energy: "type",
};

/**
 * 트레이너 하위 타입. 순서에 의미가 있어 개수순이 아니라 이 순서로 보여준다.
 *
 * '클래식'은 trainer_type 이 NULL 인 카드다. Item/Supporter/Stadium 구분이
 * EX 시대(2003+)에 생긴 개념이라 그 전 카드에는 존재하지 않는다 — 결손이 아니다.
 * 특정 시대에만 쓰인 희귀 타입(Rocket's Secret Machine 5장, Technical Machine 4장)도
 * 별도 묶음으로 노출하지 않고 여기 접는다. (ADR-0001)
 */
export const TRAINER_TYPES = ["Supporter", "Item", "Tool", "Stadium"] as const;
export const TRAINER_LABEL: Record<string, string> = {
  Supporter: "서포트",
  Item: "아이템",
  Tool: "도구",
  Stadium: "스타디움",
  classic: "클래식",
};

/** 에너지 하위 타입. energy_type 이 없는 카드는 '기타'로 접는다. */
export const ENERGY_TYPES = ["Normal", "Special"] as const;
export const ENERGY_LABEL: Record<string, string> = {
  Normal: "기본 에너지",
  Special: "특수 에너지",
  other: "기타",
};

/** 위 두 목록에 없는 값을 모으는 자리 */
export const FALLBACK_TYPE = { trainer: "classic", energy: "other" } as const;

/**
 * 카드 그리드 한 쪽에 담는 장수.
 * 아티스트 한 명이 1,767장인 경우가 있어(5ban Graphics) 전부 한 번에 그리면
 * HTML 이 5.7MB / 5초가 된다. 나눠서 보낸다.
 */
export const PAGE_SIZE = 120;

/** 도감 링크를 한 곳에서 만든다. 쿼리 키가 흩어지지 않게. */
export function dexHref(params: {
  lang?: LangValue;
  cat?: CategoryId | null;
  /** 3단으로 들어갈 때의 값 (세트 코드 / 도감번호 / 아티스트명) */
  pick?: string | null;
  q?: string | null;
  /** 1-based. 1쪽은 쿼리에 남기지 않는다. */
  page?: number | null;
}): string {
  const sp = new URLSearchParams();
  if (params.lang && params.lang !== DEFAULT_LANG) sp.set("lang", params.lang);
  if (params.cat) sp.set("cat", params.cat);
  if (params.cat && params.pick) {
    const key = PICK_KEY[params.cat];
    if (key) sp.set(key, params.pick);
  }
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page > 1) sp.set("p", String(params.page));
  const s = sp.toString();
  return s ? `/dex?${s}` : "/dex";
}
