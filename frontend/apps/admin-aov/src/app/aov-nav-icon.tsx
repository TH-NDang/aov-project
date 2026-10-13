import type { ReactNode } from "react"
import { cn } from "@aov/ui/lib/utils"

const accent = "var(--aov-icon-accent, #b28b44)"

const glyphs = {
  dashboard: (
    <>
      <path d="M12 2.5 21 7v10l-9 4.5L3 17V7Z" />
      <path d="m3 7 9 4.5L21 7M12 11.5v10" />
      <path d="m8 5 9 4.5" stroke={accent} />
    </>
  ),
  storage: (
    <>
      <path d="M4 9h16v11H4ZM3 5h18v4H3Z" />
      <path d="M9 13h6M12 13v3" stroke={accent} />
    </>
  ),
  profile: (
    <>
      <path d="M7 3h10l3 3v15H4V6Z" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M7.5 17c.5-4 8.5-4 9 0" />
      <path d="M9 3h6" stroke={accent} strokeWidth="2.5" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="7.5" r="3" />
      <path d="M6 20v-2a6 6 0 0 1 12 0v2ZM5 6a2.5 2.5 0 0 0 0 5M19 6a2.5 2.5 0 0 1 0 5M2 18v-2a4 4 0 0 1 3-4M22 18v-2a4 4 0 0 0-3-4" />
      <path d="m10 16 2 2 2-2" stroke={accent} />
    </>
  ),
  characterBook: (
    <>
      <path d="M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" />
      <path d="m7.5 7-2 2v4l2 2 2-2V9ZM15 9h3M15 13h3" stroke={accent} />
    </>
  ),
  heroes: (
    <>
      <path d="M5 11V9a7 7 0 0 1 14 0v2l1 8-5 2v-7h-6v7l-5-2Z" />
      <path d="m5 10 4 2M19 10l-4 2" />
      <path d="M12 3v7" stroke={accent} strokeWidth="2" />
    </>
  ),
  skins: (
    <>
      <path d="m8 3-3 4-2 13 5-2 4 3 4-3 5 2-2-13-3-4M8 3c0 5 8 5 8 0M8 8l-1 10M16 8l1 10" />
      <path d="m12 6 2 2-2 2-2-2Z" stroke={accent} fill={accent} fillOpacity="0.15" />
    </>
  ),
  gallery: (
    <>
      <path d="M7 3h14v14M3 7h14v14H3Z" />
      <circle cx="10" cy="12" r="2" />
      <path d="M6 18c.5-3.5 7.5-3.5 8 0" />
      <path d="m19 9 2 2" stroke={accent} />
    </>
  ),
  portrait: (
    <>
      <path d="M5 3h14v18H5Z" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M8 17v-1a4 4 0 0 1 8 0v1" />
      <path d="M9 21h6" stroke={accent} strokeWidth="2.5" />
    </>
  ),
  head: (
    <>
      <path d="M7 3H3v4M17 3h4v4M3 17v4h4M21 17v4h-4" />
      <path d="M8 9a4 4 0 0 1 8 0v3a4 4 0 0 1-8 0Z" />
      <path d="m8 9 4-2 4 2" stroke={accent} />
    </>
  ),
  cover: (
    <>
      <path d="M2 5h20v14H2Z" />
      <path d="m2 17 6-6 5 5 4-4 5 5" />
      <circle cx="16.5" cy="9" r="1.5" stroke={accent} fill={accent} fillOpacity="0.15" />
    </>
  ),
  badges: (
    <>
      <path d="m7 14-2 7 7-3 7 3-2-7M12 2l7 4v7l-7 4-7-4V6Z" />
      <path d="m12 5 3 4-3 4-3-4Z" stroke={accent} fill={accent} fillOpacity="0.12" />
    </>
  ),
  page: (
    <>
      <path d="M5 3h10l4 4v14H5ZM15 3v5h4M8 12h8M8 16h5" />
    </>
  ),
  armory: (
    <>
      <path d="M3 20h18M5 20v-7M19 20v-7M8 3l2 2-3 9-2-1ZM16 3l-2 2 3 9 2-1ZM4 12l5 2M15 14l5-2" />
      <path d="m12 10 3 2v4l-3 2-3-2v-4Z" stroke={accent} fill={accent} fillOpacity="0.12" />
    </>
  ),
  items: (
    <>
      <path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z" />
      <path d="m12 7 3 5-3 5-3-5Z" stroke={accent} fill={accent} fillOpacity="0.12" />
    </>
  ),
  enchantments: (
    <>
      <path d="m12 2 8 5v10l-8 5-8-5V7Z" />
      <path d="m12 6 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" stroke={accent} fill={accent} fillOpacity="0.12" />
    </>
  ),
  arcana: (
    <>
      <path d="m12 3 3 4-3 4-3-4ZM6 11l3 4-3 4-3-4ZM18 11l3 4-3 4-3-4Z" />
      <path d="M10 19h4M12 15v7" stroke={accent} />
    </>
  ),
  spells: (
    <>
      <path d="M6 5a9 9 0 1 0 12 0M8 3h8" />
      <path d="m13 5-6 8h5l-1 6 6-9h-5Z" stroke={accent} fill={accent} fillOpacity="0.12" />
    </>
  ),
  tournaments: (
    <>
      <path d="M7 4h10v6a5 5 0 0 1-10 0ZM7 6H3v2c0 3 2 4 5 4M17 6h4v2c0 3-2 4-5 4M12 15v5M8 21h8" />
      <path d="m12 6 2 3-2 3-2-3Z" stroke={accent} fill={accent} fillOpacity="0.12" />
    </>
  ),
  streams: (
    <>
      <path d="M4 5h16v14H4Z" />
      <path d="m10 9 5 3-5 3Z" stroke={accent} fill={accent} fillOpacity="0.15" />
      <path d="M1 9v6M23 9v6" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type AovNavIconName = keyof typeof glyphs

export function AovNavIcon({ name, className }: { name: AovNavIconName; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("size-6 shrink-0", className)}
    >
      {glyphs[name]}
    </svg>
  )
}
