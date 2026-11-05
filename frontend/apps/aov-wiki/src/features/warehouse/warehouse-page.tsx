import { PatchChangesRow, type ChangedSubject } from "../../components/patch-changes-row"
import { usePublishedChanges, warehouseChangeDomain } from "../../lib/wiki-patch-changes"
import { PublishedWarehouseView } from "./warehouse-view"
import { CatalogHeading } from "../../layout/catalog-heading"
import { useMemo, useRef } from "react"
import { useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { warehouseCatalogQuery, warehouseGroupsQuery } from "./warehouse-api"
import { ItemLayoutToggle, WarehouseCatalog } from "./warehouse-catalogs"
import { WarehouseDetail } from "./warehouse-detail"
import { WarehouseIcon } from "./warehouse-icon"
import { WarehouseSkeleton } from "./warehouse-loading"
import { useDetailPanel, useItemCatalog, warehouseReadingOrder, type WarehouseItem } from "./use-item-catalog"
import { WikiIcon } from "../../components/wiki-icon"
import {
  warehouseImage,
  warehouseName,
  matchesWarehouseSearch,
  warehouseKind,
  type PublishedWarehouseRecord,
  type WarehouseEntry,
} from "./warehouse-types"
import "./warehouse-page.css"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiVersionPicker } from "../../components/wiki-version-picker"

