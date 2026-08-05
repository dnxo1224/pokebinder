import Link from "next/link";

export default function HomePage() {
  return (
    <>
      {/* 히어로 플레이트 + 박스아트 워드마크 */}
      <section className="hero-panel">
        <h1 className="display-word">POKÉBINDER</h1>
        <p className="hero-tagline">
          도감에서 카드를 골라 내 바인더에 배치해 보세요. 실물 바인더를 채우기 전에
          미리 시뮬레이션합니다.
        </p>
      </section>

      <div className="tiles-home">
        <Link href="/sets" className="home-card">
          <h2 className="display-word sm">SETS</h2>
          <p className="micro">세트별 카드 도감을 열고 바인더에 추가합니다.</p>
        </Link>
        <Link href="/binders" className="home-card">
          <h2 className="display-word sm">BINDERS</h2>
          <p className="micro">바인더를 만들고 크기를 정하고 배치를 확인합니다.</p>
        </Link>
      </div>
    </>
  );
}
