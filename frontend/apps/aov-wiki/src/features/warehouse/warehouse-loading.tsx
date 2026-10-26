import { WikiLibraryLayout } from "../../layout/wiki-library-layout"
import "./warehouse-page.css"
import { useWikiContext, wikiText } from "../../context/wiki-context"

export function WarehouseSkeleton() {
  const { locale } = useWikiContext()
  return (
    <div
      className="wiki-warehouse-skeleton-grid"
      aria-label={wikiText(locale, "Đang tải kho trang bị", "Loading armory")}
      role="status"
    >
      {Array.from({ length: 18 }, (_, index) => (
        <div className="wiki-warehouse-skeleton-card" key={index} aria-hidden="true">
          <span className="wiki-skeleton" />
          <span className="wiki-skeleton" />
        </div>
      ))}
    </div>
  )
}

export function WarehouseRouteLoading() {
  const { t } = useWikiContext()
  return (
    <WikiLibraryLayout title={t("warehouse")} searchScope="warehouse">
      <div className="wiki-warehouse-page" aria-busy="true">
        <div className="wiki-warehouse-loading-heading wiki-skeleton" />
        <div className="wiki-warehouse-loading-tabs wiki-skeleton" />
        <WarehouseSkeleton />
      </div>
    </WikiLibraryLayout>
  )
}
