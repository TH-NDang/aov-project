import { SECTION_NAMES } from "../../lib/wiki-sections"
import { PatchChangesRow, type ChangedSubject } from "../../components/patch-changes-row"
import { usePublishedChanges, warehouseChangeDomain } from "../../lib/wiki-patch-changes"
import { PublishedWarehouseView } from "./warehouse-view"
import { WarehouseHeading } from "./warehouse-heading"
import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { warehouseCatalogQuery, warehouseGroupsQuery } from "../../lib/warehouse-api"
import { WarehouseCatalog } from "./warehouse-catalogs"
import { WarehouseControls } from "./warehouse-controls"
import { WarehouseDetail } from "./warehouse-detail"
import { WarehouseSkeleton } from "./warehouse-loading"
import { useItemCatalog, warehouseReadingOrder, type WarehouseItem } from "./use-item-catalog"
import {
  warehouseImage,
  warehouseName,
  matchesWarehouseSearch,
  warehouseKind,
  type PublishedWarehouseRecord,
  type WarehouseEntry,
} from "../../lib/warehouse-types"
import "./warehouse-page.css"
import { useWikiContext, useWikiText, wikiText } from "../../context/wiki-context"
import { WikiVersionPicker } from "../../components/wiki-version-picker"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { notFoundMeta, warehouseEntryMeta } from "../../lib/seo/page-meta"
import { usePageHead } from "../../lib/seo/use-page-head"
import { warehousePath } from "../../lib/wiki-catalog"
import { WarehouseTabs } from "./warehouse-tabs"

/** The catalog until it loads; one array, so the lists made from it are not worked out again on every render. */
const NO_ENTRIES: PublishedWarehouseRecord[] = []
/** The entry of the catalog that is open, in whichever catalog is on screen. */
const OPEN_ENTRY =
  ':is(.shop-item-select, .wiki-item-row, .wiki-arcana-row, .wiki-enchantment-node, .wiki-spell-card)[aria-pressed="true"]'

