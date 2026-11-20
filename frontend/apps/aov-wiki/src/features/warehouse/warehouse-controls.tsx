import type { CSSProperties } from "react"
import { EnchantmentSetTools } from "./warehouse-enchantment-set-tools"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import { useRef, type ReactNode } from "react"
import { gameplayIcons } from "@aov/ui/components/gameplay-icons"
import { ItemCategoryArtwork } from "@aov/ui/components/item-category-icons"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { ITEM_STAT_FILTERS } from "@aov/ui/lib/item-description"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText, useWikiText } from "../../context/wiki-context"
import {
  ARCANA_COLORS,
  arcanaCandidates,
  arcanaFilters,
  arcanaRows,
  type ItemCatalogView,
  type ItemSort,
} from "./use-item-catalog"
import { useMediaQuery } from "./warehouse-layout"
import { itemMatchesCategory } from "./warehouse-item-layout"
import { ArcanaColorArt, arcanaColorName, romanTier } from "./warehouse-parts"
import {
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
  type WarehouseKind,
} from "../../lib/warehouse-types"

/** From this width the search and a catalog's filters share one line; below it the filters take the next line. */
const ONE_LINE = "(min-width: 1100px)"

interface ControlsProps {
  kind: WarehouseKind
  search: string
  onSearch: (value: string) => void
  /** Entries left by the page search. */
  entries: PublishedWarehouseRecord[]
  allEntries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
  group: string
  params: URLSearchParams
  /** Changes filters kept in the address; a null value removes the filter. */
  onFilters: (changes: Record<string, string | null>) => void
  itemView: ItemCatalogView
  /** The catalog or its groups are still on their way: filters show without counts instead of counting nothing. */
  loading: boolean
}

function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
}) {
  const { locale } = useWikiContext()
  const input = useRef<HTMLInputElement>(null)
  return (
    <label className="wiki-warehouse-search">
      <WikiIcon name="search" size={18} />
      <input
        ref={input}
        type="search"
        aria-label={label}
        value={value}
        maxLength={120}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          aria-label={wikiText(locale, "Xóa từ khóa", "Clear search")}
          onClick={() => {
            onChange("")
            input.current?.focus()
          }}
        >
          <WikiIcon name="close" size={14} />
        </button>
      )}
    </label>
  )
}

function Chip({
  pressed,
  count,
  label,
  tone,
  onClick,
  children,
}: {
  pressed: boolean
  count?: number
  /** The accessible name, where the visible text is an abbreviation. */
  label?: string
  /** A colour of its own, such as an enchantment branch's: the chip's picture is ringed with it and it marks the choice. */
  tone?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="wiki-warehouse-chip"
      aria-pressed={pressed}
      aria-label={label}
      data-tone={tone ? "" : undefined}
      style={tone ? ({ "--chip-tone": tone } as CSSProperties) : undefined}
      onClick={onClick}
    >
      {children}
      {count !== undefined && <small>{count}</small>}
    </button>
  )
}

function ChipGroup({
  label,
  wrap = false,
  caption,
  children,
}: {
  label: string
  wrap?: boolean
  /** A short visible name before the chips; such a group is a secondary one and is drawn lighter. */
  caption?: string
  children: ReactNode
}) {
  return (
    <div
      className="wiki-warehouse-chips"
      role="group"
      aria-label={label}
      data-wrap={wrap || undefined}
      data-secondary={caption ? "" : undefined}
    >
      {caption && (
        <span className="wiki-warehouse-chips-caption" aria-hidden>
          {caption}
        </span>
      )}
      {children}
    </div>
  )
}

/** A group of choices inside the filter sheet, each with its name written out and room for a thumb. */
function SheetGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="wiki-warehouse-sheet-group">
      <legend>{label}</legend>
      <div>{children}</div>
    </fieldset>
  )
}

function SheetChoice({
  pressed,
  count,
  onClick,
  children,
}: {
  pressed: boolean
  count?: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className="wiki-warehouse-sheet-choice" aria-pressed={pressed} onClick={onClick}>
      {children}
      {count !== undefined && <small>{count}</small>}
    </button>
  )
}

