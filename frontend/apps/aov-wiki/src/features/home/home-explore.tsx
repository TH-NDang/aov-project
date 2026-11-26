import type { CSSProperties } from "react"
import { Link, useSearchParams } from "react-router"
import { ChangeKindMark } from "../../components/change-tag"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { useSeasonMarks } from "../../lib/season-updates"
import { resizedImageUrl } from "../../lib/sized-image"
import { HomeChangeCounts } from "./home-change-counts"
import { HomeRoles } from "./home-roles"
import { useHomeSections, type HomeSection } from "./use-home-sections"
import "./home-explore.css"

/** How many pictures each section's strip holds; the wide cards hold more. */
const STRIP_SIZE: Partial<Record<HomeSection["key"], number>> = {
  heroes: 8,
  skins: 3,
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
        {section.words.slice(0, count).map((word) => (
          <span key={word}>{word}</span>
        ))}
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

// TODO: temporary switch between three card designs for review (?homeframe=a|b|c); keep the chosen one, drop the rest.
const LOOKS = ["a", "b", "c"] as const
type Look = (typeof LOOKS)[number]

/**
 * Every section of the Wiki as a card: a strip of real pictures, the section's mark in a socket, its name and count
 * (for updates, the change marks with their numbers), and a "New" tag when the season in force changed it. Heroes,
 * skins and updates take two columns; the four armory catalogs, the glossary and game modes one each (the glossary two
 * when there are no modes). The heroes card ends with the roles, under a title of their own, apart from the portraits.
 */
export function HomeExplore() {
  const { locale } = useWikiContext()
  const t = useWikiText()
  const sections = useHomeSections()
  const { marks } = useSeasonMarks()
  const [search] = useSearchParams()
  const asked = search.get("homeframe") as Look
  const look: Look = LOOKS.includes(asked) ? asked : "c"

  return (
    <section className="wiki-home-explore" aria-labelledby="wiki-home-explore-title">
      <header className="wiki-home-heading">
        <h2 id="wiki-home-explore-title">{t("Khám phá", "Explore")}</h2>
      </header>
      <ul className="wiki-home-cards" data-look={look}>
        {sections.map((section) => (
          <li
            key={section.key}
            className="wiki-home-card"
            data-section={section.key}
            style={
              section.pictures[0]
                ? ({ "--card-wash": `url("${resizedImageUrl(section.pictures[0].url, 256)}")` } as CSSProperties)
                : undefined
            }
          >
            <Strip section={section} />
            {marks[section.key] && <span className="wiki-home-card-new">{t("Mới", "New")}</span>}
            <span className="wiki-home-card-body">
              <span className={look === "b" ? "wiki-home-card-medallion" : "wiki-frame-socket wiki-home-card-socket"}>
                <WikiIcon name={section.icon} size={look === "b" ? 26 : 20} />
              </span>
              <Link className="wiki-home-card-link" to={section.to}>
                {section.name}
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
