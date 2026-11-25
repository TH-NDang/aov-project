import type { ReactNode } from "react"
import type { TrophyForm } from "../lib/title-model"
import "./trophy.css"

/** The points of a star, the first of them up. */
function star(cx: number, cy: number, r: number, inner = 0.42, points = 5) {
  const corners = Array.from({ length: points * 2 }, (_, at) => {
    const angle = (Math.PI / points) * at - Math.PI / 2
    const reach = at % 2 ? r * inner : r
    return `${(cx + reach * Math.cos(angle)).toFixed(2)} ${(cy + reach * Math.sin(angle)).toFixed(2)}`
  })
  return `M${corners.join("L")}Z`
}

/** What is drawn on the left, and again on the right. */
function Both({ children }: { children: ReactNode }) {
  return (
    <>
      <g>{children}</g>
      <g transform="matrix(-1 0 0 1 96 0)">{children}</g>
    </>
  )
}

function Foot({ half }: { half: number }) {
  return <path d={`M${48 - half} 100c0-3 2-4 5-4h${half * 2 - 10}c3 0 5 1 5 4v4h-${half * 2}Z`} fill="url(#tr-gold)" />
}

/** The mouth of a cup, seen a little from above. */
function Rim() {
  return (
    <>
      <path
        d="M22 11.500c0-2 1.500-3 3.500-3h45c2 0 3.500 1 3.500 3s-1.500 3.600-3.500 3.600h-45c-2 0-3.500-1.600-3.500-3.600Z"
        fill="url(#tr-gold)"
      />
      <ellipse className="tr-hollow" cx="48" cy="9.900" rx="22.500" ry="1.700" />
    </>
  )
}

