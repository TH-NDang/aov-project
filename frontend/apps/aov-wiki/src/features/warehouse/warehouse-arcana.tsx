import { useState, type CSSProperties, type ReactNode } from "react"
import { arcanaGroupLabel, compactArcanaName } from "@aov/ui/components/warehouse/arcana-cards"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  ARCANA_COLORS,
  ARCANA_FAMILIES,
  arcanaFilters,
  arcanaRows,
  type ArcanaColor,
  type ArcanaFamily,
  type WarehouseArcana,
} from "./use-item-catalog"
import { WarehouseArtwork } from "./warehouse-artwork"
import { fillStyle } from "./warehouse-grid"
import { ArcanaColorArt, arcanaColorName, EmptyGroup, FoldedGroup, GroupHeading, romanTier } from "./warehouse-parts"
import {
  warehouseName,
  warehouseStatValue,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseEntry,
} from "./warehouse-types"

const FAMILY_NAMES: Record<ArcanaFamily, [string, string]> = {
  physical: ["Công vật lý", "Physical"],
  magic: ["Phép", "Magic"],
  neutral: ["Trung tính", "Neutral"],
}

/** The name without the color and tier its group already states. Entries recorded in capitals read like the rest. */
export function arcanaTitle(entry: WarehouseArcana, locale: string) {
  const name = compactArcanaName(warehouseName(entry, locale), entry.content.color, entry.content.tier)
  if (name !== name.toLocaleUpperCase(locale) || name === name.toLocaleLowerCase(locale)) return name
  return name
    .split(" / ")
    .map((part) => part.charAt(0) + part.slice(1).toLocaleLowerCase(locale))
    .join(" / ")
}

type Row = { entry: WarehouseArcana; family: ArcanaFamily }

