import type { ReactNode } from "react"
import { cn } from "../lib/utils"

export type HeroLane = "TOP" | "JUNGLE" | "MID" | "DRAGON" | "SUPPORT"

const shapes: Record<HeroLane, ReactNode> = {
  TOP: (
    <>
      <path d="M5 5h35l-8 8H13v19l-8 8Z" />
      <circle cx="27" cy="25" r="7" />
      <path d="M43 15v28H15" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  JUNGLE: (
    <>
      <rect x="5" y="5" width="38" height="38" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M13 11h18L11 31V13a2 2 0 0 1 2-2Zm22 26H17l20-20v18a2 2 0 0 1-2 2Z" />
    </>
  ),
  MID: (
    <>
      <path d="M5 35 35 5h8v8L13 43H5Z" />
      <path d="M5 25V5h20m-2 38h20V23" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  DRAGON: (
    <>
      <path d="M43 8v35H8l8-8h19V16Z" />
      <circle cx="21" cy="23" r="7" />
      <path d="M33 5H5v28" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  SUPPORT: (
    <>
      <path d="m2 3 15 14 1 8-10-6-4-7Zm44 0L31 17l-1 8 10-6 4-7ZM3 18l15 9 1 7-10-5-4-5Zm42 0-15 9-1 7 10-5 4-5ZM8 31l12 5 4 10-11-7Zm32 0-12 5-4 10 11-7Z" />
      <path d="m24 13 6 12-6 8-6-8Z" />
    </>
  ),
}

/** Transparent lane artwork inherits the caller's text color. */
export function HeroLaneIcon({
  lane,
  size = 20,
  label,
  className,
}: {
  lane: HeroLane
  size?: number
  label?: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="currentColor"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={cn("inline-block shrink-0", className)}
    >
      {label && <title>{label}</title>}
      {shapes[lane]}
    </svg>
  )
}
