import type { ReactNode } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import { HeroGlyph } from "../../../components/hero-glyph"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import type { HeroListItem } from "../../../lib/hero-api"
import { HERO_DIFFICULTIES, HERO_POSITIONS, HERO_ROLES, localizedHeroOptions } from "../../../lib/hero-classifications"
import { DIFFICULTY_WORDS, difficultyBand, difficultyLevel } from "../model/hero-difficulty"
import type { HeroStanding } from "../model/hero-order"
import "./hero-preview.css"

/** Ratings of the hero profile are on the game's ten-point scale. */
const DIFFICULTY_MAXIMUM = 10

/**
 * A short look at a hero while the pointer rests on its card: roles, lanes, how hard it is and, when a confirmed
 * ranking holds it, its tier and rates. It only helps a mouse, so the library offers it on wide screens alone, and a
 * card stays the way to the hero's page.
 */
export function HeroPreview({
  hero,
  standing,
  children,
}: {
  hero: HeroListItem
  standing?: HeroStanding
  children: ReactNode
}) {
  const { locale } = useWikiContext()
  const roles = localizedHeroOptions(HERO_ROLES, locale).filter((option) => hero.roles.includes(option.value))
  const lanes = localizedHeroOptions(HERO_POSITIONS, locale).filter((option) => hero.positions?.includes(option.value))
  const level = typeof hero.difficulty === "number" ? difficultyLevel(hero.difficulty, DIFFICULTY_MAXIMUM) : undefined
  const band = level
    ? HERO_DIFFICULTIES.find((option) => option.value === difficultyBand(level).toUpperCase())
    : undefined
  const percent = (value: number | null) => (value === null ? "—" : `${value.toLocaleString(locale)}%`)
  const rates = standing && (standing.winRate ?? standing.pickRate ?? standing.banRate) !== null

  return (
    <HoverCard openDelay={350} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className="wiki-hero-preview-anchor">{children}</div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" sideOffset={10} className="wiki-hero-preview">
        <p className="wiki-hero-preview-name">
          {hero.name}
          {standing?.tier && <span className="wiki-hero-preview-tier">{standing.tier}</span>}
        </p>
        <dl className="wiki-hero-preview-facts">
          {!!roles.length && (
            <div>
              <dt>{wikiText(locale, "Vai trò", "Role")}</dt>
              <dd>
                {roles.map((role) => (
                  <span key={role.value}>
                    <HeroGlyph name={role.glyph} className="wiki-hero-preview-glyph" />
                    {role.label}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {!!lanes.length && (
            <div>
              <dt>{wikiText(locale, "Vị trí", "Lane")}</dt>
              <dd>
                {lanes.map((lane) => (
                  <span key={lane.value}>
                    <HeroGlyph name={lane.glyph} className="wiki-hero-preview-glyph" />
                    {lane.label}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {level && band && (
            <div>
              <dt>{wikiText(locale, "Độ khó", "Difficulty")}</dt>
              <dd>
                <span>
                  <HeroGlyph name={band.glyph} className="wiki-hero-preview-glyph" />
                  {wikiText(locale, DIFFICULTY_WORDS[level - 1]![0], DIFFICULTY_WORDS[level - 1]![1])}
                </span>
              </dd>
            </div>
          )}
        </dl>
        {rates && (
          <dl className="wiki-hero-preview-rates">
            <div>
              <dt>{wikiText(locale, "Thắng", "Win")}</dt>
              <dd>{percent(standing.winRate)}</dd>
            </div>
            <div>
              <dt>{wikiText(locale, "Chọn", "Pick")}</dt>
              <dd>{percent(standing.pickRate)}</dd>
            </div>
            <div>
              <dt>{wikiText(locale, "Cấm", "Ban")}</dt>
              <dd>{percent(standing.banRate)}</dd>
            </div>
          </dl>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