function useItemLabels() {
  const text = useWikiText()
  const sorts: [ItemSort, string][] = [
    ["tier", text("Theo cấp", "By tier")],
    ["price-desc", text("Giá cao trước", "Highest price")],
    ["price-asc", text("Giá thấp trước", "Lowest price")],
    ["name", text("Tên A–Z", "Name A–Z")],
  ]
  return { text, sorts, items: (count: number) => `${count} ${text("món", count === 1 ? "item" : "items")}` }
}

/** The shop's groups. The board always shows one of them; the list can show them all. */
function ItemCategories({
  view,
  groups,
  group,
  onFilters,
  loading,
}: Pick<ControlsProps, "groups" | "group" | "onFilters" | "loading"> & { view: ItemCatalogView }) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  const board = view.layout === "shop"
  const active = board ? view.category : group
  return (
    <ChipGroup label={text("Nhóm trang bị", "Equipment category")}>
      {!board && (
        <Chip pressed={!group} onClick={() => onFilters({ group: null })}>
          {text("Tất cả", "All")}
        </Chip>
      )}
      {groups.map((category) => {
        const icon = category.icon?.currentVersion?.url
        return (
          <Chip
            key={category.code}
            pressed={active === category.code}
            count={
              loading ? undefined : view.visible.filter((entry) => itemMatchesCategory(entry, category.code)).length
            }
            // The list drops the group when its chip is pressed again; the board always shows one group.
            onClick={() => {
              if (!board) onFilters({ group: group === category.code ? null : category.code })
              else if (active !== category.code) onFilters({ group: category.code })
            }}
          >
            {icon ? (
              <WikiImage className="wiki-warehouse-chip-art" src={icon} alt="" width="20" height="20" />
            ) : (
              <ItemCategoryArtwork code={category.code} size={20} />
            )}
            {warehouseText(category.translations, locale)?.name || category.code}
          </Chip>
        )
      })}
    </ChipGroup>
  )
}

function itemStatOptions(view: ItemCatalogView) {
  return ITEM_STAT_FILTERS.filter((filter) => view.counts[filter.key] || view.stats.includes(filter.key))
}

function toggled(values: readonly string[], value: string) {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value]
}

/** Board or list; `listing` says which one the page shows or, while it loads, is about to show. */
function ItemViewSwitch({ view, listing, labels }: { view: ItemCatalogView; listing: boolean; labels: boolean }) {
  const { text } = useItemLabels()
  const board = text("Sơ đồ", "Board")
  const list = text("Danh sách", "List")
  return (
    <div
      className="wiki-warehouse-switch"
      role="group"
      aria-label={text("Kiểu xem", "View")}
      data-labels={labels || undefined}
    >
      <button
        type="button"
        aria-pressed={!listing}
        aria-label={board}
        title={board}
        onClick={() => view.setLayout("shop")}
      >
        <WikiIcon name="board" size={18} />
        <span>{board}</span>
      </button>
      <button
        type="button"
        aria-pressed={listing}
        aria-label={list}
        title={list}
        onClick={() => view.setLayout("list")}
      >
        <WikiIcon name="rows" size={18} />
        <span>{list}</span>
      </button>
    </div>
  )
}

