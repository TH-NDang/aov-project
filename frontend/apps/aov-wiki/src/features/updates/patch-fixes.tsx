import { Link } from "react-router"
import { ChangeList } from "../../components/change-list"
import { WikiImage } from "../../components/wiki-image"
import { useWikiText } from "../../context/wiki-context"
import type { HeroDetail } from "../../lib/hero-api"
import { FIX_KIND } from "../../lib/patch-fixes"
import type { PatchChangeRow } from "../../lib/updates-api"
import { parseChangeSummary } from "../../lib/wiki-change-format"
import "./patch-fixes.css"

/** Something an update fixed: a hero or an armory entry, its place on the page and the page of its own. */
export interface FixEntry {
  id: string
  name: string
  kind: typeof FIX_KIND
  image?: string
  page?: string | null
  /** Said for armory entries, which share the list with heroes. */
  domainLabel?: string
  row: PatchChangeRow
  hero?: HeroDetail
}

function FixRow({ entry }: { entry: FixEntry }) {
  const { name, image, page, row, hero } = entry
  const lines = row.changes ?? []
  const summary = parseChangeSummary(row.summary).text
  const art = image ? <WikiImage frameWidth={64} src={image} alt="" /> : name.charAt(0)
  return (
    <li id={entry.id} tabIndex={-1} className="wiki-patch-fix">
      {page ? (
        // The name is the link readers and screen readers use; the picture is a second way to press it.
        <Link to={page} className="wiki-patch-fix-art" tabIndex={-1} aria-hidden="true">
          {art}
        </Link>
      ) : (
        <span className="wiki-patch-fix-art" aria-hidden="true">
          {art}
        </span>
      )}
      <div className="wiki-patch-fix-body">
        <h3>
          {page ? <Link to={page}>{name}</Link> : name}
          {entry.domainLabel && <span>{entry.domainLabel}</span>}
        </h3>
        {lines.length ? (
          <ChangeList changes={lines} hero={hero} overallKind={FIX_KIND} />
        ) : (
          summary && <p lang={row.actualLocale ?? undefined}>{summary}</p>
        )}
      </div>
    </li>
  )
}

/** The bug fixes and optimisations of an update: after the balance changes, one short row for each thing fixed. */
export function PatchFixes({ id, title, entries }: { id: string; title: string; entries: FixEntry[] }) {
  const text = useWikiText()
  return (
    <section id={id} tabIndex={-1} className="wiki-patch-section" aria-labelledby={`${id}-title`}>
      <header className="wiki-updates-heading">
        <div>
          <h2 id={`${id}-title`}>
            {title} <small>{entries.length}</small>
          </h2>
          <p>{text("Lỗi đã sửa và phần chơi được làm mượt hơn.", "Bugs fixed and play made smoother.")}</p>
        </div>
      </header>
      <ul className="wiki-patch-fix-list">
        {entries.map((entry) => (
          <FixRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  )
}
