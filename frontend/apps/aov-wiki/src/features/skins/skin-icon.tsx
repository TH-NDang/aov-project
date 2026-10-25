import type { ReactNode } from "react"

const PATHS = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  open: <path d="M14 4h6v6m0-6-9 9M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />,
  collection: (
    <>
      <path d="M5 18H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10v1" />
      <rect x="7" y="6" width="14" height="16" rx="2" />
      <path d="m14 10 3 4-3 4-3-4Z" />
    </>
  ),
  hero: (
    <>
      <path d="m12 3 7 5-1.5 9-5.5 4-5.5-4L5 8Z" />
      <path d="m8 10 4 2 4-2m-4-7v9m-3 3 3 2 3-2" />
    </>
  ),
  badge: (
    <>
      <path d="m12 3 7 4v5c0 4-7 9-7 9s-7-5-7-9V7Z" />
      <path d="m12 7 3 5-3 5-3-5Z" />
    </>
  ),
  reset: <path d="M3 10a9 9 0 1 1 1.7 8M3 4v6h6" />,
} satisfies Record<string, ReactNode>

export type SkinIconName = keyof typeof PATHS

export function SkinIcon({ name, className, size = 20 }: { name: SkinIconName; className?: string; size?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
