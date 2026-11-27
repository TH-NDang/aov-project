import { WikiIcon } from "../../components/wiki-icon"
import { useWikiText } from "../../context/wiki-context"
import { sourceName, type PatchSourceLink } from "../../lib/patch-sources"
import "./patch-sources.css"

/** The pages of a patch's official notes, side by side, each named by its language or market. */
export function PatchSourceList({ links }: { links: PatchSourceLink[] }) {
  const t = useWikiText()
  const title = t("Nguồn công bố", "Publication sources")
  return (
    <nav className="wiki-patch-sources" aria-label={title}>
      <span className="wiki-patch-sources-title" aria-hidden="true">
        {title}
      </span>
      <ul>
        {links.map((link) => (
          <li key={link.url}>
            <a href={link.url} target="_blank" rel="noopener noreferrer" hrefLang={link.locale ?? undefined}>
              {sourceName(link)}
              <WikiIcon name="open" size={14} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
