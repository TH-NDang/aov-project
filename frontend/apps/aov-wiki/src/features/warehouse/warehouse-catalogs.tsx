import { SpellFilters } from "@aov/ui/components/warehouse/spell-filters"
import { ItemCategoryArtwork } from "@aov/ui/components/item-category-icons"
import { ArcanaFilters } from "@aov/ui/components/warehouse/arcana-filters"
import { useMemo, type CSSProperties } from "react"
import { useSearchParams } from "react-router"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiImage } from "../../components/wiki-image"
import { WarehouseArtwork } from "./warehouse-artwork"
import { WarehouseIcon } from "./warehouse-icon"
import { itemMatchesCategory, warehouseItemLayout } from "./warehouse-item-layout"
import type { ItemCatalogView, ItemSort, WarehouseItem } from "./use-item-catalog"
import { WikiIcon } from "../../components/wiki-icon"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { ItemStatChips, ItemStatFilter } from "@aov/ui/components/warehouse/item-facts"
import { ArcanaCollection } from "@aov/ui/components/warehouse/arcana-cards"
import { SpellCollection } from "@aov/ui/components/warehouse/spell-cards"
import { EnchantmentBranches } from "@aov/ui/components/warehouse/enchantment-branches"
import { ItemShopGraph } from "@aov/ui/components/warehouse/item-shop-graph"
import { ItemPrice } from "@aov/ui/components/warehouse/item-price"
import { createArcanaStatColors } from "@aov/ui/lib/arcana-stat-colors"
import { useQuery } from "@tanstack/react-query"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import { warehouseViewGroups } from "./warehouse-view"
import {
  type PublishedWarehouseRecord,
  type WarehouseEntry,
  type WarehouseGroup,
  type WarehouseKind,
  warehouseText,
} from "./warehouse-types"
import "./warehouse-catalogs.css"

interface CatalogSelection {
  selectedId: string | null
  onSelect: (entry: WarehouseEntry, button?: HTMLButtonElement) => void
}

interface CatalogProps extends CatalogSelection {
  kind: WarehouseKind
  entries: PublishedWarehouseRecord[]
  allEntries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
  group: string
  onGroupChange: (group: string) => void
  onClear: () => void
  itemView: ItemCatalogView
}

interface FilterOption {
  code: string
  name: string
  count: number
  icon?: string
  color?: string
}

const roman = (tier: number) => ["I", "II", "III"][tier - 1] ?? String(tier)

function Filters({
  options,
  value,
  onChange,
  kind,
}: {
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  kind: WarehouseKind
}) {
  const { locale } = useWikiContext()
  const all = wikiText(locale, "Tất cả", "All")
  return (
    <div
      className="wiki-warehouse-catalog-filters"
      role="group"
      aria-label={
        kind === "arcana"
          ? wikiText(locale, "Màu ngọc", "Arcana color")
          : kind === "enchantments"
            ? wikiText(locale, "Hệ phù hiệu", "Enchantment branch")
            : wikiText(locale, "Nhóm trang bị", "Equipment category")
      }
    >
      <button
        type="button"
        aria-label={all}
        title={all}
        aria-pressed={!value}
        onClick={() => onChange("")}
        className="wiki-warehouse-catalog-filter wiki-warehouse-catalog-filter-all"
      >
        <WarehouseIcon name="all" size={17} />
      </button>
      {options.map((option) => (
        <button
          type="button"
          key={option.code}
          aria-pressed={value === option.code}
          onClick={() => onChange(value === option.code ? "" : option.code)}
          className="wiki-warehouse-catalog-filter"
          style={option.color ? ({ "--catalog-accent": option.color } as CSSProperties) : undefined}
        >
          {option.icon ? (
            <WikiImage className="wiki-warehouse-catalog-filter-art" src={option.icon} alt="" width="28" height="28" />
          ) : kind === "items" ? (
            <ItemCategoryArtwork code={option.code} />
          ) : (
            <WarehouseIcon name={kind} size={18} />
          )}
          <span>{option.name}</span>
          <small>{option.count}</small>
        </button>
      ))}
    </div>
  )
}

