import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { gameplayIcons } from "@aov/ui/components/gameplay-icons"
import { HERO_TRAIT_GROUPS, heroTraitInfo, heroTraitOrder, type HeroTraitGroup } from "@aov/ui/lib/hero-traits"
import { useWikiContext, useWikiText } from "../../../context/wiki-context"
import { WikiImage } from "../../../components/wiki-image"
import {
  heroCatalogQuery,
  heroRankingQuery,
  heroTraitIndexQuery,
  type HeroDetail,
  type HeroMedia,
  type HeroRankingReading,
  type PublicSkill,
} from "../../../lib/hero-api"
import { heroFormPath } from "../../../lib/hero-forms"
import { marketName } from "@aov/ui/lib/locale-text"
import { SkillIcon } from "../../../components/hero-skill-icon"
import { WikiIcon } from "../../../components/wiki-icon"
import { traitSkillNotes } from "../model/hero-trait-skills"
import { skillLabel } from "./skill-slot-label"
import "./hero-evaluation.css"

/** A trait an editor confirmed, with its detail line in the reader's language when one is written. */
export interface PublicHeroTrait {
  code: string
  skillKeys: string[]
  detail?: string | null
}

/** The parts of a published hero this section reads: the profile's notes and the skills' traits (ADR-029). */
type EvaluatedContent = HeroDetail["content"] & {
  profile?: { strengths?: string | null; weaknesses?: string | null; counterTips?: string | null }
  skills?: { traits?: PublicHeroTrait[] } | null
}

/** The capture day reads like the one under the recommended builds. */
const CAPTURE_DAY: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }

const FIGURES: Record<string, [string, string]> = {
  DAMAGE_DEALT: ["Sát thương mỗi trận", "Damage per match"],
  DAMAGE_TAKEN: ["Sát thương phải chịu", "Damage taken"],
  KILLS: ["Hạ gục", "Kills"],
  ASSISTS: ["Hỗ trợ", "Assists"],
  // The game gives this one per minute (570–740), unlike the per-match figures above it.
  GOLD: ["Vàng mỗi phút", "Gold per minute"],
}
/** The mark beside each group of traits, from the same set as the stats above. */
const GROUP_ICONS: Record<HeroTraitGroup, (typeof gameplayIcons)[keyof typeof gameplayIcons]> = {
  DAMAGE: gameplayIcons.sword,
  MOBILITY: gameplayIcons.boot,
  SURVIVAL: gameplayIcons.shield,
  CONTROL: gameplayIcons.stun,
  TEAM: gameplayIcons.heal,
}
const NOTES = [
  ["strengths", "Điểm mạnh", "Strengths"],
  ["weaknesses", "Điểm yếu", "Weaknesses"],
  ["counterTips", "Cách khắc chế", "How to play against"],
] as const

interface HeroLink {
  name: string
  path: string
  head?: HeroMedia
}

/** Every hero and form readers can open, by id, so lists of other heroes can name and link them. */
function useHeroLinks() {
  const scope = useWikiContext()
  const catalog = useQuery(heroCatalogQuery(scope))
  return useMemo(() => {
    const links = new Map<string, HeroLink>()
    for (const hero of catalog.data?.items ?? []) {
      links.set(hero.id, { name: hero.name, path: `/hero/${hero.code}`, head: hero.head })
      for (const form of hero.forms ?? [])
        links.set(form.id, {
          name: form.name,
          path: heroFormPath(hero.code, form.formKey, hero.forms),
          head: form.head ?? hero.head,
        })
    }
    return links
  }, [catalog.data])
}

function HeroChip({ id, code, links }: { id: string | null; code: string; links: Map<string, HeroLink> }) {
  const { href } = useWikiContext()
  const link = id ? links.get(id) : undefined
  if (!link) return <span className="wiki-evaluation-hero">{code}</span>
  const image = link.head?.currentVersion?.url
  return (
    <Link className="wiki-evaluation-hero" to={href(link.path)}>
      {image ? (
        <WikiImage frameWidth={96} src={image} alt="" width="28" height="28" loading="lazy" decoding="async" />
      ) : (
        <span className="wiki-evaluation-hero-initial" aria-hidden="true">
          {link.name.charAt(0)}
        </span>
      )}
      {link.name}
    </Link>
  )
}