export default function WarehousePage() {
  const scope = useWikiContext()
  const text = useWikiText()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const wide = usePageLayout() === "wide"
  const { tab, entryCode } = useParams()
  const kind = warehouseKind(tab ?? null)
  const changes = usePublishedChanges(warehouseChangeDomain[kind])
  const sectionName = wikiText(scope.locale, ...SECTION_NAMES[kind])
  const search = params.get("q") ?? ""
  const group = params.get("group") ?? ""
  const selectedId = entryCode ?? null
  const trigger = useRef<HTMLButtonElement | null>(null)
  const main = useRef<HTMLDivElement>(null)
  // Where an entry stood on screen before the panel beside the catalog came or went.
  const held = useRef<{ element: HTMLElement; top: number } | null>(null)
  const catalog = useQuery(warehouseCatalogQuery(kind, scope))
  const metadata = useQuery(warehouseGroupsQuery(kind, scope.locale))
  const entries = catalog.data ?? NO_ENTRIES
  const groups = metadata.data ?? []
  const filtered = useMemo(
    () => entries.filter((entry) => matchesWarehouseSearch(entry, search, scope.locale)),
    [entries, search, scope.locale],
  )

  const selectedEntry = entries.find((entry) => entry.id === selectedId || entry.code === selectedId)
  const selectedCode = selectedEntry?.code

  // Rich text and patch notes link entries by id, but the page for sharing and indexing is the one named by code.
  useEffect(() => {
    if (selectedCode && selectedId !== selectedCode)
      void navigate({ pathname: warehousePath(kind, selectedCode), search: window.location.search }, { replace: true })
  }, [kind, navigate, selectedCode, selectedId])

  usePageHead(
    selectedEntry
      ? warehouseEntryMeta(kind, selectedEntry, scope.locale)
      : selectedId && catalog.isSuccess
        ? notFoundMeta(scope.locale, warehousePath(kind, selectedId), kind)
        : null,
  )
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

  /** Remembers where an entry of the catalog stands, so it can be put back there once the layout has changed. */
  function hold(element: HTMLElement | null | undefined) {
    held.current = wide && element ? { element, top: element.getBoundingClientRect().top } : null
  }

  // The catalog gives room to the panel when an entry opens and takes it back when the panel closes. Everything in
  // it moves, so the page scrolls by as much as the entry in hand moved and the reader keeps their place.
  useLayoutEffect(() => {
    const place = held.current
    held.current = null
    if (!place) return
    const settle = () => {
      if (!place.element.isConnected) return
      const moved = place.element.getBoundingClientRect().top - place.top
      if (Math.abs(moved) >= 1) window.scrollBy({ top: moved, behavior: "instant" })
    }
    settle()
    // Cards that refit their text to the new width change height a moment later.
    const frame = requestAnimationFrame(settle)
    return () => cancelAnimationFrame(frame)
  }, [selectedId, wide])

  // Stepping from the panel can land on an entry that is out of view; the catalog follows it.
  const selectedKey = selectedEntry?.id
  const stepped = useRef(false)
  useEffect(() => {
    if (!stepped.current) return
    stepped.current = false
    const card = main.current?.querySelector<HTMLElement>(OPEN_ENTRY)
    if (!card) return
    const { top, bottom } = card.getBoundingClientRect()
    if (top < 72 || bottom > window.innerHeight - 16) card.scrollIntoView({ block: "center" })
  }, [selectedKey])

  function select(entry: WarehouseEntry, button?: HTMLButtonElement) {
    if (button) trigger.current = button
    // A press inside the catalog keeps that entry in place; a step from the panel brings the next one into view.
    if (button && main.current?.contains(button)) hold(button)
    else stepped.current = wide && !!selectedId
    const positions = entry.content.shopPositions ?? []
    const board = itemView.category
    const next = new URLSearchParams(params)
    // Keep the board on a category that shows the item, so its recipe lines stay visible.
    if (kind === "items" && itemView.layout === "shop") {
      const onBoard = positions.some((position) => position.categoryCode === board)
      const home = onBoard ? board : (entry.content.categoryCode ?? positions[0]?.categoryCode)
      if (home) next.set("group", home)
    }
    void navigate(
      { pathname: warehousePath(kind, entry.code), search: `?${next}` },
      // Going from one entry to the next should not fill the back button; opening the sheet still can be undone by it.
      { replace: wide || !!selectedId },
    )
  }

  function clearSelection() {
    // The entry being closed takes focus back, also when it was opened from a link or reached by stepping.
    const open = main.current?.querySelector<HTMLButtonElement>(OPEN_ENTRY)
    if (open) trigger.current = open
    hold(open)
    // An item opened from a link chose the board; the board stays on it once the item closes.
    const next = new URLSearchParams(params)
    if (kind === "items" && itemView.layout === "shop" && itemView.category) next.set("group", itemView.category)
    void navigate({ pathname: warehousePath(kind), search: `?${next}` }, { replace: true })
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

  /** Changes filters kept in the address. A new filter closes the open entry, which lives in the path. */
  function changeFilters(filters: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(filters)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    void navigate({ pathname: warehousePath(kind), search: `?${next}` }, { replace: true })
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

  const version = <WikiVersionPicker changedVariants={changes.changedVariants} />
  const scoped = !!(scope.seasonId || scope.patchVariantId) && !scope.includeUnscoped

  return (
    <PublishedWarehouseView entries={entries} groups={groups} kind={kind}>
      <div className={`wiki-warehouse-page wiki-warehouse-${kind}`}>
        <WarehouseHeading
          kind={kind}
          title={sectionName}
          count={catalog.isPending ? undefined : entries.length}
          action={<div className="wiki-warehouse-version">{version}</div>}
        />
        {!wide && <WarehouseTabs active={kind} />}
        <WarehouseControls
          kind={kind}
          search={search}
          onSearch={setSearch}
          entries={filtered}
          allEntries={entries}
          groups={groups}
          group={group}
          params={params}
          onFilters={changeFilters}
          itemView={itemView}
          loading={catalog.isPending || metadata.isPending}
        />
        {!wide && <div className="wiki-warehouse-version">{version}</div>}
        {metadata.isError && (
          <div className="wiki-warehouse-notice" role="status">
            {text("Chưa tải được bộ lọc nhóm.", "Group filters could not be loaded.")}
            <button type="button" onClick={() => void metadata.refetch()}>
              {wikiText(scope.locale, "Thử lại", "Retry")}
            </button>
          </div>
        )}
        {catalog.isError && catalog.data && (
          <div className="wiki-warehouse-notice" role="status">
            {text(
              "Chưa kết nối lại được. Đang hiển thị dữ liệu đã tải.",
              "Showing cached data while the connection is unavailable.",
            )}
            <button type="button" onClick={() => void catalog.refetch()}>
              {wikiText(scope.locale, "Thử lại", "Retry")}
            </button>
          </div>
        )}
        <PatchChangesRow entries={[...subjects.values()]} failed={changes.failed} retry={changes.retry} />
        <div className="wiki-warehouse-body" data-detail={wide && selectedId ? "" : undefined}>
          <div ref={main} className="wiki-warehouse-main">
            {catalog.isPending ? (
              <WarehouseSkeleton kind={kind} layout={itemView.preferred} />
            ) : catalog.isError && !catalog.data ? (
              <div className="wiki-warehouse-empty wiki-mascot-state" role="status">
                <h2>{text("Chưa tải được dữ liệu", "Data could not be loaded")}</h2>
                <p>{text("Kiểm tra kết nối rồi thử lại.", "Check your connection and try again.")}</p>
                <button type="button" onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>
                  {wikiText(scope.locale, "Thử lại", "Retry")}
                </button>
              </div>
            ) : !filtered.length ? (
              <div className="wiki-warehouse-empty wiki-mascot-state" role="status">
                <h2>
                  {search
                    ? text("Không có kết quả phù hợp", "No matching results")
                    : text("Chưa có dữ liệu công khai tại mốc này", "No verified public data for this scope")}
                </h2>
                <p>
                  {search
                    ? text("Thử tên khác hoặc xóa từ khóa.", "Try another name or clear the search.")
                    : scoped
                      ? text(
                          "Có thể bật kèm dữ liệu nền chưa rõ mốc để tham khảo.",
                          "You can include undated baselines for reference.",
                        )
                      : text(
                          "Các mục sẽ xuất hiện sau khi được biên tập và xuất bản.",
                          "Entries appear after editorial publication.",
                        )}
                </p>
                {!search && scoped && (
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
                  <button type="button" onClick={() => setSearch("")}>
                    {text("Xóa từ khóa", "Clear search")}
                  </button>
                )}
              </div>
            ) : (
              <WarehouseCatalog
                key={kind}
                kind={kind}
                entries={filtered}
                allEntries={entries}
                groups={groups}
                group={group}
                params={params}
                selectedId={selectedEntry?.id ?? selectedId}
                onGroupChange={(value) => changeFilters({ group: value || null })}
                onSelect={select}
                onClear={clearSelection}
                itemView={itemView}
              />
            )}
          </div>
          <WarehouseDetail
            selectedId={selectedId}
            entries={entries}
            order={order}
            kind={kind}
            groups={groups}
            loading={catalog.isPending}
            inline={wide}
            onClose={clearSelection}
            onSelect={select}
            returnFocus={trigger}
          />
        </div>
      </div>
    </PublishedWarehouseView>
  )
}
