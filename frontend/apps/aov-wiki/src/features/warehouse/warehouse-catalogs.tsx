import { useEffect, type CSSProperties } from "react"
import { useSearchParams } from "react-router"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiImage } from "../../components/wiki-image"
import { WarehouseArtwork } from "./warehouse-artwork"
import { WarehouseIcon } from "./warehouse-icon"
import { itemMatchesCategory, warehouseItemLayout } from "./warehouse-item-layout"
import { WarehouseShop } from "./warehouse-shop"
import {
  warehouseName,
  warehouseStatValue,
  warehouseText,
  type WarehouseEntry,
  type WarehouseGroup,
  type WarehouseKind,
} from "./warehouse-types"
import "./warehouse-catalogs.css"

interface CatalogSelection {
  selectedId: string | null
  onSelect: (entry: WarehouseEntry, button: HTMLButtonElement) => void
}

interface CatalogProps extends CatalogSelection {
  kind: WarehouseKind
  entries: WarehouseEntry[]
  allEntries?: WarehouseEntry[]
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
const branchColors: Record<string, string> = {
  "thap-quang-minh": "#d6ad57",
  "vuc-hon-mang": "#e85c64",
  "rung-nguyen-sinh": "#65b979",
  "thanh-khoi-nguyen": "#59a6e8",
}
const arcanaColors = [
  { code: "RED", name: "Đỏ", color: "#e67a83" },
  { code: "PURPLE", name: "Tím", color: "#b697e9" },
  { code: "GREEN", name: "Xanh", color: "#77cda6" },
]

function branchColor(branch: WarehouseGroup) {
  return /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(branch.color ?? "")
    ? branch.color!
    : (branchColors[branch.code] ?? "#d6ad57")
}

function groupName(group: WarehouseGroup, locale: string) {
  return warehouseText(group.translations, locale)?.name || group.code
}

function OpenMark() {
  return (
    <span className="wiki-warehouse-catalog-open" aria-hidden="true">
      <WarehouseIcon name="arrow" size={13} />
    </span>
  )
}

function UndatedMark({ entry }: { entry: WarehouseEntry }) {
  const { locale } = useWikiContext()
  if (
    entry.revision.effectiveFromPatchVariantId !== null ||
    entry.content.legacy ||
    entry.content.availability === "REMOVED"
  )
    return null
  const label = wikiText(locale, "Dữ liệu nền · Chưa rõ mùa/patch", "Baseline · Season and patch unconfirmed")
  return (
    <span className="wiki-warehouse-undated" title={label} aria-label={label}>
      <WarehouseIcon name="clock" size={12} />
      <span className="sr-only">{label}</span>
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

function ItemsCatalog({ entries, allEntries, groups, group, onGroupChange, selectedId, onSelect }: CatalogProps) {
  const { locale } = useWikiContext()
  const [params, setParams] = useSearchParams()
  const mode = params.get("layout") === "grid" ? "grid" : "shop"
  const options = groups.map((category) => ({
    code: category.code,
    name: warehouseText(category.translations, locale)?.name || category.code,
    count: entries.filter((entry) => itemMatchesCategory(entry, category.code)).length,
    icon: category.icon?.currentVersion?.url,
  }))
  const activeGroup = mode === "shop" ? group || options[0]?.code || "" : group
  const sections = warehouseItemLayout(entries, activeGroup)

  useEffect(() => {
    if (mode !== "shop" || group || !activeGroup) return
    setParams(
      (current) => {
        if (current.has("group")) return current
        const next = new URLSearchParams(current)
        next.set("group", activeGroup)
        return next
      },
      { replace: true },
    )
  }, [mode, group, activeGroup, setParams])

  function setLayout(layout: "shop" | "grid") {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set("layout", layout)
        if (layout === "shop" && !next.get("group") && options[0]) next.set("group", options[0].code)
        return next
      },
      { replace: true },
    )
  }

  function chooseGroup(value: string) {
    if (!value && mode === "shop") {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set("layout", "grid")
          next.delete("group")
          next.delete("item")
          return next
        },
        { replace: true },
      )
    } else onGroupChange(value)
  }

  return (
    <>
      <div className="wiki-warehouse-shop-controls">
        <Filters options={options} value={activeGroup} onChange={chooseGroup} kind="items" />
        <div
          className="wiki-warehouse-shop-view"
          role="group"
          aria-label={wikiText(locale, "Dạng xem trang bị", "Equipment view")}
        >
          <button
            type="button"
            aria-pressed={mode === "shop"}
            aria-label={wikiText(locale, "Dạng cửa hàng", "Shop view")}
            title={wikiText(locale, "Dạng cửa hàng", "Shop view")}
            onClick={() => setLayout("shop")}
          >
            <WarehouseIcon name="items" size={15} />
            <span className="wiki-warehouse-shop-view-label">{wikiText(locale, "Cửa hàng", "Shop")}</span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "grid"}
            aria-label={wikiText(locale, "Dạng lưới", "Grid view")}
            title={wikiText(locale, "Dạng lưới", "Grid view")}
            onClick={() => setLayout("grid")}
          >
            <WarehouseIcon name="all" size={15} />
            <span className="wiki-warehouse-shop-view-label">{wikiText(locale, "Lưới", "Grid")}</span>
          </button>
        </div>
      </div>
      {mode === "shop" && activeGroup && sections.length ? (
        <WarehouseShop
          key={activeGroup}
          entries={allEntries ?? entries}
          visibleIds={new Set(entries.map((entry) => entry.id))}
          groups={groups}
          category={activeGroup}
          selectedId={selectedId}
          onOpen={onSelect}
        />
      ) : sections.length ? (
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
                      <WarehouseArtwork entry={entry} kind="items" />
                      <span className="wiki-warehouse-item-caption">
                        <strong>{warehouseText(entry.content.translations, locale)?.name || entry.code}</strong>
                        <span className="wiki-warehouse-item-meta">
                          {entry.content.price != null && (
                            <span className="wiki-warehouse-item-price">
                              <span aria-hidden="true" />
                              {entry.content.price.toLocaleString(locale)}{" "}
                              <small>{wikiText(locale, "vàng", "gold")}</small>
                            </span>
                          )}
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

function EnchantmentsCatalog({ entries, groups, group, onGroupChange, selectedId, onSelect }: CatalogProps) {
  const { locale } = useWikiContext()
  const branches = [...groups]
  for (const entry of entries) {
    const code = entry.content.branchCode
    if (code && !branches.some((branch) => branch.code === code))
      branches.push({ code, displayOrder: branches.length, color: null, translations: [] })
  }
  const options = branches.map((branch) => ({
    code: branch.code,
    name: groupName(branch, locale),
    color: branchColor(branch),
    icon: branch.icon?.currentVersion?.url,
    count: entries.filter((entry) => entry.content.branchCode === branch.code).length,
  }))
  const shown = branches.filter(
    (branch) => (!group || branch.code === group) && entries.some((entry) => entry.content.branchCode === branch.code),
  )

  return (
    <>
      <Filters options={options} value={group} onChange={onGroupChange} kind="enchantments" />
      <div className="wiki-warehouse-branch-collection">
        {shown.map((branch) => {
          const nodes = entries.filter((entry) => entry.content.branchCode === branch.code)
          const tiers = [...new Set(nodes.map((entry) => entry.content.tier ?? 0))].sort((a, b) => a - b)
          const description = warehouseText(branch.translations, locale)?.description
          return (
            <section
              key={branch.code}
              className="wiki-warehouse-branch"
              style={{ "--branch-accent": branchColor(branch) } as CSSProperties}
            >
              <header className="wiki-warehouse-branch-heading">
                <span className="wiki-warehouse-branch-emblem">
                  {branch.icon?.currentVersion?.url ? (
                    <WikiImage src={branch.icon.currentVersion.url} alt="" width="48" height="48" />
                  ) : (
                    <WarehouseIcon name="enchantments" size={28} />
                  )}
                </span>
                <div>
                  <h2>{groupName(branch, locale)}</h2>
                  {description && <p>{description}</p>}
                </div>
              </header>
              {tiers.map((tier) => (
                <div className="wiki-warehouse-branch-level" key={tier}>
                  <div className="wiki-warehouse-branch-marker">
                    <span>{tier ? roman(tier) : "?"}</span>
                  </div>
                  <div className="wiki-warehouse-branch-nodes">
                    {nodes
                      .filter((entry) => (entry.content.tier ?? 0) === tier)
                      .sort(
                        (a, b) =>
                          (a.content.position ?? 999) - (b.content.position ?? 999) || a.code.localeCompare(b.code),
                      )
                      .map((entry) => (
                        <button
                          type="button"
                          className="wiki-warehouse-branch-node"
                          key={entry.id}
                          data-selected={selectedId === entry.id || undefined}
                          aria-label={wikiText(locale, `Xem ${warehouseName(entry)}`, `View ${warehouseName(entry)}`)}
                          onClick={(event) => onSelect(entry, event.currentTarget)}
                        >
                          <span className="wiki-warehouse-branch-node-art">
                            <WarehouseArtwork kind="enchantments" entry={entry} />
                            <OpenMark />
                          </span>
                          <strong>{warehouseText(entry.content.translations, locale)?.name || entry.code}</strong>
                          {warehouseText(entry.content.translations, locale)?.summary && (
                            <span className="wiki-warehouse-branch-node-summary">
                              {warehouseText(entry.content.translations, locale)?.summary}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </section>
          )
        })}
        {!shown.length && <EmptyGroup />}
      </div>
    </>
  )
}

function ArcanaCard({ entry, selectedId, onSelect }: CatalogSelection & { entry: WarehouseEntry }) {
  const { locale } = useWikiContext()
  const text = warehouseText(entry.content.translations, locale)
  const stats = entry.content.stats ?? []
  const color = arcanaColors.find((color) => color.code === entry.content.color)?.color ?? "#d6ad57"
  return (
    <button
      type="button"
      className="wiki-warehouse-arcana-card"
      style={{ "--catalog-accent": color } as CSSProperties}
      data-selected={selectedId === entry.id || undefined}
      aria-label={wikiText(locale, `Xem ${text?.name || entry.code}`, `View ${text?.name || entry.code}`)}
      onClick={(event) => onSelect(entry, event.currentTarget)}
    >
      <span className="wiki-warehouse-arcana-heading">
        <WarehouseArtwork entry={entry} kind="arcana" />
        <strong>{text?.name || entry.code}</strong>
        <OpenMark />
      </span>
      {!!stats.length && (
        <dl>
          {stats.slice(0, 2).map((stat) => (
            <div key={stat.key}>
              <dt>{text?.statLabels?.[stat.key] || stat.key}</dt>
              <dd>{warehouseStatValue(stat, locale)}</dd>
            </div>
          ))}
        </dl>
      )}
      {stats.length > 2 && (
        <span className="wiki-warehouse-arcana-more">
          +{stats.length - 2} {wikiText(locale, "chỉ số", "stats")}
        </span>
      )}
    </button>
  )
}

function ArcanaCatalog({ entries, group, onGroupChange, selectedId, onSelect }: CatalogProps) {
  const { locale } = useWikiContext()
  const options = arcanaColors.map((color) => ({
    ...color,
    name: wikiText(locale, color.name, { RED: "Red", PURPLE: "Purple", GREEN: "Green" }[color.code] || color.name),
    count: entries.filter((entry) => entry.content.color === color.code).length,
  }))
  const shown = group ? entries.filter((entry) => entry.content.color === group) : entries
  const tiers = [...new Set(shown.map((entry) => entry.content.tier ?? 0))].sort((a, b) => b - a)
  return (
    <>
      <Filters options={options} value={group} onChange={onGroupChange} kind="arcana" />
      <div className="wiki-warehouse-arcana-tiers">
        {tiers.map((tier) => {
          const nodes = shown.filter((entry) => (entry.content.tier ?? 0) === tier)
          const heading = (
            <>
              <span className="wiki-warehouse-catalog-disclosure" aria-hidden="true">
                <WarehouseIcon name="chevron" size={14} />
              </span>
              <span>
                {tier
                  ? `${wikiText(locale, "Bậc", "Tier")} ${roman(tier)}`
                  : wikiText(locale, "Chưa phân bậc", "Unclassified")}
              </span>
              <small>{nodes.length}</small>
            </>
          )
          const cards = (
            <div className="wiki-warehouse-arcana-grid">
              {nodes.map((entry) => (
                <ArcanaCard key={entry.id} entry={entry} selectedId={selectedId} onSelect={onSelect} />
              ))}
            </div>
          )
          return tier === 3 ? (
            <section key={tier} className="wiki-warehouse-arcana-tier">
              <h2>{heading}</h2>
              {cards}
            </section>
          ) : (
            <details key={tier} className="wiki-warehouse-arcana-tier">
              <summary>{heading}</summary>
              {cards}
            </details>
          )
        })}
        {!shown.length && <EmptyGroup />}
      </div>
    </>
  )
}

function SpellCard({ entry, selectedId, onSelect }: CatalogSelection & { entry: WarehouseEntry }) {
  const { locale } = useWikiContext()
  const content = entry.content
  const states = content.states ?? []
  const selected = states.find((state) => state.key === content.defaultStateKey) ?? states[0]
  const secondary = states.find((state) => state !== selected)
  const text = warehouseText(content.translations, locale)
  return (
    <button
      type="button"
      className="wiki-warehouse-spell-card"
      data-selected={selectedId === entry.id || undefined}
      aria-label={wikiText(locale, `Xem ${text?.name || entry.code}`, `View ${text?.name || entry.code}`)}
      onClick={(event) => onSelect(entry, event.currentTarget)}
    >
      <span className="wiki-warehouse-spell-heading">
        <span className="wiki-warehouse-spell-artwork" data-layered={!!secondary || undefined}>
          {secondary && (
            <WarehouseArtwork
              entry={entry}
              kind="spells"
              assetId={secondary.iconAssetId}
              className="wiki-warehouse-spell-secondary"
            />
          )}
          <WarehouseArtwork
            entry={entry}
            kind="spells"
            assetId={selected?.iconAssetId ?? content.iconAssetId}
            className="wiki-warehouse-spell-primary"
          />
          {secondary && (
            <span className="wiki-warehouse-spell-switch" aria-hidden="true">
              <WarehouseIcon name="switch" size={12} />
            </span>
          )}
        </span>
        <span className="wiki-warehouse-spell-identity">
          <strong>{text?.name || entry.code}</strong>
          {secondary && (
            <small>
              {states.length} {wikiText(locale, "trạng thái", "states")}
            </small>
          )}
          {content.availability === "REMOVED" && <small>{wikiText(locale, "Đã gỡ", "Retired")}</small>}
          {content.availability === "UNKNOWN" && (
            <small>{wikiText(locale, "Chưa xác định khả dụng", "Availability unknown")}</small>
          )}
        </span>
        <OpenMark />
      </span>
      {text?.summary && <span className="wiki-warehouse-spell-summary">{text.summary}</span>}
      <span className="wiki-warehouse-spell-meta">
        <UndatedMark entry={entry} />
        {content.cooldownSeconds != null && (
          <span>
            <WarehouseIcon name="clock" size={13} />
            {content.cooldownSeconds.toLocaleString(locale)} {wikiText(locale, "giây", "s")}
          </span>
        )}
        {content.unlockType === "ACCOUNT_CREATION" ? (
          <span>{wikiText(locale, "Có sẵn", "Available")}</span>
        ) : (
          content.unlockLevel != null && <span>Lv {content.unlockLevel}</span>
        )}
      </span>
    </button>
  )
}

function SpellsCatalog({ entries, selectedId, onSelect }: CatalogProps) {
  const { locale } = useWikiContext()
  const legacy = (entry: WarehouseEntry) => entry.content.legacy || entry.content.availability === "REMOVED"
  const current = entries.filter((entry) => !legacy(entry))
  const older = entries.filter(legacy)
  const cards = (entries: WarehouseEntry[]) => (
    <div className="wiki-warehouse-spell-grid">
      {entries.map((entry) => (
        <SpellCard key={entry.id} entry={entry} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
  return (
    <div className="wiki-warehouse-spell-collection">
      {!!current.length && cards(current)}
      {!!older.length && (
        <details className="wiki-warehouse-spell-legacy">
          <summary>
            <span className="wiki-warehouse-catalog-disclosure" aria-hidden="true">
              <WarehouseIcon name="chevron" size={14} />
            </span>
            <span>{wikiText(locale, "Phụ trợ cũ", "Retired talents")}</span>
            <small>{older.length}</small>
          </summary>
          {cards(older)}
        </details>
      )}
    </div>
  )
}

export function WarehouseCatalog(props: CatalogProps) {
  if (props.kind === "items") return <ItemsCatalog {...props} />
  if (props.kind === "enchantments") return <EnchantmentsCatalog {...props} />
  if (props.kind === "arcana") return <ArcanaCatalog {...props} />
  return <SpellsCatalog {...props} />
}
