import { useQuery } from "@tanstack/react-query"
import { formatPatchDate, patchSource, seasonUpdatesQuery, type SeasonPatch } from "./home-api"
import { HomeIcon } from "./home-icon"

function PatchRow({ patch }: { patch: SeasonPatch }) {
  const source = patchSource(patch)
  const content = (
    <>
      <time className="wiki-home-patch-date" dateTime={patch.effectiveOn ?? patch.effectiveAt ?? undefined}>
        {formatPatchDate(patch)}
      </time>
      <span className="wiki-home-patch-copy">
        <span className="wiki-home-patch-title">{patch.title || patch.code}</span>
        {patch.isCurrent && <span className="wiki-home-current-tag">Mới nhất</span>}
      </span>
      {source && <HomeIcon name="arrow" className="wiki-home-patch-arrow" />}
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
          aria-label={`${patch.title || patch.code} — xem nguồn, mở tab mới`}
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
  const query = useQuery(seasonUpdatesQuery)

  return (
    <aside className="wiki-home-updates" aria-labelledby="season-updates-title" aria-busy={query.isPending}>
      <div className="wiki-home-updates-heading">
        <span className="wiki-home-eyebrow">CẬP NHẬT MÙA</span>
        <span className="wiki-home-market" aria-label="Thị trường Việt Nam">
          <svg viewBox="0 0 30 20" width="18" height="12" aria-hidden="true">
            <rect width="30" height="20" rx="2" fill="#da251d" />
            <path d="m15 4 1.4 4.3h4.5l-3.6 2.6 1.4 4.3-3.7-2.7-3.7 2.7 1.4-4.3-3.6-2.6h4.5Z" fill="#ffde00" />
          </svg>
          VN
        </span>
      </div>
      <div className="wiki-home-season-title">
        <HomeIcon name="season" />
        <h2 id="season-updates-title">{query.data?.season?.displayName || "Mùa hiện tại"}</h2>
      </div>
      <div className="wiki-home-season-rule" aria-hidden="true">
        <span>◆</span>
      </div>

      {query.isPending ? (
        <div className="wiki-home-updates-loading" role="status">
          <span className="sr-only">Đang tải cập nhật mùa</span>
          <span />
          <span />
          <span />
        </div>
      ) : query.isError ? (
        <div className="wiki-home-updates-empty" role="status">
          <p>Chưa tải được cập nhật mùa.</p>
          <button className="wiki-home-retry" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <HomeIcon name="refresh" /> Thử lại
          </button>
        </div>
      ) : !query.data.season ? (
        <p className="wiki-home-updates-empty">Chưa có mùa đang áp dụng tại Việt Nam.</p>
      ) : !query.data.patches.length ? (
        <p className="wiki-home-updates-empty">Chưa có bản cập nhật được công bố cho mùa này.</p>
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