function ItemControls({ search, onSearch, groups, group, onFilters, itemView: view, loading }: ControlsProps) {
  const compact = usePageLayout() === "compact"
  // Seven groups with their counts, the search and the view switch need the full page column to share a line.
  const roomy = useMediaQuery("(min-width: 1280px)")
  const { text, sorts, items } = useItemLabels()
  const stats = itemStatOptions(view)
  const statsLabel = text("Chỉ số", "Stats")
  // Until the shop groups arrive the items can only be a list; the controls already show the view that will follow.
  const listing = (loading ? view.preferred : view.layout) === "list"
  const switchable = groups.length > 0 || loading
  const categories = groups.length > 0 && (
    <ItemCategories view={view} groups={groups} group={group} onFilters={onFilters} loading={loading} />
  )

  if (compact)
    return (
      <div className="wiki-warehouse-controls">
        <div className="wiki-warehouse-toolbar">
          <SearchField
            value={search}
            onChange={onSearch}
            label={text("Tìm trang bị", "Search equipment")}
            placeholder={text("Tìm trang bị…", "Search items…")}
          />
          <PublicFilterSheet
            title={text("Lọc trang bị", "Filter equipment")}
            triggerLabel={text("Lọc", "Filter")}
            count={view.stats.length}
            resetLabel={text("Xóa lọc", "Clear")}
            onReset={() => view.setStats([])}
            resultLabel={text(`Xem ${items(view.listed.length)}`, `Show ${items(view.listed.length)}`)}
          >
            {stats.length > 0 && (
              <SheetGroup label={statsLabel}>
                {stats.map((filter) => {
                  const Art = gameplayIcons[filter.icon]
                  return (
                    <SheetChoice
                      key={filter.key}
                      pressed={view.stats.includes(filter.key)}
                      count={view.counts[filter.key] ?? 0}
                      onClick={() => view.setStats(toggled(view.stats, filter.key))}
                    >
                      <Art size={18} />
                      {text(filter.vi, filter.en)}
                    </SheetChoice>
                  )
                })}
              </SheetGroup>
            )}
            {listing && (
              <SheetGroup label={text("Sắp xếp", "Sort")}>
                {sorts.map(([value, label]) => (
                  <SheetChoice key={value} pressed={view.sort === value} onClick={() => view.setSort(value)}>
                    {label}
                  </SheetChoice>
                ))}
              </SheetGroup>
            )}
          </PublicFilterSheet>
          {switchable && <ItemViewSwitch view={view} listing={listing} labels={false} />}
        </div>
        {categories}
      </div>
    )

  // A chip that is on shows it, and pressing it again takes the filter off; the groups above count what is left.
  const statChips = stats.map((filter) => {
    const Art = gameplayIcons[filter.icon]
    return (
      <Chip
        key={filter.key}
        pressed={view.stats.includes(filter.key)}
        count={view.counts[filter.key] ?? 0}
        onClick={() => view.setStats(toggled(view.stats, filter.key))}
      >
        <Art size={16} />
        {text(filter.vi, filter.en)}
      </Chip>
    )
  })
  const sort = listing && (
    <Select value={view.sort} onValueChange={(value) => view.setSort(value as ItemSort)}>
      <SelectTrigger className="wiki-warehouse-select" aria-label={text("Sắp xếp", "Sort")}>
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
  )
  return (
    <div className="wiki-warehouse-controls">
      <div className="wiki-warehouse-toolbar">
        <SearchField
          value={search}
          onChange={onSearch}
          label={text("Tìm trang bị", "Search equipment")}
          placeholder={text("Tìm theo tên, hiệu ứng…", "Search names, effects…")}
        />
        {roomy && categories}
        {switchable && (
          <div className="wiki-warehouse-toolbar-end">
            {/* Where the groups take a line of their own, this one has room for the sort order. */}
            {!roomy && sort}
            <ItemViewSwitch view={view} listing={listing} labels />
          </div>
        )}
      </div>
      {!roomy && categories}
      {/* The line stays in place while the catalog loads, so the catalog does not move when the chips arrive. */}
      <div className="wiki-warehouse-subbar">
        {stats.length > 0 && (
          <ChipGroup label={text("Lọc theo chỉ số", "Filter by stat")} caption={statsLabel} wrap>
            {statChips.slice(0, -2)}
            {/* The last two wrap together, so a chip never stands alone on a line. */}
            <span className="wiki-warehouse-chip-pair">{statChips.slice(-2)}</span>
          </ChipGroup>
        )}
        {(roomy || !switchable) && sort && <div className="wiki-warehouse-toolbar-end">{sort}</div>}
      </div>
    </div>
  )
}