export default function WarehousePage() {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const [params, setParams] = useSearchParams()
  const kind = warehouseKind(params.get("tab"))
  const changes = usePublishedChanges(warehouseChangeDomain[kind])
  const sectionName = scope.t(kind)
  const search = params.get("q") ?? ""
  const group = params.get("group") ?? ""
  const selectedId = params.get("item")
  const trigger = useRef<HTMLButtonElement | null>(null)
  const catalog = useQuery(warehouseCatalogQuery(kind, scope))
  const metadata = useQuery(warehouseGroupsQuery(kind, scope.locale))
  const entries = catalog.data ?? []
  const groups = metadata.data ?? []
  const filtered = useMemo(
    () => entries.filter((entry) => matchesWarehouseSearch(entry, search, scope.locale)),
    [entries, search, scope.locale],
  )

  const panel = useDetailPanel()
  const selectedEntry = entries.find((entry) => entry.id === selectedId || entry.code === selectedId)
  const items = useMemo(() => entries.filter((entry): entry is WarehouseItem => entry.kind === "items"), [entries])
  const matchingItems = useMemo(
    () => filtered.filter((entry): entry is WarehouseItem => entry.kind === "items"),
    [filtered],
  )
  const itemView = useItemCatalog({
    items,
    matches: matchingItems,
    groups,
    group,
    selected: selectedEntry?.kind === "items" ? selectedEntry : undefined,
    locale: scope.locale,
  })
  const order: PublishedWarehouseRecord[] =
    kind === "items" ? itemView.order : warehouseReadingOrder(kind, filtered, group, groups, params, scope.locale)

  function select(entry: WarehouseEntry, button?: HTMLButtonElement) {
    if (button) trigger.current = button
    const positions = entry.content.shopPositions ?? []
    const board = itemView.category
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set("item", entry.id)
        // Keep the board on a category that shows the item, so its recipe lines stay visible.
        if (kind === "items" && itemView.layout === "shop") {
          const onBoard = positions.some((position) => position.categoryCode === board)
          const home = onBoard ? board : (entry.content.categoryCode ?? positions[0]?.categoryCode)
          if (home) next.set("group", home)
        }
        return next
      },
      // Going from one entry to the next should not fill the back button; opening the sheet still can be undone by it.
      { replace: panel || !!selectedId },
    )
  }

  function clearSelection() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete("item")
        return next
      },
      { replace: true },
    )
  }

  function setSearch(value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set("q", value)
        else next.delete("q")
        return next
      },
      { replace: true },
    )
  }

  const changed = filtered.filter((entry) => changes.subjects.has(entry.id))
  const subjects = new Map<string, ChangedSubject>(
    changed.map((entry) => [
      entry.id,
      {
        id: entry.id,
        name: warehouseName(entry, scope.locale),
        kind: changes.subjects.get(entry.id)?.kind,
        image: warehouseImage(entry),
        open: (button) => select(entry, button),
      },
    ]),
  )
  for (const { id, name, kind } of changes.subjects.values()) {
    if (name && !subjects.has(id) && !entries.some((e) => e.id === id) && !search) subjects.set(id, { id, name, kind })
  }
  function clearFilters() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const key of ["q", "group", "item"]) next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  return (
    <PublishedWarehouseView entries={entries} groups={groups} kind={kind}>
      <div className={`wiki-warehouse-page wiki-warehouse-${kind}`}>
        <CatalogHeading title={sectionName} section={scope.t("warehouse")} />
        <div className="wiki-warehouse-toolbar">
          <WikiVersionPicker changedVariants={changes.changedVariants} />
          <label className="wiki-hero-search wiki-warehouse-search">
            <WikiIcon name="search" size={18} />
            <span className="sr-only">{text("Tìm trong mục này", "Search this section")}</span>
            <input
              type="search"
              value={search}
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                kind === "items"
                  ? text("Tìm theo tên, hiệu ứng…", "Search names, effects…")
                  : text("Tìm trong mục này…", "Search this section…")
              }
            />
          </label>
          {kind === "items" && groups.length > 0 && <ItemLayoutToggle view={itemView} />}
        </div>
        {metadata.isError && (
          <div className="wiki-warehouse-notice">
            {text("Chưa tải được bộ lọc nhóm.", "Group filters could not be loaded.")}
            <button type="button" onClick={() => void metadata.refetch()}>
              {scope.t("retry")}
            </button>
          </div>
        )}
        {catalog.isError && catalog.data && (
          <div className="wiki-warehouse-notice">
            {text(
              "Chưa kết nối lại được. Đang hiển thị dữ liệu đã tải.",
              "Showing cached data while the connection is unavailable.",
            )}
            <button type="button" onClick={() => void catalog.refetch()}>
              {scope.t("retry")}
            </button>
          </div>
        )}
        <PatchChangesRow entries={[...subjects.values()]} failed={changes.failed} retry={changes.retry} />
        <div className="wiki-warehouse-body">
          <div className="wiki-warehouse-main" data-warehouse-density="compact">
            {catalog.isPending ? (
              <WarehouseSkeleton />
            ) : catalog.isError && !catalog.data ? (
              <div className="wiki-warehouse-empty">
                <WarehouseIcon name={kind} size={46} />
                <h2>{text("Chưa tải được dữ liệu", "Data could not be loaded")}</h2>
                <button type="button" onClick={() => void catalog.refetch()}>
                  {scope.t("retry")}
                </button>
              </div>
            ) : !filtered.length ? (
              <div className="wiki-warehouse-empty">
                <WarehouseIcon name={search ? "search" : kind} size={46} />
                <h2>
                  {search
                    ? text("Không có kết quả phù hợp", "No matching results")
                    : text("Chưa có dữ liệu công khai tại mốc này", "No verified public data for this scope")}
                </h2>
                <p>
                  {search
                    ? text("Thử tên khác hoặc xóa bộ lọc.", "Try another name or clear filters.")
                    : (scope.seasonId || scope.patchVariantId) && !scope.includeUnscoped
                      ? text(
                          "Có thể bật kèm dữ liệu nền chưa rõ mốc để tham khảo.",
                          "You can include undated baselines for reference.",
                        )
                      : text(
                          "Các mục sẽ xuất hiện sau khi được biên tập và xuất bản.",
                          "Entries appear after editorial publication.",
                        )}
                </p>
                {!search && (scope.seasonId || scope.patchVariantId) && !scope.includeUnscoped && (
                  <button
                    type="button"
                    onClick={() =>
                      scope.setScope({
                        seasonId: scope.seasonId,
                        patchVariantId: scope.patchVariantId,
                        includeUnscoped: true,
                      })
                    }
                  >
                    {text("Xem thêm dữ liệu chưa rõ patch", "Include undated entries")}
                  </button>
                )}
                {search && (
                  <button type="button" onClick={clearFilters}>
                    {text("Xóa bộ lọc", "Clear filters")}
                  </button>
                )}
              </div>
            ) : (
              <>
                <WarehouseCatalog
                  key={kind}
                  kind={kind}
                  entries={filtered}
                  allEntries={entries}
                  groups={groups}
                  group={group}
                  selectedId={selectedEntry?.id ?? selectedId}
                  onGroupChange={(value) =>
                    setParams(
                      (current) => {
                        const next = new URLSearchParams(current)
                        if (value) next.set("group", value)
                        else next.delete("group")
                        next.delete("item")
                        return next
                      },
                      { replace: true },
                    )
                  }
                  onSelect={select}
                  onClear={clearSelection}
                  itemView={itemView}
                />
              </>
            )}
          </div>
          <WarehouseDetail
            selectedId={selectedId}
            entries={entries}
            order={order}
            kind={kind}
            groups={groups}
            loading={catalog.isPending}
            inline={panel}
            onClose={clearSelection}
            onSelect={select}
            returnFocus={trigger}
          />
        </div>
      </div>
    </PublishedWarehouseView>
  )
}
