import Link from "next/link";
import { query } from "@/lib/db";
import CardTile from "@/components/CardTile";
import { ImageIcon } from "@/components/Icons";
import { setArtFor } from "@/lib/setArt";

export const dynamic = "force-dynamic";

interface CardRow {
  id: number;
  name: string;
  local_id: string;
  rarity: string | null;
  category: string;
  image_base: string | null;
  types: string[] | null;
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
  let artUrl: string | null = null;
  let releaseDate: string | null = null;

  try {
    const setRow = await query<{
      name: string;
      logo_url: string | null;
      release_date: string | null;
    }>(
      `SELECT name, logo_url, to_char(release_date, 'YYYY-MM-DD') AS release_date
       FROM sets WHERE external_id = $1 LIMIT 1`,
      [code],
    );
    if (setRow[0]) {
      setName = setRow[0].name;
      artUrl = setArtFor(code, setRow[0].logo_url);
      releaseDate = setRow[0].release_date;
    }

    cards = await query<CardRow>(
      `SELECT c.id, c.name, c.local_id, c.rarity, c.category, c.image_base, c.types
       FROM cards c
       JOIN sets s ON s.id = c.set_id
       WHERE s.external_id = $1
       ORDER BY LPAD(regexp_replace(c.local_id, '\\D', '', 'g'), 6, '0'), c.local_id`,
      [code],
    );
  } catch (e) {
    console.error("set detail failed:", (e as Error).message);
  }

  return (
    <>
      <section className="detail-head">
        <div className="sym">
          {artUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artUrl} alt="" />
          ) : (
            <span style={{ color: "var(--muted)" }}><ImageIcon size={22} /></span>
          )}
        </div>
        <div>
          <Link href="/sets" className="back-link">
            ← 세트 도감
          </Link>
          <h1>{setName}</h1>
          <div className="sub">
            {code} · {cards.length}장 적재됨
            {releaseDate ? ` · ${releaseDate}` : ""}
          </div>
        </div>
      </section>

      <div className="section-head">
        <h2>카드</h2>
        <span className="count">{cards.length}장</span>
      </div>

      {cards.length === 0 ? (
        <div className="info-box">
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
