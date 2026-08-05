import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEMO_USER_ID = 1; // API와 동일한 데모 사용자

interface OwnedRow {
  name: string;
  local_id: string;
  variant_type: string;
  quantity: number;
  image_base: string | null;
  set_name: string;
}

export default async function CollectionPage() {
  let owned: OwnedRow[] = [];
  let dbError = false;
  try {
    owned = await query<OwnedRow>(
      `SELECT c.name, c.local_id, v.variant_type, uc.quantity,
              c.image_base, s.name AS set_name
       FROM user_collection uc
       JOIN card_variants v ON v.id = uc.variant_id
       JOIN cards c ON c.id = v.card_id
       JOIN sets s ON s.id = c.set_id
       WHERE uc.user_id = $1 AND uc.quantity > 0
       ORDER BY s.name, c.local_id`,
      [DEMO_USER_ID],
    );
  } catch (e) {
    console.error("collection failed:", (e as Error).message);
    dbError = true;
  }

  const totalCards = owned.reduce((n, r) => n + r.quantity, 0);

  return (
    <>
      <h1>내 컬렉션</h1>
      {dbError ? (
        <div className="notice">
          데이터베이스에 연결하지 못했습니다. DB를 띄우고 마이그레이션했는지 확인하세요.
        </div>
      ) : owned.length === 0 ? (
        <div className="notice">
          아직 보유로 표시한 카드가 없습니다. <a href="/sets">세트</a>에서 카드의 +
          버튼을 눌러 수량을 등록하세요.
        </div>
      ) : (
        <>
          <p className="muted">
            {owned.length}종 · 총 {totalCards}장
          </p>
          <div className="card-grid">
            {owned.map((r, i) => (
              <div className="card-tile" key={i}>
                <div className="imgwrap">
                  {r.image_base ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${r.image_base}/low.webp`} alt={r.name} loading="lazy" />
                  ) : (
                    <span className="noimg">이미지 없음</span>
                  )}
                </div>
                <div className="body">
                  <div className="cname">{r.name}</div>
                  <div className="cmeta">
                    {r.set_name} · {r.local_id} · {r.variant_type} ×{r.quantity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
