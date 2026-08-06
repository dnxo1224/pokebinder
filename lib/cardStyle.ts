// 포켓몬 타입 → 카드 식별 색.
// globals.css 의 --t-* 토큰과 1:1 대응.
// DESIGN-binance.md 는 두 번째 브랜드 색을 금지하므로, 이 색들은 코인 아이콘의
// 브랜드 색과 같은 '콘텐츠 식별자' 역할로만 쓴다 — 6px 스와치 글리프 한 곳.
// 배경 글로우나 그라데이션으로는 쓰지 않는다.
const TYPE_AURA: Record<string, string> = {
  Grass: "var(--t-grass)",
  Fire: "var(--t-fire)",
  Water: "var(--t-water)",
  Lightning: "var(--t-lightning)",
  Psychic: "var(--t-psychic)",
  Fighting: "var(--t-fighting)",
  Colorless: "var(--t-colorless)",
  Darkness: "var(--t-darkness)",
  Metal: "var(--t-metal)",
  Dragon: "var(--t-dragon)",
  Fairy: "var(--t-fairy)",
};

// 트레이너/에너지처럼 types가 없는 카드용 폴백
const CATEGORY_AURA: Record<string, string> = {
  Trainer: "var(--t-colorless)",
  Energy: "var(--t-metal)",
};

/** 카드 한 장의 식별 색을 고른다. 첫 번째 타입 → 카테고리 → 무채색 순. */
export function auraFor(types: string[] | null, category?: string | null): string {
  const t = types?.find((x) => TYPE_AURA[x]);
  if (t) return TYPE_AURA[t];
  if (category && CATEGORY_AURA[category]) return CATEGORY_AURA[category];
  return "var(--muted)";
}

/** 'Rare Holo' 같은 값도 rare로 본다. 배지 강조용. */
export function isRare(rarity: string | null): boolean {
  return !!rarity && /rare|holo|secret|ultra|illustration/i.test(rarity);
}
