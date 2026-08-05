import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <h1>포켓몬 카드 도감</h1>
      <p className="muted">
        전체 카드를 도감으로 보고, 내가 보유한 카드를 variant 단위로 기록합니다.
      </p>

      <div className="tiles-home">
        <Link href="/sets" className="home-card">
          <h2>세트 둘러보기 →</h2>
          <p className="muted">세트별 카드 그리드와 수집 진척도를 확인합니다.</p>
        </Link>
        <Link href="/collection" className="home-card">
          <h2>내 컬렉션 →</h2>
          <p className="muted">보유 중인 카드와 수량을 확인합니다.</p>
        </Link>
      </div>
    </>
  );
}
