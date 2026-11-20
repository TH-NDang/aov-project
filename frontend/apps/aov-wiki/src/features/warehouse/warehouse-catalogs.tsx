import { useState, type CSSProperties } from "react"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { ItemStatChips } from "@aov/ui/components/warehouse/item-facts"
import { ItemPrice } from "@aov/ui/components/warehouse/item-price"
import { ItemShopGraph } from "@aov/ui/components/warehouse/item-shop-graph"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { ItemCatalogView, WarehouseItem } from "./use-item-catalog"
import { ArcanaCatalog } from "./warehouse-arcana"
import { WarehouseArtwork } from "./warehouse-artwork"
import { EnchantmentCatalog } from "./warehouse-enchantments"
import { EnchantmentSetView } from "./warehouse-enchantment-set"
import { warehouseItemLayout } from "./warehouse-item-layout"
import { EmptyGroup, GroupHeading, romanTier } from "./warehouse-parts"
import { SpellCatalog } from "./warehouse-spells"
import {
  type PublishedWarehouseRecord,
  type WarehouseEntry,
  type WarehouseGroup,
  type WarehouseKind,
  warehouseText,
} from "../../lib/warehouse-types"
import { warehouseViewGroups } from "./warehouse-view"
import "./warehouse-catalogs.css"

interface CatalogProps {
  kind: WarehouseKind
  /** Entries left by the page search. */
  entries: PublishedWarehouseRecord[]
  allEntries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
  group: string
  params: URLSearchParams
  selectedId: string | null
  onSelect: (entry: WarehouseEntry, button?: HTMLButtonElement) => void
  onClear: () => void
  onGroupChange: (group: string) => void
  /** Changes values kept in the address, such as the enchantment set being built. */
  onFilters: (changes: Record<string, string | null>) => void
  itemView: ItemCatalogView
}

