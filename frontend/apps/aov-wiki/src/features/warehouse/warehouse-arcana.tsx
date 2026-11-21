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
  warehouseStatLabel,
  warehouseStatValue,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseEntry,
} from "../../lib/warehouse-types"

const FAMILY_NAMES: Record<ArcanaFamily, [string, string]> = {
  physical: ["Công vật lý", "Physical"],
  magic: ["Phép", "Magic"],
  neutral: ["Trung tính", "Neutral"],
}

/** An arcana page holds ten of each color, so ten pieces is what one arcana gives when it fills its color. */
const PIECES_PER_COLOR = 10

type Pieces = 1 | typeof PIECES_PER_COLOR

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

/**
 * One arcana as its stats, one to a line with the figure at the end. Its name only lists those same stats, so the row
 * leaves it to the reader's screen reader and the detail panel.
 */
function ArcanaRow({
  entry,
  pieces,
  chosenStat,
  selected,
  onOpen,
}: {
  entry: WarehouseArcana
  pieces: Pieces
  chosenStat: string
  selected: boolean
  onOpen: (entry: WarehouseEntry, button: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const text = warehouseText(entry.content.translations, locale)
  return (
    <button
      type="button"
      className="wiki-arcana-row arcana-card"
      aria-pressed={selected}
      aria-label={wikiText(locale, `Xem ${warehouseName(entry, locale)}`, `View ${warehouseName(entry, locale)}`)}
      onClick={(event) => onOpen(entry, event.currentTarget)}
    >
      <WarehouseArtwork entry={entry} kind="arcana" />
      <span className="wiki-arcana-row-stats" data-comparing={chosenStat ? "" : undefined}>
        {entry.content.stats.map((stat) => (
          <span key={stat.key} data-chosen={stat.key === chosenStat || undefined}>
            <span>{warehouseStatLabel(stat.key, text, locale)}</span>
            <b>{warehouseStatValue({ ...stat, value: stat.value * pieces }, locale)}</b>
          </span>
        ))}
        {!entry.content.stats.length && <span>{wikiText(locale, "Chưa có chỉ số", "No stats recorded")}</span>}
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
  pieces,
  chosenStat,
  allEntries,
  selectedId,
  onOpen,
}: {
  rows: Row[]
  color: string
  /** Label the stat families inside a color; a filtered list is short enough without them. */
  grouped: boolean
  pieces: Pieces
  chosenStat: string
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
                  <ArcanaRow
                    key={entry.id}
                    entry={entry}
                    pieces={pieces}
                    chosenStat={chosenStat}
                    selected={entry.id === selectedId}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** Whether the figures are for one piece or for a color filled with it. */
function PiecesSwitch({ pieces, onChange }: { pieces: Pieces; onChange: (pieces: Pieces) => void }) {
  const { locale } = useWikiContext()
  return (
    <div
      className="wiki-arcana-pieces"
      role="group"
      aria-label={wikiText(locale, "Chỉ số tính cho", "Stats shown for")}
      title={wikiText(
        locale,
        `Mỗi màu có ${PIECES_PER_COLOR} ô trong bảng ngọc. ${PIECES_PER_COLOR} viên là khi lắp kín một màu bằng viên đó.`,
        `An arcana page has ${PIECES_PER_COLOR} slots of each color. ${PIECES_PER_COLOR} pieces fill one color with that arcana.`,
      )}
    >
      {([1, PIECES_PER_COLOR] as const).map((count) => (
        <button key={count} type="button" aria-pressed={pieces === count} onClick={() => onChange(count)}>
          {wikiText(locale, `${count} viên`, count === 1 ? "1 piece" : `${count} pieces`)}
        </button>
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
  const [top, ...lower] = [...new Set(rows.map(({ entry }) => entry.content.tier))]
  const [pieces, setPieces] = useState<Pieces>(1)
  // What the reader did with the lower tiers by hand; untouched, they follow the filters and the open entry.
  const [lowerChosen, setLowerChosen] = useState<boolean>()
  const narrowed = searching || !!filters.stat
  const selectedTier = rows.find(({ entry }) => entry.id === selectedId)?.entry.content.tier
  if (!rows.length) return <EmptyGroup />

  const tierTitle = (tier: number) =>
    ARCANA_COLORS.some((color) => color === filters.color)
      ? arcanaGroupLabel(filters.color as ArcanaColor, tier, locale)
      : wikiText(locale, `Ngọc bậc ${romanTier(tier)}`, `Tier ${romanTier(tier)} arcana`)
  const inTier = (tier: number) => rows.filter(({ entry }) => entry.content.tier === tier)
  const body = (tier: number) => (
    <ArcanaTier
      rows={inTier(tier)}
      color={filters.color}
      grouped={!searching && !filters.stat}
      pieces={pieces}
      chosenStat={filters.stat}
      allEntries={allEntries}
      selectedId={selectedId}
      onOpen={onSelect}
    />
  )
  const lowerOpen = lowerChosen ?? (narrowed || (selectedTier !== undefined && lower.includes(selectedTier)))
  const lowerNames = [...lower].reverse().map(romanTier)
  return (
    <div className="wiki-arcana">
      {/* The highest tier on screen is the one builds use, so it is always open. */}
      <section className="wiki-warehouse-section" aria-label={tierTitle(top)}>
        <GroupHeading
          title={tierTitle(top)}
          count={inTier(top).length}
          aside={<PiecesSwitch pieces={pieces} onChange={setPieces} />}
        />
        {body(top)}
      </section>
      {lower.length > 0 && (
        // Lower tiers only stand in until a player owns the top one: one quiet line until asked for.
        <FoldedGroup
          title={wikiText(locale, `Ngọc bậc ${lowerNames.join(" và ")}`, `Tier ${lowerNames.join(" and ")} arcana`)}
          count={lower.reduce((total, tier) => total + inTier(tier).length, 0)}
          open={lowerOpen}
          onToggle={() => setLowerChosen(!lowerOpen)}
        >
          <p className="wiki-arcana-lower-note">
            {wikiText(
              locale,
              `Chỉ số thấp hơn bậc ${romanTier(top)}, chỉ dùng khi chưa có đủ ngọc bậc ${romanTier(top)}.`,
              `Lower stats than tier ${romanTier(top)}; only worth using until you own enough tier ${romanTier(top)} arcana.`,
            )}
          </p>
          {lower.map((tier) => (
            <section key={tier} className="wiki-arcana-lower-tier" aria-label={tierTitle(tier)}>
              <h3>
                {tierTitle(tier)}
                <small>{inTier(tier).length}</small>
              </h3>
              {body(tier)}
            </section>
          ))}
        </FoldedGroup>
      )}
    </div>
  )
}