const DRAWN: Record<TrophyForm, ReactNode> = {
  // Wings that rise from the foot and hold a globe under a star.
  globe: (
    <>
      <Both>
        <path d="M47 98C39 78 17 70 14 42c-1-11 3-21 10-28-1 9 0 17 3 24 5 12 17 17 20 30Z" fill="url(#tr-gold-lit)" />
        <path d="M47 98c-5-15-16-25-23-38 8 9 18 13 23 22Z" fill="url(#tr-gold-dim)" />
        <path d="M18 22C6 34 6 56 20 69c-4-8-6-14-6-27 0-8 1-14 4-20Z" fill="url(#tr-gold-dim)" />
      </Both>
      <circle cx="48" cy="40" r="20" fill="url(#tr-glass)" />
      <g className="tr-meridians">
        <ellipse cx="48" cy="40" rx="8.500" ry="20" />
        <ellipse cx="48" cy="40" rx="16" ry="20" />
        <path d="M28 40h40M30.600 30.500h34.800M30.600 49.500h34.800" />
      </g>
      <circle cx="48" cy="40" r="20" fill="none" stroke="url(#tr-gold)" strokeWidth="2" />
      <path className="tr-shine" d="M36 27c3-4 8-6 12-6-5 2-9 6-11 12-1-2-2-4-1-6Z" />
      <path d="M38 64c3 3 17 3 20 0l-3 12H41Z" fill="url(#tr-gold)" />
      <path d={star(48, 10, 8)} fill="url(#tr-gold-lit)" />
      <path d="M41 74h14l2 18c.5 3 3 4 5 5H34c2-1 4.500-2 5-5Z" fill="url(#tr-gold)" />
      <Foot half={21} />
    </>
  ),
  // A tall blade of two faces with a ring in orbit around it.
  orbit: (
    <>
      <path
        d="M14 56c0-8 20-14 37-13 17 0 30 5 31 11"
        fill="none"
        stroke="url(#tr-gold-dim)"
        strokeWidth="4.600"
        transform="rotate(-12 48 52)"
      />
      <path d="M48 8c-11 24-15 52-9 88h9Z" fill="url(#tr-gold-lit)" />
      <path d="M48 8c11 24 15 52 9 88h-9Z" fill="url(#tr-gold-dim)" />
      <path className="tr-sheen" d="M48 22c-5 16-7 34-4.500 58 2-4 4.500-8 4.500-12Z" />
      <path
        d="M14 56c1 7 16 12 34 12s34-6 34-14"
        fill="none"
        stroke="url(#tr-gold)"
        strokeWidth="4.600"
        transform="rotate(-12 48 52)"
      />
      <path d={star(48, 56.5, 8, 0.4, 4)} fill="url(#tr-glass-lit)" />
      <circle cx="76" cy="47" r="4.600" fill="url(#tr-glass)" />
      <path d="M34 92c4 2 24 2 28 0l3 6H31Z" fill="url(#tr-gold)" />
      <Foot half={20} />
    </>
  ),
  // Two scrolled handles, a fluted bowl, a star on its band.
  cup: (
    <>
      <Both>
        <path
          d="M29 19C13 13 4 24 8 37c4 12 15 18 27 18"
          fill="none"
          stroke="url(#tr-gold-lit)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M9 33c1 7 9 9 12 4 2-4-2-8-5-5"
          fill="none"
          stroke="url(#tr-gold-dim)"
          strokeWidth="2.600"
          strokeLinecap="round"
        />
      </Both>
      <path d="M25 14h46c0 27-6 46-18 54H43C31 60 25 41 25 14Z" fill="url(#tr-gold)" />
      <Both>
        <path
          className="tr-flute"
          d="M30.500 42c2 11 6 20 13 26h1.600C39 61 35.600 52 34.400 42Zm9.100 0c.6 10 2.400 19 6 26h.9c-2-7-3-16-3.200-26Z"
        />
      </Both>
      <path d="M25.400 22.500h45.200c-.4 5-1.200 10-2.400 15H27.800c-1.200-5-2-10-2.400-15Z" fill="url(#tr-enamel)" />
      <path className="tr-edge" d="M25.500 22.500h45M27.700 37.500h40.600" />
      <path d={star(48, 30.4, 6.4)} fill="url(#tr-gold-lit)" />
      <Rim />
      <path
        d="M39 70.500c0-2 4-3.200 9-3.200s9 1.200 9 3.200-4 3.300-9 3.300-9-1.300-9-3.300Zm4.500 2.500h9l1.200 13c.5 5 4 8 9.300 11H33c5.300-3 8.800-6 9.300-11Z"
        fill="url(#tr-gold)"
      />
      <Foot half={19} />
    </>
  ),
  // A goblet on a calyx, with a stone in it.
  goblet: (
    <>
      <path d="M25 13h46c1 22-5 38-16 45 0 0-3 2-3 7h-8c0-5-3-7-3-7C30 51 24 35 25 13Z" fill="url(#tr-gold)" />
      <Both>
        <path d="M47 61C38 58 30 50 27 39c9 2 17 10 20 22Z" fill="url(#tr-gold-dim)" />
        <path d="M47 61C42 55 39 48 39 41c5 4 8 11 8 20Z" fill="url(#tr-gold-lit)" opacity=".75" />
      </Both>
      <Rim />
      <path d="M48 18 57 28.500 48 42 39 28.500Z" fill="url(#tr-glass-dim)" />
      <path d="M48 18v24L39 28.500Z" fill="url(#tr-glass-lit)" />
      <path className="tr-sheen" d="M39 28.500h18L48 32Z" />
      <path
        d="M48 18 57 28.500 48 42 39 28.500Z"
        fill="none"
        stroke="url(#tr-gold-down)"
        strokeWidth="1.800"
        strokeLinejoin="round"
      />
      <path
        d="M40.500 67.500c0-2.200 3.400-3.400 7.500-3.400s7.500 1.200 7.500 3.400-3.400 3.600-7.500 3.600-7.500-1.400-7.500-3.600ZM44 70h8l1.200 14c.5 6 5 10 11 14H31.800c6-4 10.500-8 11-14Z"
        fill="url(#tr-gold)"
      />
      <Foot half={19} />
    </>
  ),
  // A shield on a stand, a star over its laurel.
  shield: (
    <>
      <path d="M40 88h16l3 9H37Z" fill="url(#tr-gold)" />
      <path d="M48 14c9 6 19 8 29 8v28c0 22-13 35-29 43-16-8-29-21-29-43V22c10 0 20-2 29-8Z" fill="url(#tr-gold)" />
      <path
        d="M48 21c8 4.500 15 6.500 23 7v22c0 18-10 29-23 36-13-7-23-18-23-36V28c8-.5 15-2.500 23-7Z"
        fill="url(#tr-enamel)"
      />
      <path className="tr-face" d="M48 21c-8 4.500-15 6.500-23 7v22c0 18 10 29 23 36Z" />
      <Both>
        <path
          d="M46 79c-9-2-15-8-17-17 8 2 14 8 17 17ZM35 62c-5-4-7-9-6-15 5 3 7 9 6 15Zm4 6c-6-2-9-6-11-11 6 0 10 5 11 11Z"
          fill="url(#tr-gold-lit)"
        />
      </Both>
      <path d={star(48, 49, 13)} fill="url(#tr-gold-lit)" />
      <Foot half={17} />
    </>
  ),
  // A star cut from glass.
  crystal: (
    <>
      <path d="M44.500 60h7l2.500 22c.6 6 4 10 8.500 14.500h-29C38 92 41.400 88 42 82Z" fill="url(#tr-gold)" />
      <path d="M48 8 57 33 84 35 63 52 70 78 48 63 26 78 33 52 12 35 39 33Z" fill="url(#tr-glass-dim)" />
      <path d="M48 8v55L26 78l7-26ZM48 8 39 33 12 35l21 17Z" fill="url(#tr-glass-lit)" opacity=".92" />
      <path className="tr-shine" d="M48 8v36L39 33Z" />
      <path className="tr-sheen" d="m12 35 27-2 9 11ZM48 44l9-11 27 2Z" />
      <path className="tr-flute" d="M63 52 48 44v19l22 15Z" />
      <Foot half={18} />
    </>
  ),
}

