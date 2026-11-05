import { Link } from "react-router"
import { WikiIcon } from "../components/wiki-icon"
import { useWikiContext } from "../context/wiki-context"
import { wikiSections, type WikiSectionKey } from "./wiki-sections"
import "./library-navigation.css"

export function LibraryNavigation({ active, onNavigate }: { active: WikiSectionKey; onNavigate?: () => void }) {
  const { t, href } = useWikiContext()
  return (
    <nav className="wiki-library-navigation" aria-label={t("contents")}>
      {(["characters", "warehouse"] as const).map((group) => (
        <div className="wiki-library-nav-group" key={group}>
          <h3>{t(group)}</h3>
          {wikiSections
            .filter((section) => section.group === group)
            .map((section) => (
              <Link
                key={section.key}
                to={href(section.path)}
                onClick={onNavigate}
                className="wiki-library-nav-link"
                aria-current={active === section.key ? "page" : undefined}
              >
                <WikiIcon name={section.icon} size={26} />
                {t(section.key)}
              </Link>
            ))}
        </div>
      ))}
    </nav>
  )
}
