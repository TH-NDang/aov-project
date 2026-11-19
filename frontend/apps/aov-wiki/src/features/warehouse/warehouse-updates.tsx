import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { ChangeKindLabel } from "../../components/patch-changes-row"
import { useWikiContext, useWikiText, wikiText } from "../../context/wiki-context"
import { changeKind, publishedNotesForSubject } from "../../lib/published-change-subjects"
import { usePublishedChanges, warehouseChangeDomain } from "../../lib/wiki-patch-changes"
import type { PublishedWarehouseRecord } from "../../lib/warehouse-types"

export function WarehouseUpdates({ entry }: { entry: PublishedWarehouseRecord }) {
  const scope = useWikiContext()
  const changes = usePublishedChanges(warehouseChangeDomain[entry.kind], true)
  const t = useWikiText()
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
    <section>
      <h3>{t("Thay đổi theo phiên bản", "Changes by version")}</h3>
      {patches.map(({ variant, rows }) => (
        <div key={variant.id} className="wiki-warehouse-update">
          <h4>
            <Link to={scope.href(`/updates/${variant.code}`)}>
              {/* A version goes by the day it took effect, as the version picker names it. */}
              <LocalTime value={variant.regionalDate} locale={scope.locale} fallback={variant.title || variant.code} />
            </Link>
            <small>{seasons.get(variant.seasonId)?.displayName}</small>
          </h4>
          <ul>
            {rows.map((row, i) => (
              <li key={row.changeSetId ?? row.id ?? i}>
                <strong>
                  <ChangeKindLabel kind={changeKind(row) ?? "UPDATED"} />
                </strong>
                {row.summary && <p lang={row.actualLocale ?? undefined}>{row.summary}</p>}
                {row.sourceUrl && /^https?:\/\//i.test(row.sourceUrl) && (
                  <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {t("Nguồn công bố", "Publication source")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {error && (
        <p role="status" className="wiki-warehouse-detail-note">
          {t("Chưa tải được hết ghi chú.", "Some notes could not be loaded.")}{" "}
          <button
            type="button"
            onClick={() => {
              if (scope.optionsError) void scope.retryOptions()
              changes.retry()
            }}
          >
            {wikiText(scope.locale, "Thử lại", "Retry")}
          </button>
        </p>
      )}
    </section>
  )
}
