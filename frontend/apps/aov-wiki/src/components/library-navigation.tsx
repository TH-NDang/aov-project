import { Link } from "react-router"
import { WikiIcon } from "./wiki-icon"
import { useWikiContext, useWikiText } from "../context/wiki-context"
import { wikiSections, type WikiSectionKey, SECTION_NAMES } from "../lib/wiki-sections"
import "./library-navigation.css"

export function LibraryNavigation({ active, onNavigate }: { active?: WikiSectionKey; onNavigate?: () => void }) {
  const { href } = useWikiContext()
  const t = useWikiText()
  return (
    <nav className="wiki-library-navigation" aria-label={t("Mục lục", "Contents")}>
      {(["characters", "warehouse", "play", "news"] as const).map((group) => (
        <div className="wiki-library-nav-group" key={group}>
          <h3>{t(...SECTION_NAMES[group])}</h3>
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
                {t(...SECTION_NAMES[section.key])}
              </Link>
            ))}
        </div>
      ))}
    </nav>
  )
}
