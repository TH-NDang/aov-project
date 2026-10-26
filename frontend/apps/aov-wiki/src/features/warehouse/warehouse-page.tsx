import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { WikiLibraryLayout } from "../../layout/wiki-library-layout"
import { warehouseCatalogQuery, warehouseGroupsQuery } from "./warehouse-api"
import { WarehouseCatalog } from "./warehouse-catalogs"
import { WarehouseDetail } from "./warehouse-detail"
import { WarehouseIcon } from "./warehouse-icon"
import { WarehouseSkeleton } from "./warehouse-loading"
import { matchesWarehouseSearch, WAREHOUSE_SECTIONS, type WarehouseEntry } from "./warehouse-types"
import "./warehouse-page.css"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiVersionPicker } from "../../components/wiki-version-picker"

export default function WarehousePage() {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const [params, setParams] = useSearchParams()
  const kind = WAREHOUSE_SECTIONS.find((section) => section.kind === params.get("tab"))?.kind ?? "items"
  const sectionName = scope.t(kind)
  const query = params.get("q") ?? ""
  const group = params.get("group") ?? ""
  const selectedId = params.get("item")
  const [search, setSearch] = useState(query)
  const deferredSearch = useDeferredValue(search)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const catalog = useQuery(warehouseCatalogQuery(kind, scope))
  const metadata = useQuery(warehouseGroupsQuery(kind, scope.locale))
  const entries = catalog.data ?? []
  const groups = metadata.data ?? []
  const filtered = useMemo(
    () => entries.filter((entry) => matchesWarehouseSearch(entry, deferredSearch)),
    [entries, deferredSearch],
  )

  useEffect(() => {
    setSearch(query)
  }, [query])
  useEffect(() => {
    if (search.trim() === query) return
    const timeout = window.setTimeout(
      () =>
        setParams(
          (current) => {
            const next = new URLSearchParams(current)
            if (search.trim()) next.set("q", search.trim())
            else next.delete("q")
            return next
          },
          { replace: true },
        ),
      250,
    )
    return () => window.clearTimeout(timeout)
  }, [search, query, setParams])

  function select(entry: WarehouseEntry, button?: HTMLButtonElement) {
    if (button) trigger.current = button
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set("item", entry.id)
      return next
    })
  }

  function clearFilters() {
    setSearch("")
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
    <WikiLibraryLayout title={sectionName} searchScope="warehouse">
      <div className={`wiki-warehouse-page wiki-warehouse-${kind}`}>
        <nav className="wiki-warehouse-breadcrumb" aria-label={text("Đường dẫn", "Breadcrumb")}>
          <Link to={scope.href("/")}>{scope.t("home")}</Link>
          <span>/</span>
          <span>{scope.t("warehouse")}</span>
        </nav>
        <div className="wiki-warehouse-intro">
          <header className="wiki-warehouse-heading">
            <div className="wiki-warehouse-heading-title">
              <span className="wiki-warehouse-heading-emblem">
                <WarehouseIcon name={kind} size={26} />
              </span>
              <div>
                <span className="wiki-warehouse-eyebrow">{scope.t("warehouse").toLocaleUpperCase(scope.locale)}</span>
                <h1>{sectionName}</h1>
              </div>
            </div>
            <span className="wiki-warehouse-total" role="status">
              {catalog.data && <span className="wiki-warehouse-live-dot" />}
              {catalog.isPending
                ? scope.t("loading")
                : catalog.isError && !catalog.data
                  ? text("Chưa kết nối", "Offline")
                  : `${entries.length.toLocaleString(scope.locale)} ${text("mục", "entries")}`}
              <span className="wiki-warehouse-region"> · {scope.region}</span>
            </span>
          </header>
          <nav className="wiki-warehouse-tabs" aria-label={text("Các mục trong kho trang bị", "Armory sections")}>
            {WAREHOUSE_SECTIONS.map((tab) => (
              <Link
                key={tab.kind}
                to={scope.href(`/warehouse?tab=${tab.kind}`)}
                aria-current={kind === tab.kind ? "page" : undefined}
                aria-label={scope.t(tab.kind)}
                title={scope.t(tab.kind)}
              >
                <WarehouseIcon name={tab.kind} />
                <span>{scope.t(tab.kind)}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="wiki-warehouse-toolbar">
          <WikiVersionPicker />
          <div className="wiki-warehouse-tools" data-search-active={search.trim() ? "true" : undefined}>
            <label className="wiki-warehouse-search">
              <WarehouseIcon name="search" size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={120}
                placeholder={`${text("Tìm", "Search")} ${sectionName.toLocaleLowerCase(scope.locale)}…`}
                aria-label={`${text("Tìm", "Search")} ${sectionName.toLocaleLowerCase(scope.locale)}`}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label={text("Xóa tìm kiếm", "Clear search")}>
                  <WarehouseIcon name="close" size={15} />
                </button>
              )}
            </label>
            {(search || group) && (
              <button
                className="wiki-warehouse-reset"
                type="button"
                onClick={clearFilters}
                aria-label={text("Xóa bộ lọc", "Clear filters")}
                title={text("Xóa bộ lọc", "Clear filters")}
              >
                <WarehouseIcon name="reset" size={16} />
                <span>{text("Xóa lọc", "Clear filters")}</span>
              </button>
            )}
            {catalog.isFetching && !catalog.isPending && (
              <span className="wiki-warehouse-refreshing" role="status">
                {text("Đang cập nhật…", "Refreshing…")}
              </span>
            )}
          </div>
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
                : scope.seasonId || scope.patchVariantId
                  ? text(
                      "Có thể bật kèm dữ liệu nền chưa rõ mốc để tham khảo.",
                      "You can include undated baselines for reference.",
                    )
                  : text(
                      "Các mục sẽ xuất hiện sau khi được biên tập và xuất bản.",
                      "Entries appear after editorial publication.",
                    )}
            </p>
            {search && (
              <button type="button" onClick={clearFilters}>
                {text("Xóa bộ lọc", "Clear filters")}
              </button>
            )}
          </div>
        ) : (
          <WarehouseCatalog
            kind={kind}
            entries={filtered}
            allEntries={entries}
            groups={groups}
            group={group}
            selectedId={selectedId}
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
          />
        )}
        <WarehouseDetail
          selectedId={selectedId}
          entries={entries}
          kind={kind}
          groups={groups}
          loading={catalog.isPending}
          onClose={() =>
            setParams(
              (current) => {
                const next = new URLSearchParams(current)
                next.delete("item")
                return next
              },
              { replace: true },
            )
          }
          onSelect={select}
          returnFocus={trigger}
        />
      </div>
    </WikiLibraryLayout>
  )
}
