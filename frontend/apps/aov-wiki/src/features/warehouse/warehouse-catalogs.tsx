import { SpellFilters } from "@aov/ui/components/warehouse/spell-filters"
import { ItemCategoryArtwork } from "@aov/ui/components/item-category-icons"
import { ArcanaFilters } from "@aov/ui/components/warehouse/arcana-filters"
import { useMemo, useState, type CSSProperties } from "react"
import { useSearchParams } from "react-router"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiImage } from "../../components/wiki-image"
import { WarehouseArtwork } from "./warehouse-artwork"
import { WarehouseIcon } from "./warehouse-icon"
import { itemMatchesCategory, warehouseItemLayout } from "./warehouse-item-layout"
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
  warehouseText,
  type WarehouseEntry,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
  type WarehouseKind,
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
}

interface FilterOption {
  code: string
  name: string
  count: number
  icon?: string
  color?: string
}

const roman = (tier: number) => ["I", "II", "III"][tier - 1] ?? String(tier)
function OpenMark() {
  return (
    <span className="wiki-warehouse-catalog-open" aria-hidden="true">
      <WarehouseIcon name="arrow" size={13} />
    </span>
  )
}

function UndatedMark({ entry, showLabel = false }: { entry: WarehouseEntry; showLabel?: boolean }) {
  const { locale } = useWikiContext()
  if (entry.revision.effectiveFromPatchVariantId != null) return null
  const label = wikiText(locale, "Chưa rõ patch", "Patch unknown")
  return (
    <span className="wiki-warehouse-undated" title={label} aria-label={label}>
      <WarehouseIcon name="clock" size={12} />
      <span className={showLabel ? undefined : "sr-only"}>{label}</span>
    </span>
  )
}

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

function ItemGrid({ entries, groups, group, onGroupChange, selectedId, onSelect }: CatalogProps) {
  const { locale } = useWikiContext()
  const options = groups.map((category) => ({
    code: category.code,
    name: warehouseText(category.translations, locale)?.name || category.code,
    count: entries.filter((entry) => itemMatchesCategory(entry, category.code)).length,
    icon: category.icon?.currentVersion?.url,
  }))
  const activeGroup = group
  const sections = warehouseItemLayout(entries, activeGroup)
  return (
    <>
      <Filters options={options} value={activeGroup} onChange={onGroupChange} kind="items" />
      {sections.length ? (
        <div className="wiki-warehouse-item-tiers">
          {sections.map((section) => {
            const heading =
              section.kind === "column"
                ? `${wikiText(locale, "Cột", "Column")} ${roman(section.value + 1)}`
                : section.kind === "unplaced"
                  ? wikiText(locale, "Chưa xác định vị trí", "Position not assigned")
                  : section.value
                    ? `${wikiText(locale, "Cấp", "Tier")} ${roman(section.value)}`
                    : wikiText(locale, "Chưa phân cấp", "Tier not assigned")
            return (
              <section key={section.key} className="wiki-warehouse-item-tier" data-placement={section.kind}>
                <h2>
                  <span>{heading}</span>
                  <small>{section.entries.length}</small>
                </h2>
                <div className="wiki-warehouse-item-grid">
                  {section.entries.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      className="wiki-warehouse-item-card"
                      data-selected={selectedId === entry.id || undefined}
                      aria-label={wikiText(
                        locale,
                        `Xem ${warehouseText(entry.content.translations, locale)?.name || entry.code}`,
                        `View ${warehouseText(entry.content.translations, locale)?.name || entry.code}`,
                      )}
                      onClick={(event) => onSelect(entry, event.currentTarget)}
                    >
                      <span className="relative shrink-0">
                        <WarehouseArtwork entry={entry} kind="items" />
                        {entry.content.price != null && (
                          <ItemPrice amount={entry.content.price} locale={locale} badge />
                        )}
                      </span>
                      <span className="wiki-warehouse-item-caption">
                        <strong>{warehouseText(entry.content.translations, locale)?.name || entry.code}</strong>
                        <span className="wiki-warehouse-item-meta">
                          {activeGroup && entry.content.tier != null && (
                            <small className="wiki-warehouse-item-tier-mark">
                              {wikiText(locale, "Cấp", "Tier")} {roman(entry.content.tier)}
                            </small>
                          )}
                          <UndatedMark entry={entry} />
                        </span>
                      </span>
                      <OpenMark />
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <EmptyGroup />
      )}
    </>
  )
}

export function WarehouseCatalog(props: CatalogProps) {
  const { kind, entries, allEntries, group, groups, selectedId, onGroupChange, onSelect } = props
  const scope = useWikiContext()
  const { locale } = scope
  const [params, setParams] = useSearchParams()
  const [focused, setFocused] = useState<string | null>(null)
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
  const layout = params.get("layout") === "grid" || !groups.length ? "grid" : "shop"
  const items = allEntries.filter((e) => e.kind === "items")
  return (
    <div className="space-y-3">
      {layout === "grid" ? (
        <ItemGrid {...props} />
      ) : (
        <ItemShopGraph
          items={items}
          categories={metadata}
          locale={locale}
          category={group || groups[0]?.code || ""}
          selectedId={focused && items.some((e) => e.id === focused) ? focused : null}
          onFocus={setFocused}
          matches={entries.length < allEntries.length ? new Set(entries.map((e) => e.id)) : null}
          onSelect={(id) => {
            const entry = items.find((e) => e.id === id)
            if (entry) open(entry)
          }}
          onCategory={onGroupChange}
          editable={false}
        />
      )}
    </div>
  )
}
