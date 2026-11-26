import { useId } from "react"
import { Link } from "react-router"
import { HeroGlyph } from "../../components/hero-glyph"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { useHomeRoles } from "./use-home-sections"
import "./home-roles.css"

/**
 * The six roles at the foot of the heroes card, under a title of their own and apart from the portraits, so they read
 * as shortcuts into the hero list rather than as the roles of the heroes pictured. Each holds its mark, its name and how
 * many heroes it has.
 */
export function HomeRoles() {
  const { locale } = useWikiContext()
  const t = useWikiText()
  const roles = useHomeRoles()
  const titleId = useId()

  return (
    <nav className="wiki-home-roles" aria-labelledby={titleId}>
      <p id={titleId}>{t("Theo vai trò", "By role")}</p>
      <ul>
        {roles.map((role) => (
          <li key={role.value}>
            <Link to={role.to}>
              <HeroGlyph name={role.glyph} />
              <span>{role.label}</span>
              {role.count != null && <small>{role.count.toLocaleString(locale)}</small>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
