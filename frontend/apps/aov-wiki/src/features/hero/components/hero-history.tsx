import { useState } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../../context/wiki-context"
import { changeSetKind, parseChangeSummary } from "../../../lib/wiki-change-format"
import { ChangeDisclosure, ChangeKind, ChangeList } from "../../../components/change-list"
import type { HeroChangeItem } from "../../../lib/wiki-change-format"
import type { HeroDetail } from "../../../lib/hero-api"
import { orderedPatches } from "../../../lib/hero-patch-line"
import { PatchName } from "../../../components/hero-patch-name"
import { usePatchOpener, type HeroVersion } from "./hero-version-changes"

function HistoryChanges({ changes, hero }: { changes: HeroChangeItem[]; hero: HeroDetail }) {
  const [open, setOpen] = useState(false)
  if (!changes.length) return null
  return (
    <ChangeDisclosure count={changes.length} open={open} onToggle={() => setOpen(!open)}>
      <ChangeList changes={changes} hero={hero} />
    </ChangeDisclosure>
  )
}

/**
 * Other versions that changed this hero, newest first; the selected version is already shown above the abilities.
 * A long past stays folded: the first few versions show, the rest on request.
 */
export function HeroHistory({ hero, version }: { hero: HeroDetail; version: HeroVersion }) {
  const scope = useWikiContext()
  const { href } = scope
  const text = useWikiText()
  const open = usePatchOpener()
  const limit = usePageLayout() === "compact" ? 2 : 4
  const [expanded, setExpanded] = useState(false)
  const line = orderedPatches(scope.options?.patches ?? [], scope.options?.seasons ?? [])
  const position = (id?: string) => line.findIndex((patch) => patch.id === id)
  const rows = version.rows
    .filter((row) => row.patchVariantId !== version.selected?.id)
    .sort((a, b) => position(b.patchVariantId) - position(a.patchVariantId))

  if (!rows.length) return null

  const name = hero.content.profile?.name ?? hero.code
  const shown = expanded ? rows : rows.slice(0, limit)
  const title = text("Các lần thay đổi khác", "Other changes")

  return (
    <section className="wiki-hero-history" aria-labelledby="wiki-hero-history-title">
      <header className="wiki-hero-section-head">
        <h2 id="wiki-hero-history-title" tabIndex={-1}>
          {title}
          <small>{rows.length}</small>
        </h2>
      </header>
      <ol className="wiki-hero-history-list">
        {shown.map((row, index) => {
          const patch = line.find((item) => item.id === row.patchVariantId)
          const code = patch?.code ?? row.patch?.code
          const summary = parseChangeSummary(row.summary)
          return (
            <li className="wiki-hero-history-entry" key={row.id ?? index}>
              {code && <span className="wiki-hero-history-day">{patch ? <PatchName patch={patch} /> : code}</span>}
              <div className="wiki-hero-history-body">
                <header>
                  <h3>{row.patch?.title || code || text("Bản cập nhật", "Update")}</h3>
                  <ChangeKind kind={changeSetKind(row)} />
                </header>
                {summary.text && <p lang={row.actualLocale ?? undefined}>{summary.text}</p>}
                <HistoryChanges changes={row.changes ?? []} hero={hero} />
                <div className="wiki-version-links">
                  {patch && (
                    <button type="button" onClick={() => open(patch)}>
                      {text(`Xem ${name} ở bản này`, `See ${name} at this version`)}
                    </button>
                  )}
                  {row.patch && (
                    <Link to={href(`/updates/${row.patch.code}`)}>
                      {text("Xem ghi chú đầy đủ", "See the full notes")} <WikiIcon name="arrow" size={14} />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {rows.length > limit && (
        <button
          type="button"
          className="wiki-hero-more"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <WikiIcon name="chevron" size={16} />
          {expanded
            ? text("Thu gọn", "Show less")
            : text(`Xem thêm ${rows.length - limit} lần thay đổi`, `Show ${rows.length - limit} more`)}
        </button>
      )}
    </section>
  )
}
