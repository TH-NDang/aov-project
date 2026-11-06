import { useState } from "react"
import { Link } from "react-router"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { changeSetKind, parseChangeSummary } from "../../lib/wiki-change-format"
import { ChangeDisclosure, ChangeKind, ChangeList } from "../updates/change-list"
import "../updates/updates.css"
import type { HeroChangeItem } from "../../lib/wiki-change-format"
import type { HeroDetail } from "./hero-api"
import type { HeroVersion } from "./hero-version-changes"

function HistoryChanges({ changes, hero }: { changes: HeroChangeItem[]; hero: HeroDetail }) {
  const [open, setOpen] = useState(false)
  if (!changes.length) return null
  return (
    <ChangeDisclosure count={changes.length} open={open} onToggle={() => setOpen(!open)}>
      <ChangeList changes={changes} hero={hero} />
    </ChangeDisclosure>
  )
}

/** Other patches that changed this hero, newest first; the selected patch is already shown above the abilities. */
export function HeroHistory({ hero, version }: { hero: HeroDetail; version: HeroVersion }) {
  const scope = useWikiContext()
  const { locale, href } = scope
  const rows = version.rows.filter((row) => row.patchVariantId !== version.selected?.id)

  if (!rows.length) return null

  return (
    <section className="wiki-hero-history" aria-labelledby="wiki-hero-history-title">
      <h2 id="wiki-hero-history-title" tabIndex={-1}>
        {wikiText(locale, "Các lần thay đổi khác", "Other changes")}
      </h2>
      <div className="wiki-patch-subjects">
        {rows.map((row, index) => {
          const patch = scope.options?.patches.find((item) => item.id === row.patchVariantId)
          const open = () =>
            patch &&
            scope.setScope(
              patch.isCurrent
                ? { seasonId: "", patchVariantId: "", includeUnscoped: false }
                : { seasonId: patch.seasonId, patchVariantId: patch.id, includeUnscoped: false },
            )
          const summary = parseChangeSummary(row.summary)
          return (
            <article className="wiki-patch-subject public-panel" key={row.id ?? index}>
              <header>
                {patch ? (
                  <button type="button" className="wiki-patch-subject-link" onClick={open}>
                    <strong>{row.patch?.title || patch.code}</strong>
                  </button>
                ) : (
                  <strong>{row.patch?.title || wikiText(locale, "Bản cập nhật", "Update")}</strong>
                )}
                <ChangeKind kind={changeSetKind(row)} />
              </header>
              {summary.text && <p lang={row.actualLocale ?? undefined}>{summary.text}</p>}
              <HistoryChanges changes={row.changes ?? []} hero={hero} />
              {row.patch && (
                <Link className="wiki-hero-history-more" to={href(`/updates/${row.patch.code}`)}>
                  {wikiText(locale, "Xem toàn bộ bản cập nhật", "See the whole update")}
                </Link>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
