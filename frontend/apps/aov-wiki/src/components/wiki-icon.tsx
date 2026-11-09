import type { ReactNode } from "react"
import { catalogIcons } from "@aov/ui/components/catalog-icons"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"

const { heroes: hero, skins: skin, ...warehouseIcons } = catalogIcons
const sectionIcons = {
  hero,
  skin,
  ...warehouseIcons,
  updates: navArtIcons.releases,
  terms: navArtIcons.glossary,
  mode: navArtIcons.gameModes,
}
type SectionIcon = keyof typeof sectionIcons

const PATHS = {
  sort: <path d="M6 4v15m-3-3 3 3 3-3M12 5h9m-9 6h6m-6 6h3" />,
  settings: <path d="M4 7h7m4 0h5M4 17h3m4 0h9M11 5v4m-4 6v4" />,
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
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  play: <path d="m8 5 11 7-11 7Z" />,
  external: <path d="M14 4h6v6m0-6-9 9m7 1v6H4V6h6" />,
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
  coins: (
    <>
      <circle cx="9" cy="9" r="6" />
      <path d="M17.5 10.5a6 6 0 1 1-7 7" />
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
  chevronLeft: <path d="m14 8-4 4 4 4" />,
  rows: <path d="M4 7h16M4 12h16M4 17h16" />,
  copy: <path d="M9 9h10v11H9zM6 15H5V4h10v1" />,
  plus: <path d="M12 5v14M5 12h14" />,
  share: <path d="M4 13v6h16v-6M12 3v12M7.5 7.5 12 3l4.5 4.5" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  /** A broom, tilted as if sweeping: handle, binding, a fanned head with bristles. Clears without deleting. */
  broom: (
    <g transform="translate(12 12) rotate(30) scale(0.9) translate(-12 -12)">
      <path d="M12 2v8.5" />
      <path d="M8.5 10.5h7l.5 2.5H8Z" />
      <path d="M8 13 5.5 21h13L16 13" />
      <path d="m10 15.5-.7 5.5M12 15.5V21M14 15.5l.7 5.5" />
    </g>
  ),
  clipboard: <path d="M9 4h6v3H9zM8 5.5H6v14.5h12V5.5h-2M9 12h6M9 15.5h4" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />,
  /** Cards in a grid. */
  cards: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  /** Stats: three bars rising from a baseline. */
  stats: (
    <>
      <path d="M3.5 20h17" />
      <rect x="5" y="13" width="3.5" height="7" rx="1" />
      <rect x="10.25" y="8.5" width="3.5" height="11.5" rx="1" />
      <rect x="15.5" y="4" width="3.5" height="16" rx="1" />
    </>
  ),
  /** A list beside an open entry. */
  detail: <path d="M3 5h18v14H3zM10 5v14M5 8.5h3M5 12h3M5 15.5h3M13 9h5M13 12.5h5M13 16h3" />,
  /** A board of three rows of square cells. */
  chessboard: <path d="M3 6h18v12H3zM3 10h18M3 14h18M7.5 6v12M12 6v12M16.5 6v12" />,
  /** A table of rows and columns. */
  table: <path d="M3 5h18v14H3zM3 10h18M3 14.5h18M8 5v14M13.5 5v14" />,
  board: <path d="M4 5h5v5H4zM15 5h5v5h-5zM15 14h5v5h-5zM9 7.5h6M9 7.5l6 9" />,
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
} satisfies Record<string, ReactNode>
export type WikiIconName = keyof typeof PATHS | SectionIcon

function isSectionIcon(name: WikiIconName): name is SectionIcon {
  return name in sectionIcons
}

export function WikiIcon({ name, size = 20, className }: { name: WikiIconName; size?: number; className?: string }) {
  if (isSectionIcon(name)) {
    const Icon = sectionIcons[name]
    return <Icon size={size} className={className} />
  }
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
