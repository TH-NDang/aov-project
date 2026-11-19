import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { heroCatalogQuery } from "../../lib/hero-api"
import { HERO_ROLES, localizedHeroOptions } from "../../lib/hero-classifications"
import { HeroGlyph } from "../../components/hero-glyph"

/** The six roles as shortcuts into the hero list, each with how many published heroes play it. */
export function HomeRoles() {
  const scope = useWikiContext()
  const { locale, href } = scope
  const catalog = useQuery(heroCatalogQuery(scope))
  const heroes = catalog.data?.items ?? []
  return (
    <nav className="wiki-home-roles" aria-labelledby="wiki-home-roles-title">
      <header className="wiki-home-heading">
        <h2 id="wiki-home-roles-title">{wikiText(locale, "Tìm tướng theo vai trò", "Heroes by role")}</h2>
      </header>
      <ul>
        {localizedHeroOptions(HERO_ROLES, locale).map((role) => {
          const count = heroes.filter((hero) => hero.roles.includes(role.value)).length
          return (
            <li key={role.value}>
              <Link to={href(`/hero?role=${role.value}`)}>
                <HeroGlyph name={role.glyph} className="wiki-home-role-mark" />
                <strong>{role.label}</strong>
                {count > 0 && <small>{count}</small>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