/** Where each leaf of a laurel grows on its stem, and which way it points. */
const LEAVES = [
  [41, 103, -64],
  [33, 100.5, -50],
  [26, 96, -36],
  [20, 90, -20],
  [15.5, 83, -6],
  [12.5, 75, 6],
  [38, 103, -128],
  [30, 99.5, -112],
  [23.5, 94, -98],
  [18, 87, -82],
  [14, 79.5, -66],
] as const

function Laurel() {
  return (
    <Both>
      <path
        d="M46 104C30 103 17 93 12 74"
        fill="none"
        stroke="url(#tr-gold-down)"
        strokeWidth="1.600"
        strokeLinecap="round"
      />
      {LEAVES.map(([x, y, turn]) => (
        <path
          key={`${x} ${y}`}
          d="M0 0C4-3 5-9 1-14-4-9-4-3 0 0Z"
          transform={`translate(${x} ${y}) rotate(${turn})`}
          fill="url(#tr-gold-lit)"
        />
      ))}
    </Both>
  )
}

/** The trophy of a title, its foot on the lower edge; a laurel grows around one won without a defeat. */
export function Trophy({ form, unbeaten = false }: { form: TrophyForm; unbeaten?: boolean }) {
  return (
    <svg className="tr" data-form={form} viewBox="0 0 96 104" aria-hidden="true">
      {unbeaten && <Laurel />}
      {DRAWN[form]}
    </svg>
  )
}

/** The metals, the glass and the enamel of every trophy on the page; drawn once beside them. */
export function TrophyPaints() {
  return (
    <svg className="tr-paints" width="0" height="0" aria-hidden="true">
      <defs>
        <linearGradient id="tr-gold">
          <stop className="tr-g1" offset="0" />
          <stop className="tr-g3" offset=".13" />
          <stop className="tr-g5" offset=".3" />
          <stop className="tr-g4" offset=".43" />
          <stop className="tr-g2" offset=".7" />
          <stop className="tr-g3" offset=".88" />
          <stop className="tr-g1" offset="1" />
        </linearGradient>
        <linearGradient id="tr-gold-down" x2="0" y2="1">
          <stop className="tr-g5" offset="0" />
          <stop className="tr-g3" offset=".45" />
          <stop className="tr-g2" offset="1" />
        </linearGradient>
        <linearGradient id="tr-gold-lit" x2=".9" y2="1">
          <stop className="tr-g5" offset="0" />
          <stop className="tr-g4" offset=".5" />
          <stop className="tr-g2" offset="1" />
        </linearGradient>
        <linearGradient id="tr-gold-dim" x2=".9" y2="1">
          <stop className="tr-g3" offset="0" />
          <stop className="tr-g1" offset="1" />
        </linearGradient>
        <radialGradient id="tr-glass" cx=".36" cy=".3" r=".78">
          <stop className="tr-v4" offset="0" />
          <stop className="tr-v3" offset=".3" />
          <stop className="tr-v2" offset=".7" />
          <stop className="tr-v1" offset="1" />
        </radialGradient>
        <linearGradient id="tr-glass-lit" x2=".8" y2="1">
          <stop className="tr-v4" offset="0" />
          <stop className="tr-v3" offset="1" />
        </linearGradient>
        <linearGradient id="tr-glass-dim" x2=".8" y2="1">
          <stop className="tr-v2" offset="0" />
          <stop className="tr-v1" offset="1" />
        </linearGradient>
        <linearGradient id="tr-enamel" x2="0" y2="1">
          <stop className="tr-e2" offset="0" />
          <stop className="tr-e1" offset="1" />
        </linearGradient>
      </defs>
    </svg>
  )
}
