import type { ReactNode } from "react"

const PATHS = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.1" />
    </>
  ),
  feedback: (
    <>
      <path d="M20 14v6H4V4h10m0 0 2-2 6 6-2 2-6-6Zm-1 1-5 5-1 4 4-1 5-5M7 17h7" />
    </>
  ),
  imagePlus: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8" cy="9" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 5 5M16 7h4m-2-2v4" />
    </>
  ),
  season: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 3h2" />
    </>
  ),
  patch: (
    <>
      <path d="M7 6v8a5 5 0 0 0 5 5h4M7 8h5a5 5 0 0 0 5-3" />
      <circle cx="7" cy="4" r="2" />
      <circle cx="17" cy="3" r="2" />
      <circle cx="18" cy="19" r="2" />
    </>
  ),
  hero: (
    <>
      <path d="m12 3 7 6-2 10-5 3-5-3L5 9Z" />
      <path d="m8 10 4 2 4-2m-4-7v9m-3 2 1 3m5-3-1 3" />
    </>
  ),
  skin: (
    <>
      <path d="M3 6c4 2 5 0 9-1 4 1 5 3 9 1l-2 10-7 5-7-5Z" />
      <path d="m6 10 4 1-1 2-3-1m12-2-4 1 1 2 3-1m-8 4h4" />
    </>
  ),
  items: (
    <>
      <path d="m5 3 13 13-2 2L3 5V3Zm10 10 5 5m-7-3 5 5m-2-2 3 3" />
      <path d="m19 3-6 6m-4 4-6 6m2-4 4 4" />
    </>
  ),
  enchantments: (
    <>
      <path d="m12 2 8 8-8 12-8-12Z" />
      <path d="m12 6 4 4-4 7-4-7Zm-8 4h4m8 0h4M12 2v4" />
    </>
  ),
  arcana: (
    <>
      <path d="m12 3 8 5v8l-8 5-8-5V8Z" />
      <path d="m12 7 4 5-4 5-4-5Zm-8 1 4 4m8 0 4-4m-8 9v4" />
    </>
  ),
  spells: <path d="m14 2-9 12h6l-1 8 9-13h-6Z" />,
  collection: (
    <>
      <rect x="6" y="6" width="13" height="16" rx="2" />
      <path d="M15 3H5a2 2 0 0 0-2 2v13m9-8 3 4-3 4-3-4Z" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h12a2 2 0 0 1 2 2v14H7a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Z" />
      <path d="M7 4v13m-3 0h15m-9-9h6m-6 4h4" />
    </>
  ),
  badge: (
    <>
      <path d="m12 3 8 5v7l-8 6-8-6V8Z" />
      <path d="m12 7 2 3 3 1-2 3v3l-3-1-3 1v-3l-2-3 3-1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  open: (
    <>
      <path d="M14 4h6v6m0-6-9 9M9 4H4v16h16v-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />,
  reset: <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />,
  all: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  switch: <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
  chevronRight: <path d="m10 8 4 4-4 4" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  contents: <path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1" />,
  map: (
    <>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2Zm6-2v14m6-12v14" />
      <path d="m5 13 2-3m4-1 2 3m4 2 2-3" />
    </>
  ),
  mode: (
    <>
      <path d="M5 22V4m0 1c6-5 8 4 15 0v11c-7 4-9-5-15 0" />
      <path d="m10 8 5 2-5 2Z" />
    </>
  ),
} satisfies Record<string, ReactNode>
export type WikiIconName = keyof typeof PATHS
export function WikiIcon({ name, size = 20, className }: { name: WikiIconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
