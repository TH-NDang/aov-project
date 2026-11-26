import { useEffect } from "react"
import { localeText } from "@aov/ui/lib/locale-text"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { seasonUpdatesQuery, type SeasonPatch } from "./home-api"
import { patchDayLabel } from "../../lib/patch-day-label"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiIcon } from "../../components/wiki-icon"
import { useDragScroll } from "../../lib/use-drag-scroll"
import "./season-updates.css"

function PatchStop({ patch }: { patch: SeasonPatch }) {
  const { locale, href, region, regions } = useWikiContext()
  const date = patch.effectiveOn ?? patch.effectiveAt ?? ""
  return (
    <li data-current={patch.isCurrent || undefined}>
      <Link to={href(`/updates/${patch.code}`)}>
        <span className="wiki-home-stop-when">
          <LocalTime
            className="wiki-home-stop-date"
            value={date}
            sourceTimeZone={regions.find((market) => market.code === region)?.timeZone}
            label={(zone) => patchDayLabel(date, zone)}
            locale={locale}
            fallback={<time className="wiki-home-stop-date">—</time>}
          />
          {patch.isCurrent && (
            <span className="wiki-home-stop-now">{wikiText(locale, "Đang áp dụng", "In force")}</span>
          )}
        </span>
        <span className="wiki-home-stop-title">{patch.title || patch.code}</span>
      </Link>
    </li>
  )
}

/**
 * The versions of the season in force as a timeline at the foot of the current version's block: the season as the bar's
 * title, then a track with a node per version, newest first from the left; the version in force has the lit node and its
 * tag. When the track does not fit it scrolls sideways (a swipe, or a drag with the mouse), snaps to each version and
 * opens on the version in force.
 */
export function SeasonUpdates() {
  const scope = useWikiContext()
  const { locale } = scope
  const t = localeText(locale)
  const query = useQuery(seasonUpdatesQuery(scope))
  const season = query.data?.season?.displayName
  const track = useDragScroll<HTMLOListElement>("horizontal")
  const patches = query.data?.patches

  // Open the track on the version in force, moving only the track and never the page.
  useEffect(() => {
    const element = track.ref.current
    const first = element?.firstElementChild as HTMLElement | null | undefined
    const current = element?.querySelector<HTMLElement>("[data-current]")
    if (element && first && current) element.scrollLeft = current.offsetLeft - first.offsetLeft
  }, [patches, track.ref])

  return (
    <section className="wiki-home-season" aria-labelledby="season-updates-title" aria-busy={query.isPending}>
      <header className="wiki-home-season-head">
        <h3 id="season-updates-title">
          {season ? wikiText(locale, `Mùa ${season}`, `Season ${season}`) : wikiText(locale, "Bản cập nhật", "Updates")}
        </h3>
        <Link className="wiki-home-season-all" to={scope.href("/updates")}>
          {wikiText(locale, "Tất cả", "All")}
          <WikiIcon name="arrow" size={16} />
        </Link>
      </header>
      {query.isPending ? (
        <div className="wiki-home-season-loading" role="status">
          <span className="sr-only">{wikiText(locale, "Đang tải…", "Loading…")}</span>
        </div>
      ) : query.isLoadingError ? (
        <div className="wiki-home-season-empty" role="status">
          <p>{wikiText(locale, "Không tải được các bản cập nhật.", "Updates did not load.")}</p>
          <button className="wiki-home-retry" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <WikiIcon name="reset" /> {t("Thử lại", "Retry")}
          </button>
        </div>
      ) : !query.data.season ? (
        <p className="wiki-home-season-empty">
          {wikiText(locale, "Thị trường này chưa có mùa.", "No season in this market yet.")}
        </p>
      ) : !query.data.patches.length ? (
        <p className="wiki-home-season-empty">
          {wikiText(locale, "Chưa có bản cập nhật nào cho mùa này.", "No updates this season yet.")}
        </p>
      ) : (
        <ol className="wiki-home-timeline" ref={track.ref} {...track.handlers}>
          {query.data.patches.map((patch) => (
            <PatchStop key={patch.id} patch={patch} />
          ))}
        </ol>
      )}
    </section>
  )
}
