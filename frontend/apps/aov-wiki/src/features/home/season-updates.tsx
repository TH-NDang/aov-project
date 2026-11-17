import { localeText } from "@aov/ui/lib/locale-text"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { seasonUpdatesQuery, type SeasonPatch } from "./home-api"
import { patchDayLabel } from "../../lib/patch-day-label"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiIcon } from "../../components/wiki-icon"

function PatchRow({ patch }: { patch: SeasonPatch }) {
  const { locale, href, region, regions } = useWikiContext()
  const date = patch.effectiveOn ?? patch.effectiveAt ?? ""
  return (
    <li data-current={patch.isCurrent || undefined}>
      <Link to={href(`/updates/${patch.code}`)}>
        <LocalTime
          className="wiki-home-patch-date"
          value={date}
          sourceTimeZone={regions.find((market) => market.code === region)?.timeZone}
          label={(zone) => patchDayLabel(date, zone)}
          locale={locale}
          fallback={<time className="wiki-home-patch-date">—</time>}
        />
        <span className="wiki-home-patch-title">{patch.title || patch.code}</span>
        {patch.isCurrent && (
          <span className="wiki-home-current-tag">{wikiText(locale, "Đang áp dụng", "Current")}</span>
        )}
      </Link>
    </li>
  )
}

/** The versions of the season in force, newest first. */
export function SeasonUpdates() {
  const scope = useWikiContext()
  const { locale } = scope
  const t = localeText(locale)
  const query = useQuery(seasonUpdatesQuery(scope))

  return (
    <section className="wiki-home-updates" aria-labelledby="season-updates-title" aria-busy={query.isPending}>
      <header className="wiki-home-heading">
        <h2 id="season-updates-title">
          {wikiText(locale, "Các bản cập nhật", "Updates")}
          {query.data?.season?.displayName && <small>{query.data.season.displayName}</small>}
        </h2>
        <Link className="wiki-home-more" to={scope.href("/updates")}>
          {wikiText(locale, "Tất cả", "All")}
          <WikiIcon name="arrow" size={16} />
        </Link>
      </header>
      {query.isPending ? (
        <div className="wiki-home-updates-loading" role="status">
          <span className="sr-only">{wikiText(locale, "Đang tải cập nhật mùa", "Loading season updates")}</span>
          <span />
          <span />
          <span />
        </div>
      ) : query.isLoadingError ? (
        <div className="wiki-home-updates-empty" role="status">
          <p>{wikiText(locale, "Chưa tải được cập nhật mùa.", "Could not load season updates.")}</p>
          <button className="wiki-home-retry" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <WikiIcon name="reset" /> {t("Thử lại", "Retry")}
          </button>
        </div>
      ) : !query.data.season ? (
        <p className="wiki-home-updates-empty">
          {wikiText(locale, "Thị trường này chưa có mùa hiện hành.", "This market has no current season.")}
        </p>
      ) : !query.data.patches.length ? (
        <p className="wiki-home-updates-empty">
          {wikiText(
            locale,
            "Chưa có bản cập nhật được công bố cho mùa này.",
            "No updates have been published for this season.",
          )}
        </p>
      ) : (
        <ol className="wiki-home-patch-list">
          {query.data.patches.map((patch) => (
            <PatchRow key={patch.id} patch={patch} />
          ))}
        </ol>
      )}
    </section>
  )
}
