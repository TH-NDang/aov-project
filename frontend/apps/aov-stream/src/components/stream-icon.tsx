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
  logout: "M10 4H5v16h5m4-12 4 4-4 4m4-4H9",
  heart: "M12 20s-7.5-4.6-9.2-9.4A4.9 4.9 0 0 1 12 6.9a4.9 4.9 0 0 1 9.2 3.7C19.5 15.4 12 20 12 20Z",
  home: "M3 11 12 4l9 7M5 9.5V20h5v-6h4v6h5V9.5",
  gamepad:
    "M7 6h10a5 5 0 0 1 5 5v1.5a3.5 3.5 0 0 1-6.3 2.1L14.5 13h-5l-1.2 1.6A3.5 3.5 0 0 1 2 12.5V11a5 5 0 0 1 5-5Zm1 3v4m-2-2h4m5-.5h.1m1.9 2h.1",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  building: "M4 21V5l8-2v18m0-12h8v12M3 21h18M8 8h.1M8 12h.1M8 16h.1M16 13h.1M16 17h.1",
  message: "M4 5h16v11H9l-5 4V5Z",
  flag: "M5 21V4m0 0h12l-2.5 4 2.5 4H5",
  edit: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  eyeOff:
    "m3 3 18 18M10.6 6.1 12 6c5 0 9 6 9 6a16 16 0 0 1-3 3.4M6.6 6.6C4.4 8.1 3 12 3 12s4 6 9 6c1.6 0 3.1-.4 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  eye: "M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Zm12 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  sun: "M12 2.5v2m0 15v2M2.5 12h2m15 0h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z",
  bell: "M6 16v-5a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4a2 2 0 0 0 4 0",
  calendar: "M4 6h16v15H4V6Zm0 5h16M8 3v5m8-5v5",
  chevronLeft: "m15 5-7 7 7 7",
  chevronRight: "m9 5 7 7-7 7",
  check: "m5 12 5 5L20 7",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  compass: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5-4-2 6-6 2 2-6 6-2Z",
  grid: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  table: "M4 5h16v14H4V5Zm0 5h16M4 15h16M10 5v14",
  bracket: "M3 5h5v4H3m0 6h5v4H3m5-12h4v10H8m4-5h9",
  close: "M6 6l12 12M18 6 6 18",
  send: "M4 12 20 4l-6 16-3-7-7-1Z",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm2.5-11.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0",
  more: "M6.5 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm6.5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm6.5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  feed: "M4 5h16v4H4V5Zm0 7h10m-10 4h16m-16 3h7",
} as const

export type StreamIconName = keyof typeof paths

export function StreamIcon({ name, size = 18 }: { name: StreamIconName; size?: number }) {
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