function ArcanaControls({ search, onSearch, entries, allEntries, group, params, onFilters }: ControlsProps) {
  const { locale } = useWikiContext()
  const compact = usePageLayout() === "compact"
  const roomy = useMediaQuery(ONE_LINE)
  const text = useWikiText()
  const filters = arcanaFilters(params, group)
  const labels = new Map<string, string>()
  for (const entry of arcanaCandidates(entries, filters))
    for (const { key } of entry.content.stats)
      labels.set(key, warehouseText(entry.content.translations, locale)?.statLabels?.[key] || key)
  const stats = [...labels]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
  const allStats = text("Tất cả chỉ số", "All stats")
  const tiers = [3, 2, 1]
  const tierName = (tier: number) => `${text("Bậc", "Tier")} ${romanTier(tier)}`
  const reset = () => onFilters({ color: null, group: null, tier: null, stat: null })
  const searchField = (
    <SearchField
      value={search}
      onChange={onSearch}
      label={text("Tìm ngọc", "Search arcana")}
      placeholder={text("Tìm ngọc…", "Search arcana…")}
    />
  )
  const colors = (
    <ChipGroup label={text("Màu ngọc", "Arcana color")}>
      <Chip pressed={!filters.color} onClick={() => onFilters({ color: null, group: null, stat: null })}>
        {text("Tất cả màu", "All colors")}
      </Chip>
      {ARCANA_COLORS.map((color) => (
        <Chip
          key={color}
          pressed={filters.color === color}
          onClick={() => onFilters({ color, group: null, stat: null })}
        >
          <ArcanaColorArt color={color} entries={allEntries} />
          {arcanaColorName(color, locale)}
        </Chip>
      ))}
    </ChipGroup>
  )

  if (compact) {
    const found = arcanaRows(entries, filters, locale).length
    return (
      <div className="wiki-warehouse-controls">
        <div className="wiki-warehouse-toolbar">
          {searchField}
          <PublicFilterSheet
            title={text("Lọc ngọc", "Filter arcana")}
            triggerLabel={text("Lọc", "Filter")}
            count={Number(!!filters.tier) + Number(!!filters.stat)}
            resetLabel={text("Xóa lọc", "Clear")}
            onReset={() => onFilters({ tier: null, stat: null })}
            resultLabel={text(`Xem ${found} ngọc`, `Show ${found} arcana`)}
          >
            <SheetGroup label={text("Bậc ngọc", "Arcana tier")}>
              <SheetChoice pressed={!filters.tier} onClick={() => onFilters({ tier: null, stat: null })}>
                {text("Mọi bậc", "All tiers")}
              </SheetChoice>
              {tiers.map((tier) => (
                <SheetChoice
                  key={tier}
                  pressed={filters.tier === String(tier)}
                  onClick={() => onFilters({ tier: String(tier), stat: null })}
                >
                  {tierName(tier)}
                </SheetChoice>
              ))}
            </SheetGroup>
            <SheetGroup label={text("Chỉ số", "Stats")}>
              <SheetChoice pressed={!filters.stat} onClick={() => onFilters({ stat: null })}>
                {allStats}
              </SheetChoice>
              {stats.map(({ value, label }) => (
                <SheetChoice key={value} pressed={filters.stat === value} onClick={() => onFilters({ stat: value })}>
                  {label}
                </SheetChoice>
              ))}
            </SheetGroup>
          </PublicFilterSheet>
        </div>
        {colors}
      </div>
    )
  }

  const filterRow = (
    <div className="wiki-warehouse-filters">
      {colors}
      <ChipGroup label={text("Bậc ngọc", "Arcana tier")}>
        <Chip pressed={!filters.tier} onClick={() => onFilters({ tier: null, stat: null })}>
          {text("Mọi bậc", "All tiers")}
        </Chip>
        {tiers.map((tier) => (
          <Chip
            key={tier}
            pressed={filters.tier === String(tier)}
            label={tierName(tier)}
            onClick={() => onFilters({ tier: String(tier), stat: null })}
          >
            {romanTier(tier)}
          </Chip>
        ))}
      </ChipGroup>
      <Select
        value={filters.stat || "all"}
        onValueChange={(value) => onFilters({ stat: value === "all" ? null : value })}
      >
        <SelectTrigger
          className="wiki-warehouse-select"
          aria-label={text("Lọc theo chỉ số", "Filter by stat")}
          data-active={filters.stat ? "" : undefined}
        >
          <SelectValue placeholder={allStats} />
        </SelectTrigger>
        <SelectContent drawerTitle={text("Chỉ số", "Stats")} position="popper" align="start">
          <SelectItem value="all">{allStats}</SelectItem>
          {stats.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(filters.color || filters.tier || filters.stat) && (
        <button type="button" className="wiki-warehouse-clear" onClick={reset}>
          {text("Xóa lọc", "Clear filters")}
        </button>
      )}
    </div>
  )
  return (
    <div className="wiki-warehouse-controls">
      <div className="wiki-warehouse-toolbar">
        {searchField}
        {roomy && filterRow}
      </div>
      {!roomy && filterRow}
    </div>
  )
}

