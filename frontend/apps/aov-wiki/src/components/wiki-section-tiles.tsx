import { Link } from "react-router"
import { useWikiContext } from "../context/wiki-context"
import { wikiSections, type WikiSectionKey } from "../lib/wiki-sections"
import { WikiIcon } from "./wiki-icon"
import "./wiki-section-tiles.css"

/**
 * Every section of the Wiki as one set of entrances: nine tiles fill one row of nine or three rows of three, so none is
 * left alone. `note` gives the muted line under a section's name, such as how many entries it holds.
 */
export function WikiSectionTiles({
  label,
  note,
}: {
  label: string
  note?: (key: WikiSectionKey) => string | undefined
}) {
  const { t, href } = useWikiContext()
  return (
    <nav className="wiki-section-tiles" aria-label={label}>
      <ul>
        {wikiSections.map(({ key, icon, path }) => (
          <li key={key}>
            <Link to={href(path)}>
              <WikiIcon name={icon} size={40} className="wiki-section-tile-icon" />
              <strong>{key === "updates" ? t("updatesShort") : t(key)}</strong>
              {note && <small>{note(key) ?? " "}</small>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
