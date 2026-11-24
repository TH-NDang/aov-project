import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { useWikiContext, useWikiText } from "../../../context/wiki-context"
import { WikiIcon } from "../../../components/wiki-icon"
import { heroCatalogQuery, type HeroDetail } from "../../../lib/hero-api"
import { HERO_POSITIONS, localizedHeroOptions } from "../../../lib/hero-classifications"
import { relatedHeroes } from "../model/hero-related"
import { HeroSwitchTile } from "./hero-switch-tile"
import "./hero-related.css"

/** One row of small tiles on a wide page; a phone scrolls the same tiles sideways. */
const SHOWN = 8

/**
 * The heroes played in the same lane, those sharing a role first, so a reader comparing picks for a lane goes on to the
 * next one without going back to the library. It reads the hero list the library already keeps.
 */
export function HeroRelated({ hero }: { hero: HeroDetail }) {
  const scope = useWikiContext()
  const text = useWikiText()
  const catalog = useQuery(heroCatalogQuery(scope))
  const items = catalog.data?.items ?? []
  // A form's page reads the form's lanes and roles, and leaves out the hero that holds it.
  const owner = items.find((item) => item.id === hero.id || item.forms?.some((form) => form.id === hero.id))
  if (!owner) return null

  const reading = owner.forms?.find((form) => form.id === hero.id) ?? owner
  const heroes = relatedHeroes({ ...reading, id: owner.id }, items, { limit: SHOWN, locale: scope.locale })
  if (!heroes.length) return null

  const lanes = localizedHeroOptions(HERO_POSITIONS, scope.locale).filter((option) =>
    reading.positions?.includes(option.value),
  )
  const library = lanes.length ? `/hero?position=${lanes.map((lane) => lane.value).join(",")}` : "/hero"

  return (
    <section className="wiki-hero-related" aria-labelledby="wiki-hero-related-title">
      <header className="wiki-hero-section-head">
        <h2 id="wiki-hero-related-title" tabIndex={-1}>
          {lanes.length
            ? text("Tướng cùng vị trí", "Heroes in the same lane")
            : text("Tướng tương tự", "Similar heroes")}
          {lanes.length > 0 && <small>{lanes.map((lane) => lane.label).join(" · ")}</small>}
        </h2>
        <Link className="wiki-hero-section-more" to={scope.href(library)}>
          {text("Xem tất cả", "See all")}
          <WikiIcon name="arrow" size={14} />
        </Link>
      </header>
      <ul className="wiki-hero-related-list">
        {heroes.map((entry) => (
          <li key={entry.id}>
            <HeroSwitchTile hero={entry} from={library} current={false} />
          </li>
        ))}
      </ul>
    </section>
  )
}
