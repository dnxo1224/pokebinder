import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "포켓몬 카드 바인더",
  description: "포켓몬 TCG 도감 + 바인더 배치 시뮬레이터",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {/* 커맨드 레이어: 카본 슬랩 + 하프톤 도트 */}
        <header className="site-header">
          <div className="nav-bar">
            <Link href="/" className="logo-pill">
              POKÉBINDER
            </Link>
            <nav className="nav-links">
              <Link href="/sets">SETS</Link>
              <Link href="/binders">BINDERS</Link>
            </nav>
          </div>
        </header>

        {/* 보조 내비 스트립 (pale sky) */}
        <div className="subnav-strip">
          <div className="subnav-inner">
            <span>TCGdex Data</span>
            <span>·</span>
            <span>Non-Commercial Fan Project</span>
          </div>
        </div>

        <main className="container">{children}</main>

        {/* 권리 고지 (§2-1) */}
        <footer className="site-footer">
          <div className="inner">
            <span className="esrb-badge">FAN PROJECT · NON-COMMERCIAL</span>
            <p>
              카드 이미지 및 명칭의 저작권은 The Pokémon Company / Creatures Inc. /
              GAME FREAK inc. / Nintendo 에 있습니다. 본 사이트는 비상업적 팬
              프로젝트이며 데이터는 TCGdex를 통해 제공됩니다.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
