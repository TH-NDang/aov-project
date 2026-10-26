import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WarehouseArtwork } from "./warehouse-artwork"
import { warehouseText, type WarehouseEntry, type WarehouseGroup } from "./warehouse-types"
import {
  routeShopWire,
  selectedShopEdges,
  shopColumnSections,
  shopEdges,
  warehouseShopLayout,
  type ShopCardRect,
} from "./warehouse-shop-layout"
import "./warehouse-shop.css"

interface ShopProps {
  entries: WarehouseEntry[]
  groups: WarehouseGroup[]
  category: string
  selectedId: string | null
  visibleIds?: ReadonlySet<string>
  onOpen: (entry: WarehouseEntry, button: HTMLButtonElement) => void
}

interface RecipeWire {
  key: string
  path: string
  direct: boolean
}

function ShopCard({
  entry,
  selected,
  related,
  matchesSearch,
  onSelect,
  onOpen,
}: {
  entry: WarehouseEntry
  selected: boolean
  related: boolean
  matchesSearch?: boolean
  onSelect: () => void
  onOpen: (button: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const name = warehouseText(entry.content.translations, locale)?.name || entry.code

  return (
    <div
      className="wiki-warehouse-shop-card"
      data-shop-card={entry.id}
      data-selected={selected || undefined}
      data-related={related || undefined}
      data-search-match={matchesSearch === undefined ? undefined : String(matchesSearch)}
    >
      <button
        className="wiki-warehouse-shop-select"
        type="button"
        aria-pressed={selected}
        aria-label={`${wikiText(locale, `Xem đường ghép của ${name}`, `Show recipe connections for ${name}`)}${matchesSearch === undefined ? "" : matchesSearch ? wikiText(locale, " · Khớp tìm kiếm", " · Search match") : wikiText(locale, " · Ngoài kết quả tìm kiếm", " · Outside search results")}`}
        onClick={onSelect}
      >
        <WarehouseArtwork entry={entry} kind="items" />
        <span className="wiki-warehouse-shop-caption">
          <strong>{name}</strong>
          <span className="wiki-warehouse-shop-meta">
            {entry.content.price != null && (
              <span className="wiki-warehouse-shop-price">
                <i aria-hidden="true" />
                {entry.content.price.toLocaleString(locale)}
                <small>{wikiText(locale, "vàng", "gold")}</small>
              </span>
            )}
            {entry.content.tier != null && (
              <small className="wiki-warehouse-shop-tier">
                {wikiText(locale, "Cấp", "Tier")} {entry.content.tier}
              </small>
            )}
          </span>
          {entry.revision.effectiveFromPatchVariantId === null && (
            <span className="wiki-warehouse-shop-undated">{wikiText(locale, "Chưa rõ mốc", "Undated baseline")}</span>
          )}
        </span>
      </button>
      <button
        className="wiki-warehouse-shop-open"
        type="button"
        aria-label={wikiText(locale, `Xem ${name}`, `View ${name}`)}
        title={wikiText(locale, "Mở chi tiết", "Open details")}
        onClick={(event) => onOpen(event.currentTarget)}
      >
        <WikiIcon name="open" size={16} />
      </button>
    </div>
  )
}

export function WarehouseShop({ entries, groups, category, selectedId, visibleIds, onOpen }: ShopProps) {
  const { locale } = useWikiContext()
  const [focusedId, setFocusedId] = useState<string | null>(selectedId)
  const [wires, setWires] = useState<RecipeWire[]>([])
  const canvas = useRef<HTMLDivElement>(null)
  const markerId = `shop-arrow-${useId().replaceAll(":", "")}`
  const selected = entries.find((entry) => entry.id === focusedId)
  const activeId = selected?.id ?? null
  const layout = useMemo(() => warehouseShopLayout(entries, category, activeId), [entries, category, activeId])
  const edges = useMemo(() => selectedShopEdges(shopEdges(entries), activeId), [entries, activeId])
  const relatedIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]))
  const columns = Math.max(
    3,
    ...layout.placements.map((placement) => placement.column + 1),
    ...layout.external.map((placement) => (placement.column ?? -1) + 1),
  )
  const unplaced = [
    ...layout.unplaced,
    ...layout.external.filter((placement) => placement.column === null).map((placement) => placement.entry),
  ]
  const selectedName = selected ? warehouseText(selected.content.translations, locale)?.name || selected.code : ""
  const searchActive = visibleIds !== undefined && visibleIds.size < entries.length

  useLayoutEffect(() => {
    const element = canvas.current
    if (!element || !edges.length) {
      setWires((previous) => (previous.length ? [] : previous))
      return
    }
    let frame = 0
    function measure() {
      if (!element) return
      const bounds = element.getBoundingClientRect()
      const cards = new Map<string, ShopCardRect>()
      element.querySelectorAll<HTMLElement>("[data-shop-card]").forEach((card) => {
        const rect = card.getBoundingClientRect()
        cards.set(card.dataset.shopCard!, {
          left: rect.left - bounds.left,
          right: rect.right - bounds.left,
          top: rect.top - bounds.top,
          bottom: rect.bottom - bounds.top,
        })
      })
      const obstacles = [...cards.values()]
      const next = edges.flatMap((edge, index): RecipeWire[] => {
        const source = cards.get(edge.from)
        const target = cards.get(edge.to)
        if (!source || !target) return []
        const route = routeShopWire(source, target, obstacles, index)
        if (!route) return []
        return [
          {
            key: `${edge.from}:${edge.to}`,
            direct: edge.direct,
            path: route.map((point, pointIndex) => `${pointIndex ? "L" : "M"}${point.x} ${point.y}`).join(" "),
          },
        ]
      })
      setWires((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
    }
    function queueMeasure() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    const observer = new ResizeObserver(queueMeasure)
    observer.observe(element)
    element.querySelectorAll<HTMLElement>("[data-shop-card]").forEach((card) => observer.observe(card))
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [edges, layout])

  function renderCard(entry: WarehouseEntry) {
    return (
      <ShopCard
        entry={entry}
        key={entry.id}
        selected={entry.id === activeId}
        related={relatedIds.has(entry.id)}
        matchesSearch={searchActive ? visibleIds?.has(entry.id) : undefined}
        onSelect={() => setFocusedId((current) => (current === entry.id ? null : entry.id))}
        onOpen={(button) => {
          setFocusedId(entry.id)
          onOpen(entry, button)
        }}
      />
    )
  }

  return (
    <section
      className="wiki-warehouse-shop"
      aria-label={wikiText(locale, "Cửa hàng và đường ghép trang bị", "Equipment shop and recipes")}
    >
      <div className="wiki-warehouse-shop-guide" role="status" data-selected={selected ? "true" : undefined}>
        <WikiIcon name="items" size={16} />
        <span>
          {selected
            ? selectedName
            : wikiText(locale, "Chọn món để xem đường ghép", "Select equipment to trace recipes")}
        </span>
        {selected && (
          <button
            type="button"
            aria-label={wikiText(locale, "Hủy chọn trang bị", "Clear equipment selection")}
            onClick={() => setFocusedId(null)}
          >
            <WikiIcon name="close" size={14} />
          </button>
        )}
        {selected && (
          <div className="wiki-warehouse-shop-legend">
            <span>
              <i />
              {wikiText(locale, "Nguyên liệu trực tiếp", "Direct ingredients")}
            </span>
            <span>
              <i />
              {wikiText(locale, "Liên quan", "Related recipes")}
            </span>
          </div>
        )}
      </div>
      <div
        className="wiki-warehouse-shop-scroll"
        tabIndex={0}
        role="region"
        aria-label={wikiText(locale, "Cửa hàng trang bị, có thể cuộn ngang", "Equipment shop, scroll horizontally")}
      >
        <div
          className="wiki-warehouse-shop-canvas"
          ref={canvas}
          style={{ "--shop-columns": columns } as CSSProperties}
          onClick={(event) => {
            if (!(event.target as HTMLElement).closest("[data-shop-card],button,a,summary")) setFocusedId(null)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setFocusedId(null)
          }}
        >
          <div className="wiki-warehouse-shop-columns">
            {Array.from({ length: columns }, (_, column) => {
              const sections = shopColumnSections(layout.placements, column)
              const external = layout.external.filter((placement) => placement.column === column)
              const externalGroups = [...new Set(external.map((placement) => placement.categoryCode))]
              return (
                <section className="wiki-warehouse-shop-column" key={column}>
                  <h2>
                    {wikiText(locale, "Cột", "Column")} {["I", "II", "III"][column] ?? column + 1}
                  </h2>
                  {sections.map((section) => (
                    <div
                      className="wiki-warehouse-shop-region"
                      data-terminal={section.terminal || undefined}
                      key={section.rows[0].row}
                    >
                      {section.terminal && (
                        <h3
                          title={wikiText(
                            locale,
                            "Không là nguyên liệu và không tạo thành từ trang bị ở cột III.",
                            "Not used as an ingredient and not assembled from equipment in column III.",
                          )}
                        >
                          <WikiIcon name="badge" size={13} />
                          {wikiText(locale, "Trang bị hoàn chỉnh", "Complete equipment")}
                        </h3>
                      )}
                      {section.rows.map((row) => (
                        <div className="wiki-warehouse-shop-cell" key={row.row}>
                          {row.placements.map((placement) => renderCard(placement.entry))}
                        </div>
                      ))}
                    </div>
                  ))}
                  {externalGroups.map((code) => {
                    const group = groups.find((candidate) => candidate.code === code)
                    const name = group ? warehouseText(group.translations, locale)?.name || group.code : code
                    return (
                      <section className="wiki-warehouse-shop-external" key={code ?? "unknown"}>
                        <h3>
                          <strong>{name || wikiText(locale, "Chưa phân loại", "Uncategorized")}</strong>
                          <span>{wikiText(locale, "Thuộc tính khác", "Other category")}</span>
                        </h3>
                        {external
                          .filter((placement) => placement.categoryCode === code)
                          .map((placement) => renderCard(placement.entry))}
                      </section>
                    )
                  })}
                </section>
              )
            })}
          </div>
          <svg className="wiki-warehouse-shop-wires" aria-hidden="true">
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M0 0 10 5 0 10Z" fill="context-stroke" />
              </marker>
            </defs>
            {wires.map((wire) => (
              <g key={wire.key} data-direct={wire.direct || undefined}>
                <path className="wiki-warehouse-shop-wire-halo" d={wire.path} />
                <path className="wiki-warehouse-shop-wire" d={wire.path} markerEnd={`url(#${markerId})`} />
              </g>
            ))}
          </svg>
        </div>
      </div>
      {!!unplaced.length && (
        <section className="wiki-warehouse-shop-unplaced">
          <h2>{wikiText(locale, "Chưa xác định vị trí", "Position not assigned")}</h2>
          <div>{unplaced.map(renderCard)}</div>
        </section>
      )}
      {!!layout.missingIds.length && (
        <p className="wiki-warehouse-shop-note">
          {wikiText(
            locale,
            `${layout.missingIds.length} trang bị liên quan chưa có dữ liệu trong phạm vi đang xem.`,
            `${layout.missingIds.length} related equipment entries are unavailable in this scope.`,
          )}
        </p>
      )}
      {selected && selected.content.recipeStatus !== "VERIFIED" && (
        <p className="wiki-warehouse-shop-note">
          {selected.content.recipeStatus === "NONE"
            ? wikiText(locale, "Trang bị này không có công thức ghép.", "This equipment has no crafting recipe.")
            : wikiText(
                locale,
                "Công thức của trang bị này chưa được xác minh.",
                "This equipment's recipe has not been verified.",
              )}
        </p>
      )}
    </section>
  )
}
