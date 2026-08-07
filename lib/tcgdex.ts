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
  dexId?: number[]; // 폼 변형은 소수(예: 384.1) — DB는 NUMERIC[]로 받는다
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

/** 대량 적재 중 일시적 네트워크 오류/5xx 는 흔하다. 지수 백오프로 몇 번 더 시도한다. */
async function get<T>(path: string, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        // 429/5xx 는 재시도 가치가 있고, 4xx(경로 문제)는 재시도해도 소용없다
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`TCGdex ${res.status} on ${path}`);
        }
        throw Object.assign(new Error(`TCGdex ${res.status} on ${path}`), { retryable: false });
      }
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if ((e as { retryable?: boolean }).retryable === false) break;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastErr;
}

// 세트/카드 id 는 그대로 URL에 못 넣는다. 예: ja 세트 id 'SM1+' 의 '+' 는 raw 404,
// en 카드 id 'exu-%3F' 는 TCGdex 가 '?' 문자를 아예 리터럴 '%3F' 문자열로 id에 박아둬서
// (실제 문자 '?' 가 아니라 %,3,F 세 글자) 그대로 보내면 서버가 쿼리 구분자로 오인한다.
// encodeURIComponent 로 감싸면 두 경우 다 정상 매칭된다.
const seg = encodeURIComponent;

export const getSets = (lang: string) => get<SetBrief[]>(`/${seg(lang)}/sets`);
export const getSet = (lang: string, id: string) =>
  get<SetDetail>(`/${seg(lang)}/sets/${seg(id)}`);
export const getCard = (lang: string, id: string) =>
  get<CardFull>(`/${seg(lang)}/cards/${seg(id)}`);