/** The branches alone: a catalog of a few dozen, drawn branch by branch, needs no search. */
function EnchantmentControls({ entries, groups, group, params, onFilters, loading }: ControlsProps) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  // The branches as trees, or the game's set screen where a player builds one set.
  const building = params.get("view") === "set"
  const trees = text("Cây hệ", "Branches")
  const builder = text("Xếp bộ", "Build a set")
  const viewSwitch = (
    <div className="wiki-warehouse-switch" role="group" aria-label={text("Kiểu xem", "View")} data-labels>
      <button
        type="button"
        aria-pressed={!building}
        aria-label={trees}
        title={trees}
        onClick={() => onFilters({ view: null, set: null })}
      >
        <WikiIcon name="board" size={18} />
        <span>{trees}</span>
      </button>
      <button
        type="button"
        aria-pressed={building}
        aria-label={builder}
        title={builder}
        onClick={() => onFilters({ view: "set", group: null })}
      >
        <WikiIcon name="cards" size={18} />
        <span>{builder}</span>
      </button>
    </div>
  )
  const branches = groups.length > 0 && (
    <ChipGroup label={text("Hệ phù hiệu", "Enchantment branch")}>
      <Chip pressed={!group} onClick={() => onFilters({ group: null })}>
        {text("Tất cả hệ", "All branches")}
      </Chip>
      {groups.map((branch) => {
        const icon = branch.icon?.currentVersion?.url
        const name = warehouseText(branch.translations, locale)?.name || branch.code
        return (
          <Chip
            key={branch.code}
            pressed={group === branch.code}
            label={icon ? name : undefined}
            count={
              loading
                ? undefined
                : entries.filter((entry) => entry.kind === "enchantments" && entry.content.branchCode === branch.code)
                    .length
            }
            tone={enchantmentBranchColor(branch)}
            onClick={() => onFilters({ group: group === branch.code ? null : branch.code })}
          >
            {icon && <WikiImage className="wiki-warehouse-chip-art" src={icon} alt="" width="20" height="20" />}
            {/* A phone shows the emblem alone; the name stays the button's accessible name. */}
            <span className="wiki-warehouse-chip-name" data-hideable={icon ? "" : undefined}>
              {name}
            </span>
          </Chip>
        )
      })}
    </ChipGroup>
  )
  // The view switch leads its own line, with the set tools at its end while building; the branch chips get the
  // whole line below, so nothing covers them.
  return (
    <div className="wiki-warehouse-controls">
      <div className="wiki-warehouse-toolbar">
        {viewSwitch}
        {building && <EnchantmentSetTools entries={entries} onFilters={onFilters} />}
      </div>
      {!building && branches}
    </div>
  )
}

/** Search first, then the filters of the catalog on screen. */
export function WarehouseControls(props: ControlsProps) {
  const { locale } = useWikiContext()
  if (props.kind === "items") return <ItemControls {...props} />
  if (props.kind === "arcana") return <ArcanaControls {...props} />
  if (props.kind === "enchantments") return <EnchantmentControls {...props} />
  return (
    <div className="wiki-warehouse-controls">
      <div className="wiki-warehouse-toolbar">
        <SearchField
          value={props.search}
          onChange={props.onSearch}
          label={wikiText(locale, "Tìm phụ trợ", "Search talents")}
          placeholder={wikiText(locale, "Tìm phụ trợ…", "Search talents…")}
        />
      </div>
    </div>
  )
}
