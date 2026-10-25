import { SkinCollectionHeading } from "./skin-collection-heading"
import "./skin-directory.css"

export function SkinGridSkeleton() {
  return (
    <div className="wiki-skin-grid" role="status" aria-label="Đang tải trang phục" aria-busy="true">
      <span className="sr-only">Đang tải trang phục…</span>
      {Array.from({ length: 12 }, (_, index) => (
        <div className="wiki-skin-card wiki-skin-skeleton" aria-hidden="true" key={index}>
          <span className="wiki-skin-frame wiki-skeleton" />
          <span className="wiki-skin-card-caption">
            <span className="wiki-skin-name-skeleton wiki-skeleton" />
            <span className="wiki-skin-card-bottom">
              <span className="wiki-skin-owner-skeleton wiki-skeleton" />
            </span>
          </span>
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
