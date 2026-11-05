import { Link } from "react-router"
import { patchChangeLabel } from "../../components/patch-changes-row"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { changeKind, publishedNotesForSubject } from "../../lib/published-change-subjects"
import { usePublishedChanges, warehouseChangeDomain } from "../../lib/wiki-patch-changes"
import type { PublishedWarehouseRecord } from "./warehouse-types"

export function WarehouseUpdates({ entry }: { entry: PublishedWarehouseRecord }) {
  const scope = useWikiContext()
  const changes = usePublishedChanges(warehouseChangeDomain[entry.kind], true)
  const t = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const seasons = new Map(scope.options?.seasons.map((s) => [s.id, s]))
  const patches = changes.patches
    .map(({ variant, rows }) => ({ variant, rows: publishedNotesForSubject(rows, entry.id) }))
    .filter(({ rows }) => rows.length)
    .sort(
      (a, b) =>
        (seasons.get(b.variant.seasonId)?.ordinal ?? 0) - (seasons.get(a.variant.seasonId)?.ordinal ?? 0) ||
        b.variant.ordinal - a.variant.ordinal,
    )
  const error = changes.failed || scope.optionsError
  if (!patches.length && !error) return null
  return (
    <section className="space-y-3">
      <h3 className="type-section-title">{t("Thay đổi theo phiên bản", "Changes by version")}</h3>
      {patches.map(({ variant, rows }) => (
        <div key={variant.id} className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h4 className="type-label">
              <Link to={scope.href(`/updates/${variant.code}`)} className="hover:text-primary">
                {variant.code}
              </Link>
            </h4>
            <span className="type-meta">{seasons.get(variant.seasonId)?.displayName}</span>
          </div>
          <ul className="divide-y border-y">
            {rows.map((row, i) => (
              <li key={row.changeSetId ?? row.id ?? i} className="space-y-1 py-2">
                <strong className="type-label">{patchChangeLabel(changeKind(row) ?? "UPDATED", scope.locale)}</strong>
                {row.summary && (
                  <p lang={row.actualLocale ?? undefined} className="type-body whitespace-pre-line">
                    {row.summary}
                  </p>
                )}
                {row.sourceUrl && /^https?:\/\//i.test(row.sourceUrl) && (
                  <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="type-meta underline">
                    {t("Nguồn công bố", "Publication source")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {error && (
        <p role="status" className="type-meta">
          {t("Chưa tải được hết ghi chú.", "Some notes could not be loaded.")}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              if (scope.optionsError) void scope.retryOptions()
              changes.retry()
            }}
          >
            {scope.t("retry")}
          </button>
        </p>
      )}
    </section>
  )
}
