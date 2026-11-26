import { Link } from "react-router"
import { ChangeKindMark } from "../../components/change-tag"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
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
 * Every section of the Wiki as a card: a strip of real pictures on top, then the section's mark, name and count (for
 * updates, the change marks with their numbers). Heroes, skins, updates and the glossary take two columns; the four
 * armory catalogs one each. The heroes card ends with the roles, under a title of their own, apart from the portraits.
 */
export function HomeExplore() {
  const { locale } = useWikiContext()
  const t = useWikiText()
  const sections = useHomeSections()

  return (
    <section className="wiki-home-explore" aria-labelledby="wiki-home-explore-title">
      <header className="wiki-home-heading">
        <h2 id="wiki-home-explore-title">{t("Khám phá", "Explore")}</h2>
      </header>
      <ul className="wiki-home-cards">
        {sections.map((section) => (
          <li key={section.key} className="wiki-home-card" data-section={section.key}>
            <Strip section={section} />
            <span className="wiki-home-card-body">
              <span className="wiki-home-card-mark">
                <WikiIcon name={section.icon} size={20} />
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
