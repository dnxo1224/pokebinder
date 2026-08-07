import Link from "next/link";
import { query } from "@/lib/db";
import CardDeck, { type DeckCard } from "@/components/CardDeck";

export const dynamic = "force-dynamic";

interface PopularRow {
  id: number;
  name: string;
  local_id: string;
  rarity: string | null;
  image_base: string | null;
  set_name: string;
  set_code: string;
}

/**
 * 히어로 덱에 올릴 '인기 카드'.
 * 아직 별도 인기 지표가 없으므로 (1) 바인더에 담긴 횟수 → (2) 레어도 →
 * (3) HP 순으로 정렬한다. 바인더가 쌓일수록 실제 사용 기반 순위가 된다.
 */
async function loadPopular(): Promise<DeckCard[]> {
  try {
    const rows = await query<PopularRow>(
      `SELECT c.id, c.name, c.local_id, c.rarity, c.image_base,
              s.name AS set_name, s.external_id AS set_code
       FROM cards c
       JOIN sets s ON s.id = c.set_id
       LEFT JOIN binder_cards bc ON bc.card_id = c.id
       WHERE c.image_base IS NOT NULL
       GROUP BY c.id, s.name, s.external_id
       ORDER BY COUNT(bc.id) DESC,
                CASE
                  WHEN c.rarity ILIKE '%rare%'     THEN 0
                  WHEN c.rarity ILIKE '%uncommon%' THEN 2
                  WHEN c.rarity ILIKE '%common%'   THEN 3
                  ELSE 1
                END,
                c.hp DESC NULLS LAST,
                c.name
       LIMIT 12`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      localId: r.local_id,
      rarity: r.rarity,
      imageBase: r.image_base,
      setName: r.set_name,
      setCode: r.set_code,
    }));
  } catch (e) {
    console.error("loadPopular failed:", (e as Error).message);
    return [];
  }
}

export default async function HomePage() {
  const cards = await loadPopular();

  return (
    <>
      <section className="hero">
        <span className="eyebrow">Binder Simulator</span>
        <h1>
          모으기 전에
          <br />
          <em>배치</em>해 보세요
        </h1>
        <p>
          도감에서 카드를 고르고 바인더에 올려 보세요. 실물 바인더를 채우기 전에 어떤
          배치가 가장 예쁜지 미리 확인할 수 있습니다.
        </p>
      </section>

      <CardDeck cards={cards} />

      {/* 메인 액션 2종 (ADR-0001 — 도감 / 바인더 제작) */}
      <div className="actions-3">
        <Link href="/dex" className="action-card">
          <h3>도감</h3>
          <p>세트·포켓몬·아티스트 등으로 카드를 찾고 즐겨찾기에 담습니다.</p>
          <span className="go">열기 →</span>
        </Link>

        <Link href="/binders" className="action-card">
          <h3>바인더 제작</h3>
          <p>바인더를 만들고 카드를 배치해 실물 배치를 미리 봅니다.</p>
          <span className="go">열기 →</span>
        </Link>
      </div>
    </>
  );
}
