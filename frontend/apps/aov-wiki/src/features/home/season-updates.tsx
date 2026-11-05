import { useQuery } from "@tanstack/react-query"
import { formatPatchDate, patchSource, seasonUpdatesQuery, type SeasonPatch } from "./home-api"
import { FeedbackDialog } from "../../layout/feedback-dialog"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiIcon } from "../../components/wiki-icon"

function PatchRow({ patch }: { patch: SeasonPatch }) {
  const { locale } = useWikiContext()
  const source = patchSource(patch)
  const content = (
    <>
      <span className="wiki-home-patch-meta">
        <time className="wiki-home-patch-date" dateTime={patch.effectiveOn ?? patch.effectiveAt ?? undefined}>
          {formatPatchDate(patch)}
        </time>
        {patch.isCurrent && (
          <span className="wiki-home-current-tag">{wikiText(locale, "Đang áp dụng", "Current")}</span>
        )}
      </span>
      <span className="wiki-home-patch-title">{patch.title || patch.code}</span>
      {source && <WikiIcon name="open" className="wiki-home-patch-arrow" />}
    </>
  )
  return (
    <li>
      {source ? (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className="wiki-home-patch-row"
          aria-label={wikiText(
            locale,
            `${patch.title || patch.code} — xem nguồn, mở tab mới`,
            `${patch.title || patch.code} — view source in a new tab`,
          )}
        >
          {content}
        </a>
      ) : (
        <div className="wiki-home-patch-row">{content}</div>
      )}
    </li>
  )
}

export function SeasonUpdates() {
  const scope = useWikiContext()
  const { locale, region, t } = scope
  const query = useQuery(seasonUpdatesQuery(scope))
  const marketName = scope.regions.find((market) => market.code === region)?.displayName ?? region

  return (
    <aside className="wiki-home-updates" aria-labelledby="season-updates-title" aria-busy={query.isPending}>
      <div className="wiki-home-updates-heading">
        <h2 id="season-updates-title">
          {wikiText(locale, "Cập nhật mùa", "Season updates")}
          {query.data?.season?.displayName && <small>{query.data.season.displayName}</small>}
        </h2>
        <span className="wiki-home-market" aria-label={`${t("market")}: ${marketName}`}>
          {["VN", "TH", "TW", "ID"].includes(region) ? (
            <img src={`/icons/flags/${region.toLowerCase()}.svg`} alt="" width="18" height="12" />
          ) : (
            <WikiIcon name="globe" size={16} />
          )}
          {region}
        </span>
        <FeedbackDialog
          target={query.data?.season?.displayName || wikiText(locale, "Cập nhật mùa", "Season updates")}
          identity={query.data?.season?.id}
        />
      </div>
      {query.isPending ? (
        <div className="wiki-home-updates-loading" role="status">
          <span className="sr-only">{wikiText(locale, "Đang tải cập nhật mùa", "Loading season updates")}</span>
          <span />
          <span />
          <span />
        </div>
      ) : query.isError ? (
        <div className="wiki-home-updates-empty" role="status">
          <p>{wikiText(locale, "Chưa tải được cập nhật mùa.", "Could not load season updates.")}</p>
          <button className="wiki-home-retry" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <WikiIcon name="reset" /> {t("retry")}
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
    </aside>
  )
}
