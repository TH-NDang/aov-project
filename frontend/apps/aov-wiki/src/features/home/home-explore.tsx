import type { CSSProperties } from "react"
import { Link } from "react-router"
import { gameIcon } from "@aov/ui/components/game-icons"
import { termIcon } from "@aov/ui/components/gameplay-icons"
import { defaultEntityColor } from "@aov/ui/lib/entity-rich-text"
import { ChangeKindMark } from "../../components/change-tag"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { useSeasonMarks } from "../../lib/season-updates"
import { HomeChangeCounts } from "./home-change-counts"
import { HomeRoles } from "./home-roles"
import { useHomeSections, type HomeSection } from "./use-home-sections"
import "./home-explore.css"

const GlossaryMark = gameIcon("spell-book")

/** How many pictures each section's strip holds; the wide cards hold more. */
const STRIP_SIZE: Partial<Record<HomeSection["key"], number>> = {
  heroes: 8,
  skins: 5,
  enchantments: 8,
  updates: 8,
  terms: 6,
}

/** A strip of the section's real pictures across the top of its card. */
function Strip({ section }: { section: HomeSection }) {
  const count = STRIP_SIZE[section.key] ?? 4
  if (section.words.length > 0) {
    return (
      <span className="wiki-home-card-strip" data-shape="words" aria-hidden="true">
        {section.words.slice(0, count).map(({ name, term }) => {
          // Each term carries the glossary's own mark for it, in its colour.
          const Mark = termIcon(term) ?? GlossaryMark
          const color = term.display?.color ?? defaultEntityColor(term)
          return (
            <span key={term.id} style={color ? ({ "--term-color": color } as CSSProperties) : undefined}>
              <Mark size={16} className="wiki-home-card-term-mark" />
              {name}
            </span>
          )
        })}
      </span>
    )
  }
  // A section without pictures (game modes) shows its own mark large instead.
  if (section.pictures.length === 0) {
    return (
      <span className="wiki-home-card-strip" data-shape="mark" aria-hidden="true">
        <WikiIcon name={section.icon} size={56} />
      </span>
    )
  }
  return (
    <span className="wiki-home-card-strip" data-shape={section.shape} aria-hidden="true">
      {section.pictures.slice(0, count).map((picture) => (
        <span key={picture.url} className="wiki-home-card-frame">
          <WikiImage className="wiki-home-card-picture" src={picture.url} frameWidth={160} alt="" />
          {picture.kind && (
            <span className="wiki-home-card-pip">
              <ChangeKindMark kind={picture.kind} size={20} />
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

/**
 * Every section of the Wiki as a hero card: its real pictures fill it, and at its foot a metal plate with the
 * section's mark in a socket, its name and count (for updates, the change marks with their numbers); a "New" tag when
 * the season in force changed it. Heroes,
 * skins and updates take two columns; the four armory catalogs, the glossary and game modes one each (the glossary two
 * when there are no modes). The heroes card ends with the roles, under a title of their own, apart from the portraits.
 */
export function HomeExplore() {
  const { locale } = useWikiContext()
  const t = useWikiText()
  const sections = useHomeSections()
  const { marks } = useSeasonMarks()

  return (
    <section className="wiki-home-explore" aria-labelledby="wiki-home-explore-title">
      <header className="wiki-home-heading">
        <h2 id="wiki-home-explore-title">{t("Khám phá", "Explore")}</h2>
      </header>
      <ul className="wiki-home-cards">
        {sections.map((section) => (
          <li key={section.key} className="wiki-home-card" data-section={section.key}>
            <Strip section={section} />
            {marks[section.key] && <span className="wiki-home-card-new">{t("Mới", "New")}</span>}
            <span className="wiki-home-card-body">
              <span className="wiki-frame-socket wiki-home-card-socket">
                <WikiIcon name={section.icon} size={20} />
              </span>
              {/* The link covers the whole card; the plate inside it carries the name. */}
              <Link className="wiki-home-card-link" to={section.to}>
                <span className="wiki-home-card-plate">{section.name}</span>
              </Link>
              {section.count != null && (
                <span className="wiki-home-card-count">{section.count.toLocaleString(locale)}</span>
              )}
              {section.tally.length > 0 && (
                <span className="wiki-home-card-tally">
                  <HomeChangeCounts tally={section.tally} />
                </span>
              )}
            </span>
            {section.key === "heroes" && <HomeRoles />}
          </li>
        ))}
      </ul>
    </section>
  )
}