function ArcanaRow({
  entry,
  selected,
  onOpen,
}: {
  entry: WarehouseArcana
  selected: boolean
  onOpen: (entry: WarehouseEntry, button: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const labels = warehouseText(entry.content.translations, locale)?.statLabels
  return (
    <button
      type="button"
      className="wiki-arcana-row arcana-card"
      aria-pressed={selected}
      aria-label={wikiText(locale, `Xem ${warehouseName(entry, locale)}`, `View ${warehouseName(entry, locale)}`)}
      onClick={(event) => onOpen(entry, event.currentTarget)}
    >
      <WarehouseArtwork entry={entry} kind="arcana" />
      <span className="wiki-arcana-row-text">
        <strong>{arcanaTitle(entry, locale)}</strong>
        <span className="wiki-arcana-row-stats">
          {entry.content.stats.map((stat) => (
            <span key={stat.key}>
              {labels?.[stat.key] || stat.key} <b>{warehouseStatValue(stat, locale)}</b>
            </span>
          ))}
          {!entry.content.stats.length && <span>{wikiText(locale, "Chưa có chỉ số", "No stats recorded")}</span>}
        </span>
      </span>
    </button>
  )
}

/**
 * One tier as columns of rows: a column for each color, or for each stat family once a single color is chosen. A column
 * lists its arcana one to a line, so no row of a grid is ever left half empty.
 */
function ArcanaTier({
  rows,
  color,
  grouped,
  allEntries,
  selectedId,
  onOpen,
}: {
  rows: Row[]
  color: string
  /** Label the stat families inside a color; a filtered list is short enough without them. */
  grouped: boolean
  allEntries: PublishedWarehouseRecord[]
  selectedId: string | null
  onOpen: (entry: WarehouseEntry, button: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const family = (key: ArcanaFamily) => wikiText(locale, ...FAMILY_NAMES[key])
  const columns: {
    key: string
    title: string
    art?: ReactNode
    groups: { key: string; label: string; rows: Row[] }[]
  }[] = color
    ? ARCANA_FAMILIES.map((key) => ({
        key,
        title: family(key),
        groups: [{ key, label: "", rows: rows.filter((row) => row.family === key) }],
      }))
    : ARCANA_COLORS.map((key: ArcanaColor) => {
        const members = rows.filter((row) => row.entry.content.color === key)
        return {
          key,
          title: wikiText(locale, `Ngọc ${arcanaColorName(key, locale)}`, `${arcanaColorName(key, locale)} arcana`),
          art: <ArcanaColorArt color={key} entries={allEntries} />,
          groups: grouped
            ? ARCANA_FAMILIES.map((member) => ({
                key: member,
                label: family(member),
                rows: members.filter((row) => row.family === member),
              }))
            : [{ key: "all", label: "", rows: members }],
        }
      })
  const shown = columns
    .map((column) => ({ ...column, groups: column.groups.filter((group) => group.rows.length) }))
    .filter((column) => column.groups.length)
  return (
    <div className="wiki-arcana-columns" style={{ "--columns": shown.length } as CSSProperties}>
      {shown.map((column) => (
        <section key={column.key} className="wiki-arcana-column" aria-label={column.title}>
          <h3>
            {column.art}
            {column.title}
            <small>{column.groups.reduce((total, group) => total + group.rows.length, 0)}</small>
          </h3>
          {column.groups.map((group) => (
            <div key={group.key} className="wiki-arcana-group">
              {group.label && column.groups.length > 1 && <h4>{group.label}</h4>}
              <div
                className="wiki-arcana-rows"
                // A column on its own has the whole width, so its rows spread over several columns.
                data-fill={shown.length === 1 || undefined}
                style={shown.length === 1 ? (fillStyle(group.rows.length) as CSSProperties) : undefined}
              >
                {group.rows.map(({ entry }) => (
                  <ArcanaRow key={entry.id} entry={entry} selected={entry.id === selectedId} onOpen={onOpen} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

export function ArcanaCatalog({
  entries,
  allEntries,
  group,
  params,
  searching,
  selectedId,
  onSelect,
}: {
  /** Entries left by the page search. */
  entries: PublishedWarehouseRecord[]
  allEntries: PublishedWarehouseRecord[]
  group: string
  params: URLSearchParams
  searching: boolean
  selectedId: string | null
  onSelect: (entry: WarehouseEntry, button?: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const filters = arcanaFilters(params, group)
  const rows = arcanaRows(entries, filters, locale)
  const tiers = [...new Set(rows.map(({ entry }) => entry.content.tier))]
  // What the reader opened or closed by hand; a tier they did not touch follows the filters and the open entry.
  const [chosen, setChosen] = useState<Record<number, boolean>>({})
  const narrowed = searching || !!filters.stat || !!filters.tier
  const selectedTier = rows.find(({ entry }) => entry.id === selectedId)?.entry.content.tier
  if (!rows.length) return <EmptyGroup />
  return (
    <div className="wiki-arcana">
      {tiers.map((tier, index) => {
        const inTier = rows.filter(({ entry }) => entry.content.tier === tier)
        const title = ARCANA_COLORS.some((color) => color === filters.color)
          ? arcanaGroupLabel(filters.color as ArcanaColor, tier, locale)
          : wikiText(locale, `Ngọc bậc ${romanTier(tier)}`, `Tier ${romanTier(tier)} arcana`)
        const body = (
          <ArcanaTier
            rows={inTier}
            color={filters.color}
            grouped={!searching && !filters.stat}
            allEntries={allEntries}
            selectedId={selectedId}
            onOpen={onSelect}
          />
        )
        // The highest tier on screen is what builds use, so it is always open; lower ones wait to be asked for.
        if (index === 0)
          return (
            <section key={tier} className="wiki-warehouse-section" aria-label={title}>
              <GroupHeading title={title} count={inTier.length} />
              {body}
            </section>
          )
        const open = chosen[tier] ?? (narrowed || tier === selectedTier)
        return (
          <FoldedGroup
            key={tier}
            title={title}
            count={inTier.length}
            open={open}
            onToggle={() => setChosen((current) => ({ ...current, [tier]: !open }))}
          >
            {body}
          </FoldedGroup>
        )
      })}
    </div>
  )
}
