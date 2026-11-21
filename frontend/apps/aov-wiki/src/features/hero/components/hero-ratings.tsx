import { gameplayIcons, type GameplayIconName } from "@aov/ui/components/gameplay-icons"
import { heroRatingScale } from "@aov/ui/lib/hero-rating-scale"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import type { HeroDetail } from "../../../lib/hero-api"
import { difficultyLevel } from "../model/hero-difficulty"

const RATINGS = [
  ["survivability", "Sinh tồn", "Survivability", "shield"],
  ["attackDamage", "Đánh thường", "Normal attack", "sword"],
  ["skillEffects", "Hiệu ứng kỹ năng", "Ability effects", "orb"],
  ["difficulty", "Độ khó", "Difficulty", "flame"],
] as const satisfies readonly (readonly [string, string, string, GameplayIconName])[]

/** Difficulty is not "more is better", so it also reads as a word, from very easy to very hard. */
const DIFFICULTY = [
  ["Rất dễ", "Very easy"],
  ["Dễ", "Easy"],
  ["Trung bình", "Medium"],
  ["Khó", "Hard"],
  ["Rất khó", "Very hard"],
] as const

function difficultyWord(value: number, maximum: number, locale: string) {
  const [vi, en] = DIFFICULTY[difficultyLevel(value, maximum) - 1]!
  return wikiText(locale, vi, en)
}

/**
 * The summary ratings from the hero profile, one tile each: the label, the score (difficulty also as a word), then the
 * game's segments. They describe the hero in general and are not raw combat stats.
 */
export function HeroRatings({ ratings }: { ratings: NonNullable<HeroDetail["content"]["overviewRatings"]> }) {
  const { locale } = useWikiContext()
  const scale = heroRatingScale(ratings.scaleCode ?? "GAME_OVERVIEW_10")
  const rows = RATINGS.flatMap(([key, vi, en, icon]) => {
    const value = ratings[key]
    return typeof value === "number"
      ? [{ key, label: wikiText(locale, vi, en), value: value / scale.factor, Icon: gameplayIcons[icon] }]
      : []
  })
  if (!rows.length) return null
  return (
    <dl
      className="wiki-hero-ratings"
      aria-label={wikiText(locale, `Đánh giá trên thang ${scale.maximum}`, `Rated out of ${scale.maximum}`)}
    >
      {rows.map((row) => (
        <div key={row.key} data-rating={row.key}>
          <dt>
            <row.Icon size={16} />
            {row.label}
          </dt>
          <dd>
            <span className="wiki-hero-rating-value">
              {row.key === "difficulty" && (
                <span className="wiki-hero-rating-word">{difficultyWord(row.value, scale.maximum, locale)}</span>
              )}
              <strong>{row.value.toLocaleString(locale)}</strong>/{scale.maximum}
            </span>
            <span
              role="meter"
              aria-label={row.label}
              aria-valuemin={0}
              aria-valuemax={scale.maximum}
              aria-valuenow={row.value}
              className="wiki-hero-rating-track"
            >
              {Array.from({ length: scale.maximum }, (_, index) => (
                <span key={index}>
                  <span style={{ width: `${Math.max(0, Math.min(1, row.value - index)) * 100}%` }} />
                </span>
              ))}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
