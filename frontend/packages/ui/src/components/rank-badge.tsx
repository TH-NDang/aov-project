import "./rank-badge.css"

const MEDALS = { "1": "gold", "2": "silver", "3": "bronze" } as const

/** The medal of a place, or null below the third and for a shared place such as "3–4". */
export function medalOf(place: string | number): "gold" | "silver" | "bronze" | null {
  return MEDALS[String(place).trim() as keyof typeof MEDALS] ?? null
}

/** Where the leaves of the laurel grow on the right side, in degrees around the coin; the left side mirrors them. */
const LEAVES = [72, 44, 16, -12]

/**
 * A place in a ranking. The first three are coins in a laurel, told apart by metal and number, and the winner's wears
 * a crown; the others stay plain numbers in the colour of the text around them, so the top of a table is seen before
 * it is read.
 */
export function RankBadge({ place, size = 28 }: { place: string | number; size?: number }) {
  const medal = medalOf(place)
  if (!medal) return <span className="aov-rank">{place}</span>
  return (
    <span className="aov-rank" data-medal={medal} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        {[1, -1].map((side) => (
          <g key={side} className="aov-rank-leaf" transform={side < 0 ? "matrix(-1 0 0 1 40 0)" : undefined}>
            {LEAVES.map((angle) => (
              <ellipse
                key={angle}
                cx="36.2"
                cy="21"
                rx="1.9"
                ry="4.4"
                transform={`rotate(${angle} 20 21) rotate(24 36.2 21)`}
              />
            ))}
          </g>
        ))}
        {medal === "gold" && <path className="aov-rank-crown" d="M13.4 8.2 12.2 2l4.4 3L20 .8 23.4 5l4.4-3-1.2 6.2z" />}
        <circle className="aov-rank-base" cx="20" cy="21" r="11.4" />
        <path className="aov-rank-shine" d="M20 9.6a11.4 11.4 0 0 0 0 22.8z" />
        <circle className="aov-rank-edge" cx="20" cy="21" r="9.2" />
      </svg>
      <span>{place}</span>
    </span>
  )
}
