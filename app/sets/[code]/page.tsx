import Link from "next/link";
import { query } from "@/lib/db";
import CardTile from "@/components/CardTile";

export const dynamic = "force-dynamic";

interface CardRow {
  id: number;
  name: string;
  local_id: string;
  rarity: string | null;
  category: string;
  image_base: string | null;
  variant_id: number | null;
}

// Next.js 15: params는 Promise
export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  let cards: CardRow[] = [];
  let setName = code;
  try {
    const setRow = await query<{ name: string }>(
      `SELECT name FROM sets WHERE external_id = $1 LIMIT 1`,
      [code],
    );
    if (setRow[0]) setName = setRow[0].name;

    cards = await query<CardRow>(
      `SELECT c.id, c.name, c.local_id, c.rarity, c.category, c.image_base,
              v.id AS variant_id
       FROM cards c
       JOIN sets s ON s.id = c.set_id
       -- 대표 variant 1개를 붙인다: normal 우선, 없으면 가장 낮은 id
       LEFT JOIN LATERAL (
         SELECT id FROM card_variants cv
         WHERE cv.card_id = c.id
         ORDER BY (cv.variant_type <> 'normal'), cv.id
         LIMIT 1
       ) v ON true
       WHERE s.external_id = $1
       ORDER BY LPAD(regexp_replace(c.local_id, '\\D', '', 'g'), 6, '0'), c.local_id`,
      [code],
    );
  } catch (e) {
    console.error("set detail failed:", (e as Error).message);
  }

  return (
    <>
      <p className="muted">
        <Link href="/sets">← 세트</Link>
      </p>
      <h1>{setName}</h1>
      <p className="muted">
        {code} · {cards.length}장 적재됨
      </p>

      {cards.length === 0 ? (
        <div className="notice">
          이 세트에 적재된 카드가 없습니다. <code>npm run ingest -- --set {code}</code>{" "}
          를 실행하세요. (해당 세트의 언어에 맞춰 <code>--lang</code> 도 지정)
        </div>
      ) : (
        <div className="card-grid">
          {cards.map((c) => (
            <CardTile key={c.id} card={c} />
          ))}
        </div>
      )}
    </>
  );
}