function EmptyGroup() {
  const { locale } = useWikiContext()
  return (
    <p className="wiki-warehouse-catalog-empty">
      {wikiText(locale, "Không có mục phù hợp trong nhóm này.", "No matching entries in this group.")}
    </p>
  )
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
      data-selected={selected || undefined}
      aria-label={wikiText(locale, `Xem ${name}`, `View ${name}`)}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <WarehouseArtwork entry={entry} kind="items" />
      <span className="wiki-item-row-main">
        <strong>{name}</strong>
        {text?.summary && <small>{text.summary}</small>}
        <ItemStatChips stats={view.statsOf(entry)} locale={locale} />
      </span>
      <span className="wiki-item-row-price">
        <ItemPrice amount={entry.content.price} locale={locale} />
      </span>
    </button>
  )
}

function ItemList({
  view,
  groups,
  group,
  onGroupChange,
  selectedId,
  onSelect,
}: Pick<CatalogProps, "groups" | "group" | "onGroupChange" | "selectedId" | "onSelect"> & { view: ItemCatalogView }) {
  const { locale } = useWikiContext()
  const options = groups.map((category) => ({
    code: category.code,
    name: warehouseText(category.translations, locale)?.name || category.code,
    count: view.visible.filter((entry) => itemMatchesCategory(entry, category.code)).length,
    icon: category.icon?.currentVersion?.url,
  }))
  const sections = view.sort === "tier" ? warehouseItemLayout(view.listed, "").reverse() : null
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
  return (
    <>
      <Filters options={options} value={group} onChange={onGroupChange} kind="items" />
      {!view.listed.length ? (
        <EmptyGroup />
      ) : sections ? (
        sections.map((section) => (
          <section key={section.key} className="wiki-item-tier">
            <h2>
              {section.value
                ? `${wikiText(locale, "Cấp", "Tier")} ${roman(section.value)}`
                : wikiText(locale, "Chưa phân cấp", "Tier not assigned")}
              <small>{section.entries.length}</small>
            </h2>
            {rows(section.entries)}
          </section>
        ))
      ) : (
        rows(view.listed)
      )}
    </>
  )
}

