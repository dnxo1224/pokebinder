import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import NavLinks from "@/components/NavLinks";
import "./globals.css";

// DESIGN-binance.md §Typography — BinanceNova/BinancePlex 대체 폰트.
// 편집 타입은 Inter, 숫자/데이터는 JetBrains Mono(tabular).
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "POKÉBINDER — 포켓몬 카드 바인더",
  description: "포켓몬 TCG 도감 + 바인더 배치 시뮬레이터",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="site-header">
          <div className="nav-bar">
            <Link href="/" className="logo-pill">
              POKÉBINDER
            </Link>
            <NavLinks />
            <div className="nav-right">
              <span className="nav-meta">TCGdex Data</span>
            </div>
          </div>
        </header>

        <main className="container">{children}</main>

        {/* 권리 고지 (§2-1)
            md §footer-light — 다크 본문 아래 밝은 푸터로 페이지를 닫는다 */}
        <footer className="site-footer">
          <div className="inner">
            <span className="fan-badge">FAN PROJECT · NON-COMMERCIAL</span>
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
