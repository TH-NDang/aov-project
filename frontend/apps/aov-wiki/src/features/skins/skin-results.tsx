import type { RefObject } from "react"
import type { PageLayout } from "@aov/ui/hooks/use-page-layout"
import { skinId } from "../../components/skin-preview"
import { useWikiContext, useWikiText, wikiText } from "../../context/wiki-context"
import type { SkinEntry } from "../../lib/skin-api"
import type { SkinSort } from "../../lib/skin-groups"
import { HeroSkinGroup, SkinCard } from "./skin-cards"
import { SkinGridSkeleton } from "./skin-loading"

/**
 * What the filters leave: one grid of skins for a search or a tier across heroes, otherwise a row for each hero that
 * folds after its first line; or why there is nothing to show.
 */
export function SkinResults({
  state,
  groups,
  skins,
  mixed,
  revealed,
  layout,
  columns,
  skinSort,
  hasFilters,
  expanded,
  focusNext,
  retrying,
  onRetry,
  onClearFilters,
  onFold,
  onOpen,
}: {
  state: "loading" | "error" | "ready"
  groups: SkinEntry[][]
  skins: SkinEntry[]
  mixed: boolean
  /** How many skins (in one grid) or heroes (in rows) are drawn so far. */
  revealed: number
  layout: PageLayout
  columns: number
  skinSort: SkinSort
  hasFilters: boolean
  expanded: ReadonlySet<string>
  /** The control to focus once the press that removed the last one has been drawn. */
  focusNext: RefObject<string | null>
  retrying: boolean
  onRetry: () => void
  onClearFilters: () => void
  onFold: (heroId: string, folded: boolean) => void
  onOpen: (skin: SkinEntry) => void
}) {
  const text = useWikiText()
  const { locale } = useWikiContext()
  if (state === "loading") return <SkinGridSkeleton />
  if (state === "error")
    return (
      <div className="wiki-skin-state wiki-mascot-state" role="status">
        <h2>{text("Chưa tải được trang phục", "Skins could not be loaded")}</h2>
        <p>{text("Vui lòng kiểm tra kết nối và thử lại.", "Check your connection and try again.")}</p>
        <button type="button" onClick={onRetry} disabled={retrying}>
          {wikiText(locale, "Thử lại", "Retry")}
        </button>
      </div>
    )
  if (!groups.length)
    return (
      <div className="wiki-skin-state wiki-mascot-state" role="status">
        <h2>
          {hasFilters
            ? text("Không tìm thấy trang phục phù hợp", "No matching skins")
            : text("Chưa có trang phục tại mốc này", "No skins for this scope")}
        </h2>
        <p>
          {hasFilters
            ? text("Thử tên khác hoặc bỏ bớt điều kiện lọc.", "Try another name or fewer filters.")
            : text("Các trang phục đã công bố sẽ xuất hiện tại đây.", "Published skins will appear here.")}
        </p>
        {hasFilters && (
          <button type="button" onClick={onClearFilters}>
            {text("Xóa bộ lọc", "Clear filters")}
          </button>
        )}
      </div>
    )
  if (mixed)
    return (
      <section className="wiki-skin-grid" aria-label={text("Trang phục phù hợp", "Matching skins")}>
        {skins.slice(0, revealed).map((skin) => (
          <SkinCard key={skinId(skin)} skin={skin} showHero onOpen={onOpen} />
        ))}
      </section>
    )
  return (
    <div className="wiki-skin-groups">
      {groups.slice(0, revealed).map((group) => {
        const heroId = group[0].heroId
        const rowId = CSS.escape(`skin-row-${heroId}`)
        return (
          <HeroSkinGroup
            key={`${heroId}:${skinSort}`}
            skins={group}
            layout={layout}
            columns={columns}
            whole={groups.length === 1}
            counted={groups.length > 1 || (layout === "compact" && !hasFilters)}
            expanded={expanded.has(heroId)}
            onExpand={() => {
              focusNext.current = `[data-skin-card="${CSS.escape(skinId(group[columns - 1]))}"]`
              onFold(heroId, false)
            }}
            onCollapse={() => {
              focusNext.current = `#${rowId} > .wiki-skin-more`
              onFold(heroId, true)
            }}
            onOpen={onOpen}
          />
        )
      })}
    </div>
  )
}