function ItemToolbar({ view, showLayout }: { view: ItemCatalogView; showLayout: boolean }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const sorts: [ItemSort, string][] = [
    ["tier", text("Theo cấp", "By tier")],
    ["price-desc", text("Giá cao trước", "Highest price")],
    ["price-asc", text("Giá thấp trước", "Lowest price")],
    ["name", text("Tên A–Z", "Name A–Z")],
  ]
  return (
    <div className="wiki-item-toolbar">
      {showLayout && <ItemLayoutToggle view={view} />}
      <ItemStatFilter value={view.stats} counts={view.counts} onChange={view.setStats} />
      <div className="wiki-item-toolbar-end">
        {view.stats.length > 0 && (
          <button type="button" className="wiki-item-clear" onClick={() => view.setStats([])}>
            {text("Bỏ lọc", "Clear")} · {view.listed.length} {text("món", view.listed.length === 1 ? "item" : "items")}
          </button>
        )}
        {view.layout === "list" && (
          <Select value={view.sort} onValueChange={(value) => view.setSort(value as ItemSort)}>
            <SelectTrigger className="wiki-item-sort" size="sm" aria-label={text("Sắp xếp", "Sort")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent drawerTitle={text("Sắp xếp", "Sort")} position="popper" align="end">
              {sorts.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

function ItemLayoutToggle({ view }: { view: ItemCatalogView }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  return (
    <div className="wiki-item-layout" role="group" aria-label={text("Kiểu xem", "View")}>
      <button type="button" aria-pressed={view.layout === "shop"} onClick={() => view.setLayout("shop")}>
        <WikiIcon name="board" size={16} />
        {text("Sơ đồ", "Board")}
      </button>
      <button type="button" aria-pressed={view.layout === "list"} onClick={() => view.setLayout("list")}>
        <WikiIcon name="rows" size={16} />
        {text("Danh sách", "List")}
      </button>
    </div>
  )
}

export function WarehouseCatalog(props: CatalogProps) {
  const { kind, entries, allEntries, group, groups, selectedId, onGroupChange, onSelect, onClear, itemView } = props
  const scope = useWikiContext()
  const { locale } = scope
  const [params, setParams] = useSearchParams()
  const references = useQuery({ ...wikiReferencesQuery(scope), enabled: kind === "arcana" })
  const statColor = useMemo(() => createArcanaStatColors(references.data?.entities ?? []), [references.data])
  const searching = !!params.get("q")
  const metadata = warehouseViewGroups(groups)
  const open = (entry: WarehouseEntry) =>
    onSelect(entry, document.activeElement instanceof HTMLButtonElement ? document.activeElement : undefined)
  const selection = { locale, selectedId: selectedId ?? "", onOpen: open }
  function changeFilters(changes: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete("item")
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }
  if (kind === "spells") {
    const spells = entries.filter((e) => e.kind === "spells")
    const retired = params.get("availability") === "REMOVED"
    const archived = spells.filter((e) => e.content.availability === "REMOVED")
    const filtered = retired ? archived : spells
    return (
      <div className="space-y-3">
        <SpellFilters
          availability={retired ? "REMOVED" : ""}
          setAvailability={(value) => changeFilters({ availability: value })}
          count={spells.length}
          archivedCount={archived.length}
          locale={locale}
        />
        {filtered.length ? (
          <SpellCollection
            key={JSON.stringify([searching, retired])}
            records={filtered}
            revealLegacy={
              searching || retired || filtered.every((e) => e.content.legacy || e.content.availability === "REMOVED")
            }
            {...selection}
          />
        ) : (
          <EmptyGroup />
        )}
      </div>
    )
  }
  if (kind === "arcana") {
    const records = entries.filter((e) => e.kind === "arcana")
    const tier = params.get("tier") ?? ""
    const color = params.get("color") || group
    const candidates = records.filter(
      (e) => (!color || color === e.content.color) && (!tier || Number(tier) === e.content.tier),
    )
    const labels = new Map<string, string>()
    for (const e of candidates)
      for (const { key } of e.content.stats)
        labels.set(key, warehouseText(e.content.translations, locale)?.statLabels?.[key] || key)
    const statOptions = [...labels]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
    const stat = params.get("stat") ?? ""
    const filtered = candidates.filter((e) => !stat || e.content.stats.some((s) => s.key === stat))
    const reveal = !!(searching || stat || tier)
    return (
      <div className="space-y-3">
        <ArcanaFilters
          color={color}
          tier={tier}
          stat={stat}
          statOptions={statOptions}
          onColorChange={(value) => changeFilters({ color: value, group: null, stat: null })}
          onTierChange={(value) => changeFilters({ tier: value, stat: null })}
          onStatChange={(value) => changeFilters({ stat: value })}
          onReset={() => changeFilters({ color: null, group: null, stat: null, tier: null })}
        />
        {filtered.length ? (
          <ArcanaCollection
            key={JSON.stringify([searching, tier, stat])}
            records={filtered}
            statColor={statColor}
            revealLowerTiers={reveal}
            {...selection}
          />
        ) : (
          <EmptyGroup />
        )}
      </div>
    )
  }
  if (kind === "enchantments") {
    const records = entries.filter((e) => e.kind === "enchantments")
    for (const { content } of records)
      if (!metadata.some((b) => b.code === content.branchCode))
        metadata.push({
          code: content.branchCode,
          color: null,
          displayOrder: metadata.length,
          translations: [],
          iconAssetId: null,
          backgroundAssetId: null,
        })
    return (
      <EnchantmentBranches
        records={records}
        branches={metadata}
        active={group}
        onSelect={onGroupChange}
        search=""
        scoped
        {...selection}
      />
    )
  }
  const items = allEntries.filter((e) => e.kind === "items")
  const openItem = (id: string | null) => {
    const entry = id ? items.find((e) => e.id === id) : undefined
    if (entry) open(entry)
    else onClear()
  }
  return (
    <div className="space-y-3">
      <ItemToolbar view={itemView} showLayout={groups.length > 0} />
      {itemView.layout === "list" ? (
        <ItemList
          view={itemView}
          groups={groups}
          group={group}
          onGroupChange={onGroupChange}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : (
        <ItemShopGraph
          items={items}
          categories={metadata}
          locale={locale}
          category={itemView.category}
          selectedId={selectedId && items.some((e) => e.id === selectedId) ? selectedId : null}
          onFocus={openItem}
          matches={itemView.visible.length < items.length ? new Set(itemView.visible.map((e) => e.id)) : null}
          onSelect={openItem}
          onCategory={onGroupChange}
          editable={false}
          showOpenButton={false}
        />
      )}
    </div>
  )
}
