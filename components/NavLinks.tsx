"use client";
// 헤더 내비. 현재 경로에 해당하는 항목을 강조한다.
import Link from "next/link";
import { usePathname } from "next/navigation";

// ADR-0001 — 서비스는 도감/바인더 제작 두 축이다.
const ITEMS = [
  { href: "/dex", label: "도감" },
  { href: "/binders", label: "바인더 제작" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="nav-links">
      {ITEMS.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={active ? "active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
