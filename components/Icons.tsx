// 최소 라인 아이콘. 이모지 대신 쓴다.
// currentColor 를 따르므로 색은 부모에서 정한다.

export function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function StarIcon({ size = 16, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2.6l2.3 4.66 5.15.75-3.73 3.63.88 5.13L10 14.35l-4.6 2.42.88-5.13L2.55 8.01l5.15-.75L10 2.6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3.5 5.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M7.5 5.5V4.25c0-.55.45-1 1-1h3c.55 0 1 .45 1 1V5.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.5 5.5l.7 10.1c.04.5.46.9.97.9h5.66c.5 0 .93-.4.97-.9l.7-10.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 8.5v5M11.5 8.5v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ImageIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.5" cy="8" r="1.25" fill="currentColor" />
      <path d="M3.5 14.5 8 10.5l3 2.5 2.5-2 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
