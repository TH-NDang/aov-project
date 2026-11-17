import { useWikiContext, wikiText } from "../../context/wiki-context"

const STAR = "M10 1.8l2.47 5.02 5.53.8-4 3.9.94 5.5L10 14.4l-4.94 2.6.94-5.5-4-3.9 5.53-.8z"

/** The game's star colors: bronze, silver, gold. The stars are artwork, so they keep these colors. */
const STAR_COLOR: Record<number, string> = { 1: "#d08a4c", 2: "#c9d4e2", 3: "#f5c542" }

/**
 * A unit's star level the way auto chess games draw it: bronze for one star, silver for two, gold for three, so the
 * level reads by color before the stars are counted.
 */
export function StarLevel({ level, size = 14 }: { level: number; size?: number }) {
  const { locale } = useWikiContext()
  return (
    <span
      className="wiki-guide-star-level"
      data-level={level}
      role="img"
      aria-label={wikiText(locale, `${level} sao`, `${level}-star`)}
      style={{ color: STAR_COLOR[level] }}
    >
      {Array.from({ length: level }, (_, at) => (
        <svg key={at} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d={STAR} fill="currentColor" stroke="rgb(0 0 0 / 35%)" strokeWidth="0.8" strokeLinejoin="round" />
          <path
            d="M10 4.2 8.3 7.7l-3.8.55"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.7"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      ))}
    </span>
  )
}
