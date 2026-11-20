import { useId, useState } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, useWikiText } from "../context/wiki-context"
import { wikiSections, type WikiSectionKey, SECTION_NAMES } from "../lib/wiki-sections"
import { WikiIcon } from "./wiki-icon"
import "./wiki-section-tiles.css"

/** Three tiles to a row on the compact layout, which shows two rows before the chevron. */
const COMPACT_VISIBLE = 6

/**
 * Every section of the Wiki as one set of entrances, each its mark, its name and an optional muted line below. The wide
 * layout fits them in at most two rows. The compact layout shows two rows of three and the top of the third, fading
 * out, with a muted chevron under it that opens the rest. `note` gives the muted line, such as how many entries a
 * section holds.
 */
export function WikiSectionTiles({
  label,
  note,
}: {
  label: string
  note?: (key: WikiSectionKey) => string | undefined
}) {
  const { href } = useWikiContext()
  const t = useWikiText()
  const compact = usePageLayout() === "compact"
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  return (
    <nav className="wiki-section-tiles" aria-label={label}>
      <ul id={listId}>
        {wikiSections.map(({ key, icon, path }, index) => {
          // A tile past the first two rows only hints at itself until the reader opens the rest.
          const peek = compact && !expanded && index >= COMPACT_VISIBLE
          return (
            <li key={key} data-peek={peek || undefined} inert={peek}>
              <Link to={href(path)}>
                <WikiIcon name={icon} size={40} className="wiki-section-tile-icon" />
                <strong>{key === "updates" ? t("Cập nhật", "Updates") : t(...SECTION_NAMES[key])}</strong>
                {note && <small>{note(key) ?? " "}</small>}
              </Link>
            </li>
          )
        })}
      </ul>
      {compact && (
        <button
          type="button"
          className="wiki-section-tiles-more"
          data-expanded={expanded || undefined}
          aria-controls={listId}
          aria-expanded={expanded}
          aria-label={
            expanded ? t("Thu gọn các mục", "Show fewer sections") : t("Xem thêm các mục", "Show more sections")
          }
          onClick={() => setExpanded((value) => !value)}
        >
          <WikiIcon name="chevron" size={22} />
        </button>
      )}
    </nav>
  )
}
