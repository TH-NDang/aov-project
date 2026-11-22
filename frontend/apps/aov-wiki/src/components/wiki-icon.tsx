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
      {/* A rounded pen resting on the corner of an open page: suggest a change to what is written. */}
      <path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12" />
      <path d="M17.6 3.4a1.9 1.9 0 0 1 2.7 2.7l-7.6 7.6a2 2 0 0 1-.9.5l-2.6.7.7-2.6a2 2 0 0 1 .5-.9Z" />
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
  /** A cut gem: a skin's grade. Girdle and two facets only, so it still reads at 16px. */
  badge: (
    <>
      <path d="M7 4h10l4.5 5.5L12 20.5 2.5 9.5Z" />
      <path d="M2.5 9.5h19M9.5 4 8 9.5l4 11 4-11L14.5 4" />
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
      <circle cx="8.25" cy="8.25" r="6" />
      <path d="M16.75 9.75a6 6 0 1 1-7 7" />
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
  chevron: <path d="m7 9.5 5 5 5-5" />,
  // The marks of a change: stronger, weaker, remade.
  stronger: <path d="m7 12.5 5-5 5 5M7 18l5-5 5 5" />,
  weaker: <path d="m7 6 5 5 5-5M7 11.5l5 5 5-5" />,
  remade: (
    <path d="M19.5 10.5A7.5 7.5 0 0 0 6 6.6L4.5 8.2M4.5 4v4.2h4.2M4.5 13.5A7.5 7.5 0 0 0 18 17.4l1.5-1.6m0 4.2v-4.2h-4.2" />
  ),
  chevronRight: <path d="m9.5 7 5 5-5 5" />,
  chevronLeft: <path d="m14.5 7-5 5 5 5" />,
  rows: <path d="M4 7h16M4 12h16M4 17h16" />,
  copy: <path d="M9 9h10v11H9zM6 15H5V4h10v1" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  share: <path d="M4 13v6h16v-6M12 3v12M7.5 7.5 12 3l4.5 4.5" />,
  /** A broom, tilted as if sweeping: handle, binding, a fanned head with bristles. Clears without deleting. */
  broom: (
    <g transform="translate(14.3 10.9) rotate(30) scale(0.9) translate(-12 -12)">
      <path d="M12 2v8.5" />
      <path d="M8.5 10.5h7l.5 2.5H8Z" />
      <path d="M8 13 5.5 21h13L16 13" />
      <path d="m10 15.5-.7 5.5M12 15.5V21M14 15.5l.7 5.5" />
    </g>
  ),
  clipboard: <path d="M9 4h6v3H9zM8 5.5H6v14.5h12V5.5h-2M9 12h6M9 15.5h4" />,
  /** Paste: a clipboard with an arrow coming down into it. */
  paste: <path d="M9 4h6v3H9zM8 5.5H6v14.5h12V5.5h-2M12 10v6.5m-3-3 3 3 3-3" />,
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