function RankingCard({ reading, links }: { reading: HeroRankingReading; links: Map<string, HeroLink> }) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  const snapshot = reading.snapshot!
  const entry = reading.entry!
  const percent = (value: number | null) =>
    value == null ? "—" : `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}%`
  const amount = (value: number | null) =>
    value == null ? "—" : value.toLocaleString(locale, { maximumFractionDigits: value >= 1000 ? 0 : 2 })
  const market = [marketName(snapshot.regionCode, "vi-VN"), marketName(snapshot.regionCode, "en-US")]
  const figures = entry.figures.filter((figure) => figure.value != null && FIGURES[figure.metric])

  return (
    <article className="wiki-evaluation-card" aria-label={text("Số liệu đấu hạng", "Ranked figures")}>
      <dl className="wiki-evaluation-rates">
        {entry.tier && (
          <div>
            <dt>{text("Hạng sức mạnh", "Tier")}</dt>
            <dd className="wiki-evaluation-tier">{entry.tier}</dd>
          </div>
        )}
        <div>
          <dt>{text("Tỷ lệ thắng", "Win rate")}</dt>
          <dd>{percent(entry.winRate)}</dd>
        </div>
        <div>
          <dt>{text("Tỷ lệ chọn", "Pick rate")}</dt>
          <dd>{percent(entry.pickRate)}</dd>
        </div>
        <div>
          <dt>{text("Tỷ lệ cấm", "Ban rate")}</dt>
          <dd>{percent(entry.banRate)}</dd>
        </div>
      </dl>
      {!!figures.length && (
        <dl className="wiki-evaluation-figures">
          {figures.map((figure) => (
            <div key={figure.metric}>
              <dt>{text(...FIGURES[figure.metric]!)}</dt>
              <dd>
                <span>{amount(figure.value)}</span>
                {figure.rank != null && (
                  <span className="wiki-evaluation-rank">
                    {text(`hạng ${figure.rank}/${figure.of}`, `#${figure.rank} of ${figure.of}`)}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!!entry.counters.length && (
        <div className="wiki-evaluation-counters">
          <p>{text("Thắng nhiều hơn khi gặp", "Wins more often against")}</p>
          <div>
            {entry.counters.map((counter) => (
              <HeroChip key={counter.heroCode} id={counter.heroId} code={counter.heroCode} links={links} />
            ))}
          </div>
        </div>
      )}
      <p className="wiki-evaluation-origin">
        {text(
          `Bảng xếp hạng trong game · ${snapshot.modeLabel} · máy chủ ${market[0]} · chụp ngày `,
          `In-game ranking boards · ${snapshot.modeLabel} · ${market[1]} server · captured `,
        )}
        <LocalTime
          value={snapshot.capturedAt}
          sourceTimeZone={snapshot.sourceTimeZone}
          format={CAPTURE_DAY}
          locale={locale}
        />
        {snapshot.periodLabel && ` · ${snapshot.periodLabel}`}
      </p>
    </article>
  )
}

/** The skills a trait comes from, each with its picture, its place in the kit and what the editor noted about it. */
function TraitSkills({
  hero,
  trait,
  onOpenSkill,
}: {
  hero: HeroDetail
  trait: PublicHeroTrait
  onOpenSkill: (skillKey: string) => void
}) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  const kit = hero.content.skills?.skills ?? []
  const named = trait.skillKeys.flatMap((key) => kit.filter((skill: PublicSkill) => skill.skillKey === key))
  const split = traitSkillNotes(trait.detail, named)

  return (
    <>
      {named.length > 0 && (
        <ul className="wiki-evaluation-skills">
          {named.map((skill, position) => {
            const note = split.skills[position]?.note
            return (
              <li key={skill.skillKey}>
                <button
                  type="button"
                  aria-label={`${skillLabel(skill, locale)} · ${skill.name ?? ""}${note ? ` · ${note}` : ""}. ${text("Xem kỹ năng", "Open the ability")}`}
                  onClick={() => onOpenSkill(skill.skillKey)}
                >
                  <span className="wiki-evaluation-skill-icon">
                    <SkillIcon hero={hero} skill={skill} locale={locale} />
                  </span>
                  <span className="wiki-evaluation-skill-text">
                    <small>{skillLabel(skill, locale)}</small>
                    <strong>{skill.name || text("Chưa rõ tên", "Unnamed ability")}</strong>
                  </span>
                  {note && <span className="wiki-evaluation-skill-note">{note}</span>}
                  <WikiIcon name="chevronRight" size={16} className="wiki-evaluation-skill-go" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {split.rest && <p className="wiki-evaluation-detail">{split.rest}</p>}
    </>
  )
}

function TraitList({
  hero,
  traits,
  links,
  onOpenSkill,
}: {
  hero: HeroDetail
  traits: PublicHeroTrait[]
  links: Map<string, HeroLink>
  onOpenSkill: (skillKey: string) => void
}) {
  const { region } = useWikiContext()
  const text = useWikiText()
  const index = useQuery(heroTraitIndexQuery(region))
  const others = (code: string) =>
    index.data?.traits.find((entry) => entry.code === code)?.heroes.filter((entry) => entry.id !== hero.id) ?? []

  return (
    <div className="wiki-evaluation-traits">
      {HERO_TRAIT_GROUPS.map((group) => {
        const rows = traits.filter((trait) => heroTraitInfo(trait.code)?.group === group.key)
        if (!rows.length) return null
        const Icon = GROUP_ICONS[group.key]
        return (
          <section key={group.key} className="wiki-evaluation-group" aria-label={text(group.vi, group.en)}>
            <h3>
              <Icon size={18} className="wiki-evaluation-group-icon" />
              {text(group.vi, group.en)}
            </h3>
            <ul>
              {rows.map((trait) => {
                const info = heroTraitInfo(trait.code)!
                const same = others(trait.code)
                return (
                  <li key={trait.code}>
                    <p className="wiki-evaluation-trait">{text(info.vi, info.en)}</p>
                    <TraitSkills hero={hero} trait={trait} onOpenSkill={onOpenSkill} />
                    {same.length > 0 && (
                      <details className="wiki-evaluation-same">
                        <summary>
                          {text(`${same.length} tướng khác cũng có`, `${same.length} other heroes share it`)}
                        </summary>
                        <div>
                          {same.map((entry) => (
                            <HeroChip key={entry.id} id={entry.id} code={entry.code} links={links} />
                          ))}
                        </div>
                      </details>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** One point per line, as editors write them; a leading dash is dropped since the list draws its own marks. */
const points = (value: string) =>
  value
    .split("\n")
    .map((line) => line.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean)

/**
 * How the hero fares (ADR-029): the game's ranked figures with their source and day, the traits an editor confirmed
 * from the skill kit, and the editor's own strengths, weaknesses and counter tips. Each part shows only when it has
 * something to say, and the whole section stays away when none does.
 */
export function HeroEvaluation({
  hero,
  onOpenSkill,
}: {
  hero: HeroDetail
  /** Shows a skill in the abilities above and scrolls to it. */
  onOpenSkill: (skillKey: string) => void
}) {
  const { region } = useWikiContext()
  const text = useWikiText()
  const ranking = useQuery(heroRankingQuery(hero.id, region))
  const links = useHeroLinks()
  const content = hero.content as EvaluatedContent
  const traits = [...(content.skills?.traits ?? [])]
    .filter((trait) => heroTraitInfo(trait.code))
    .sort((left, right) => heroTraitOrder(left.code) - heroTraitOrder(right.code))
  const profile = content.profile
  const notes = NOTES.map(([key, vi, en]) => ({
    key,
    label: text(vi, en),
    points: points(profile?.[key] ?? ""),
  })).filter((note) => note.points.length)
  const rankingShown = !!ranking.data?.snapshot && !!ranking.data.entry
  if (!rankingShown && !traits.length && !notes.length) return null

  return (
    <section className="wiki-evaluation" aria-labelledby="wiki-hero-evaluation">
      <header className="wiki-hero-section-head">
        <h2 id="wiki-hero-evaluation" tabIndex={-1}>
          {text("Đánh giá", "Assessment")}
        </h2>
      </header>
      {rankingShown && <RankingCard reading={ranking.data!} links={links} />}
      {!!notes.length && (
        <div className="wiki-evaluation-notes">
          {notes.map((note) => (
            <article key={note.key} className="wiki-evaluation-card" data-note={note.key}>
              <h3>{note.label}</h3>
              <ul>
                {note.points.map((point, position) => (
                  <li key={position}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
      {!!traits.length && (
        <>
          <h3 className="wiki-evaluation-subtitle">{text("Đặc điểm bộ kỹ năng", "What the kit can do")}</h3>
          <TraitList hero={hero} traits={traits} links={links} onOpenSkill={onOpenSkill} />
        </>
      )}
    </section>
  )
}
