import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { wikiSections } from "../../layout/wiki-sections"
import "./home-categories.css"

export function HomeCategories() {
  const { locale, t, href } = useWikiContext()
  return (
    <nav className="wiki-index" aria-labelledby="wiki-index-title">
      <h2 id="wiki-index-title">{wikiText(locale, "Danh mục", "Browse the library")}</h2>
      <ul>
        {wikiSections.map(({ key, icon, path }) => (
          <li key={key}>
            <Link to={href(path)} data-section={key}>
              <span className="wiki-index-icon">
                <WikiIcon name={icon} size={22} />
              </span>
              <strong>{t(key)}</strong>
              <WikiIcon name="chevronRight" size={15} className="wiki-index-arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
