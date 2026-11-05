import { SkinCollectionHeading } from "./skin-collection-heading"
import "./skin-directory.css"
import { useWikiContext, wikiText } from "../../context/wiki-context"

export function SkinGridSkeleton() {
  const { locale } = useWikiContext()
  const message = wikiText(locale, "Đang tải trang phục…", "Loading skins…")
  return (
    <div className="wiki-skin-groups" role="status" aria-label={message} aria-busy="true">
      <span className="sr-only">{message}</span>
      {[0, 1].map((row) => (
        <div key={row} aria-hidden="true">
          <div className="wiki-skin-group-heading">
            <span className="wiki-skeleton wiki-skin-heading-skeleton" />
          </div>
          <div className="wiki-skin-row">
            {Array.from({ length: 7 }, (_, index) => (
              <div className="wiki-skin-card wiki-skin-skeleton" aria-hidden="true" key={index}>
                <span className="wiki-skin-frame wiki-skeleton" />
                <span className="wiki-skin-card-caption">
                  <span className="wiki-skin-name-skeleton wiki-skeleton" />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkinDirectoryLoading() {
  return (
    <div className="wiki-skin-directory" aria-busy="true">
      <SkinCollectionHeading />
      <div className="wiki-skin-toolbar" aria-hidden="true">
        <span className="wiki-skin-search wiki-skeleton" />
        <div className="wiki-skin-filter-strip">
          <span className="wiki-skin-select wiki-skeleton" />
          <span className="wiki-skin-select wiki-skeleton" />
        </div>
      </div>
      <SkinGridSkeleton />
    </div>
  )
}
