// TCGdex v2 REST 클라이언트 (API 키 불필요)
// 문서 §2-4/§5: 이미지는 여기서 오는 card.image 값을 그대로 저장한다. URL을 조립하지 말 것.

const BASE = "https://api.tcgdex.net/v2";

/** GET /v2/{lang}/sets 의 목록 아이템 (brief) */
export interface SetBrief {
  id: string;
  name: string;
  cardCount?: { total?: number; official?: number };
}

/** GET /v2/{lang}/sets/{id} (detail) — cards는 brief 배열 */
export interface SetDetail {
  id: string;
  name: string;
  serie?: { id: string; name: string };
  abbreviation?: { official?: string };
  cardCount?: { total?: number; official?: number };
  releaseDate?: string;
  logo?: string;
  symbol?: string;
  legal?: { standard?: boolean; expanded?: boolean };
  cards: CardBrief[];
}

export interface CardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

/** GET /v2/{lang}/cards/{id} (full) — 스키마 §4의 cards 컬럼에 대응 */
export interface CardFull {
  id: string;
  localId: string;
  name: string;
  category: "Pokemon" | "Trainer" | "Energy";
  rarity?: string;
  illustrator?: string;
  image?: string; // ★ 원본 그대로 저장
  dexId?: number[];
  hp?: number;
  types?: string[];
  stage?: string;
  evolveFrom?: string;
  suffix?: string;
  regulationMark?: string;
  retreat?: number;
  abilities?: unknown;
  attacks?: unknown;
  weaknesses?: unknown;
  resistances?: unknown;
  description?: string;
  legal?: { standard?: boolean; expanded?: boolean };
  updated?: string;
  variants?: Record<string, boolean>; // { normal, holo, reverse, firstEdition, wPromo }
  variants_detailed?: { type: string; variantId?: string }[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TCGdex ${res.status} on ${path}`);
  return (await res.json()) as T;
}

export const getSets = (lang: string) => get<SetBrief[]>(`/${lang}/sets`);
export const getSet = (lang: string, id: string) =>
  get<SetDetail>(`/${lang}/sets/${id}`);
export const getCard = (lang: string, id: string) =>
  get<CardFull>(`/${lang}/cards/${id}`);
