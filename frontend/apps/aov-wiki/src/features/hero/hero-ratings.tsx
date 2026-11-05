import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { HeroDetail } from "./hero-api"

const RATINGS = [
  ["survivability", "Sinh tồn", "Survivability"],
  ["attackDamage", "Sát thương", "Damage"],
  ["skillEffects", "Hiệu ứng kỹ năng", "Skill effects"],
  ["difficulty", "Độ khó", "Difficulty"],
] as const

/** The summary ratings from the hero profile. They describe the hero in general and are not raw combat stats. */
export function HeroRatings({ ratings }: { ratings: NonNullable<HeroDetail["content"]["overviewRatings"]> }) {
  const { locale } = useWikiContext()
  const scale = Number(/_(\d+)$/.exec(ratings.scaleCode ?? "")?.[1]) || 10
  const rows = RATINGS.flatMap(([key, vi, en]) => {
    const value = ratings[key]
    return typeof value === "number" ? [{ key, label: wikiText(locale, vi, en), value }] : []
  })
  if (!rows.length) return null
  return (
    <dl
      className="wiki-hero-ratings"
      aria-label={wikiText(locale, `Đánh giá trên thang ${scale}`, `Rated out of ${scale}`)}
    >
      {rows.map((row) => (
        <div key={row.key}>
          <dt>{row.label}</dt>
          <dd>
            <span
              role="meter"
              aria-label={row.label}
              aria-valuemin={0}
              aria-valuemax={scale}
              aria-valuenow={row.value}
              className="wiki-hero-rating-track"
            >
              <span style={{ width: `${Math.min(100, (row.value / scale) * 100)}%` }} />
            </span>
            <span className="wiki-hero-rating-value">{row.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
