import type { ReactNode } from "react"

const paths = {
  left: <path d="m14 6-6 6 6 6" />,
  right: <path d="m10 6 6 6-6 6" />,
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="m9 5 10 7-10 7Z" />,
  arrow: <path d="M6 18 18 6M6 6h12v12" />,
  refresh: <path d="M20 7v5h-5M4 17v-5h5M5.6 7A8 8 0 0 1 19 6l1 1M4 17l1 1a8 8 0 0 0 13.4-1" />,
  season: (
    <>
      <path d="m12 3 8 4-1 8-7 6-7-6-1-8Z" />
      <path d="m12 7 4 5-4 5-4-5Z" />
    </>
  ),
} satisfies Record<string, ReactNode>

export function HomeIcon({ name, className }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
