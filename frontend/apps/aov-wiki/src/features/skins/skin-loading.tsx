import type { CSSProperties } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { SkinCollectionHeading } from "./skin-collection-heading"
import { useSkinColumns } from "./skin-columns"
import "./skin-directory.css"

/** Three heroes' rows in the shape the loaded page has: a name, then one row of cards. */
export function SkinGridSkeleton() {
  const { locale } = useWikiContext()
  const columns = useSkinColumns()
  const strip = usePageLayout() === "compact"
  const message = wikiText(locale, "Đang tải trang phục…", "Loading skins…")
  return (
    <div className="wiki-skin-groups" role="status" aria-label={message} aria-busy="true">
      <span className="sr-only">{message}</span>
      {[0, 1, 2].map((row) => (
        <div key={row} aria-hidden="true">
          <div className="wiki-skin-group-heading">
            <span className="wiki-skeleton wiki-skin-heading-skeleton" />
          </div>
          <div className={strip ? "wiki-skin-strip" : "wiki-skin-grid"}>
            {Array.from({ length: strip ? columns + 1 : columns }, (_, index) => (
              <span className="wiki-skin-card wiki-skeleton" key={index} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Shown while the page's own script loads. */
export function SkinDirectoryLoading() {
  const { locale } = useWikiContext()
  const columns = useSkinColumns()
  const compact = usePageLayout() === "compact"
  const message = wikiText(locale, "Đang tải trang phục…", "Loading skins…")
  return (
    <div className="wiki-skin-directory" style={{ "--skin-columns": columns } as CSSProperties} aria-busy="true">
      <SkinCollectionHeading lead={<span className="wiki-skin-summary">{message}</span>} />
      <div className={compact ? "wiki-skin-toolbar wiki-skin-toolbar-compact" : "wiki-skin-toolbar"} aria-hidden="true">
        <span className="wiki-skin-search wiki-skeleton" />
        <span className="wiki-skin-filter wiki-skeleton" />
        {!compact && (
          <>
            <span className="wiki-skin-filter wiki-skeleton" />
            <span className="wiki-skin-filter wiki-skeleton" />
          </>
        )}
      </div>
      {compact && <div className="wiki-skin-status" aria-hidden="true" />}
      <SkinGridSkeleton />
    </div>
  )
}
