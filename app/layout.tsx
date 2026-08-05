import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "포켓몬 카드 도감",
  description: "포켓몬 TCG 카드 도감 + 개인 컬렉션 트래커",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            📕 포켓몬 카드 도감
          </Link>
          <nav>
            <Link href="/sets">세트</Link>
            <Link href="/collection">내 컬렉션</Link>
          </nav>
        </header>

        <main className="container">{children}</main>

        {/* §2-1 권리 고지 (팬사이트 관행) */}
        <footer className="site-footer">
          <p>
            카드 이미지 및 명칭의 저작권은 The Pokémon Company / Creatures Inc. /
            GAME FREAK inc. / Nintendo 에 있습니다. 본 사이트는 비상업적 팬
            프로젝트이며 데이터는 TCGdex를 통해 제공됩니다.
          </p>
        </footer>
      </body>
    </html>
  );
}