function ItemRow({
  entry,
  view,
  selected,
  onOpen,
}: {
  entry: WarehouseItem
  view: ItemCatalogView
  selected: boolean
  onOpen: (button: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const text = warehouseText(entry.content.translations, locale)
  const name = text?.name || entry.code
  return (
    <button
      type="button"
      className="wiki-item-row"
      aria-pressed={selected}
      aria-label={wikiText(locale, `Xem ${name}`, `View ${name}`)}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <WarehouseArtwork entry={entry} kind="items" />
      <span className="wiki-item-row-main">
        <strong>{name}</strong>
        {text?.summary && <small>{text.summary}</small>}
        <ItemStatChips stats={view.statsOf(entry)} />
      </span>
      <span className="wiki-item-row-price">
        <ItemPrice amount={entry.content.price} />
      </span>
    </button>
  )
}

/** Rows the list adds at a time: whole lines whether two or three rows stand abreast. */
const ITEM_BATCH = 36

/**
 * Every item as a row that can be sorted; sorted by tier, the tiers become groups. The rows come in as the reader
 * scrolls, and the open item is always among them.
 */
function ItemList({
  view,
  scope,
  selectedId,
  onSelect,
}: Pick<CatalogProps, "selectedId" | "onSelect"> & { view: ItemCatalogView; scope: string }) {
  const { locale } = useWikiContext()
  const opened = view.listed.findIndex((entry) => entry.id === selectedId)
  // Rows shown for an open item stay once it closes, so the row it was opened from is still there to take focus back.
  const [reach, setReach] = useState({ scope, rows: 0 })
  const kept = reach.scope === scope ? reach.rows : 0
  if (opened + 1 > kept) setReach({ scope, rows: opened + 1 })
  const revealed = useRevealedRows(view.listed, scope, ITEM_BATCH, Math.max(opened + 1, kept))
  const byTier = view.sort === "tier"
  const totals = new Map(byTier ? warehouseItemLayout(view.listed, "").map((s) => [s.key, s.entries.length]) : [])
  const sections = byTier ? warehouseItemLayout(revealed.rows, "").reverse() : null
  const more = (
    <InfiniteScroll query={revealed.loader} label={wikiText(locale, "Đang tải thêm trang bị", "Loading more items")} />
  )
  const rows = (entries: WarehouseItem[]) => (
    <div className="wiki-item-rows">
      {entries.map((entry) => (
        <ItemRow
          key={entry.id}
          entry={entry}
          view={view}
          selected={selectedId === entry.id}
          onOpen={(button) => onSelect(entry, button)}
        />
      ))}
    </div>
  )
  if (!view.listed.length) return <EmptyGroup />
  if (!sections)
    return (
      <div className="wiki-item-tiers">
        {rows(revealed.rows)}
        {more}
      </div>
    )
  return (
    <div className="wiki-item-tiers">
      {sections.map((section) => {
        const title = section.value
          ? `${wikiText(locale, "Cấp", "Tier")} ${romanTier(section.value)}`
          : wikiText(locale, "Chưa phân cấp", "Tier not assigned")
        return (
          <section key={section.key} className="wiki-warehouse-section" aria-label={title}>
            <GroupHeading title={title} count={totals.get(section.key) ?? section.entries.length} />
            {rows(section.entries)}
          </section>
        )
      })}
      {more}
    </div>
  )
}

/** The game's shop: one group at a time in three columns, with the recipe of the chosen item drawn across them. */
function ItemBoard({
  items,
  groups,
  view,
  selectedId,
  onSelect,
  onClear,
  onGroupChange,
}: Pick<CatalogProps, "groups" | "selectedId" | "onSelect" | "onClear" | "onGroupChange"> & {
  items: WarehouseItem[]
  view: ItemCatalogView
}) {
  const { locale } = useWikiContext()
  const hint = wikiText(
    locale,
    "Chọn một trang bị để xem chi tiết và đường ghép.",
    "Pick an item to read it and see its recipe lines.",
  )
  const board = groups.find((group) => group.code === view.category)
  const open = (id: string | null) => {
    const entry = id ? items.find((item) => item.id === id) : undefined
    if (entry) onSelect(entry, document.activeElement instanceof HTMLButtonElement ? document.activeElement : undefined)
    else onClear()
  }
  return (
    <div
      className="wiki-item-board"
      data-warehouse-density="compact"
      style={{ "--board-hint": JSON.stringify(hint) } as CSSProperties}
    >
      {/* The board's columns and branches carry headings of their own; this one names the board above them. */}
      <h2 className="sr-only">
        {(board && warehouseText(board.translations, locale)?.name) || wikiText(locale, "Trang bị", "Items")}
      </h2>
      <ItemShopGraph
        // A new group starts from its own branches: the board keeps the chosen branch in its own state.
        key={view.category}
        items={items}
        categories={warehouseViewGroups(groups)}
        locale={locale}
        category={view.category}
        selectedId={selectedId && items.some((item) => item.id === selectedId) ? selectedId : null}
        onFocus={open}
        matches={view.visible.length < items.length ? new Set(view.visible.map((item) => item.id)) : null}
        onSelect={open}
        onCategory={onGroupChange}
        editable={false}
        showOpenButton={false}
      />
    </div>
  )
}

export function WarehouseCatalog(props: CatalogProps) {
  const { kind, entries, allEntries, group, groups, params, selectedId, onSelect, onClear, onGroupChange } = props
  const searching = !!params.get("q")
  if (kind === "spells")
    return (
      <SpellCatalog
        key={String(searching)}
        entries={entries}
        params={params}
        searching={searching}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    )
  if (kind === "arcana")
    return (
      <ArcanaCatalog
        key={JSON.stringify([searching, params.get("tier"), params.get("stat")])}
        entries={entries}
        allEntries={allEntries}
        group={group}
        params={params}
        searching={searching}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    )
  if (kind === "enchantments" && params.get("view") === "set")
    return <EnchantmentSetView entries={allEntries} groups={groups} params={params} onFilters={props.onFilters} />
  if (kind === "enchantments")
    return (
      <EnchantmentCatalog entries={entries} groups={groups} group={group} selectedId={selectedId} onSelect={onSelect} />
    )
  if (props.itemView.layout === "list")
    // A new search, filter or order starts the list again from its first rows.
    return <ItemList view={props.itemView} scope={params.toString()} selectedId={selectedId} onSelect={onSelect} />
  return (
    <ItemBoard
      items={allEntries.filter((entry): entry is WarehouseItem => entry.kind === "items")}
      groups={groups}
      view={props.itemView}
      selectedId={selectedId}
      onSelect={onSelect}
      onClear={onClear}
      onGroupChange={onGroupChange}
    />
  )
}
