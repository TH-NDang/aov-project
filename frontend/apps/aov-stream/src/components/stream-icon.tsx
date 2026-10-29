const paths = {
  trophy: "M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v4a4 4 0 0 0 4 4m8-8h4v4a4 4 0 0 1-4 4m-4 1v6m-4 1h8",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  back: "M20 12H4m6-6-6 6 6 6",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  play: "m9 5 11 7-11 7V5Z",
  users: "M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9v-2a6 6 0 0 1 12 0v2m2-17a4 4 0 0 1 0 8m1 3a6 6 0 0 1 5 6",
  sword: "m4 3 14 14-2 2L2 5V3h2m11 12 5 5m-7-3 5 5m-2-2 3 3",
  shield: "m12 3 8 4v5c0 4-3 7-8 10-5-3-8-6-8-10V7l8-4Z",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z",
  search: "M16 16l5 5m-3-11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  external: "M14 3h7v7m0-7-11 11M10 3H3v18h18v-7",
  info: "M12 10v7m0-11v.1m9 6a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  ban: "m5 5 14 14m2-7a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  plus: "M12 5v14M5 12h14",
  reset: "M4 10a8 8 0 1 1 1 8M4 4v6h6",
  list: "M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1",
} as const

export function StreamIcon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
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
      <path d={paths[name]} />
    </svg>
  )
}
