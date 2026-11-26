import { useState, type CSSProperties, type ReactNode } from "react"
import { arcanaGroupLabel, compactArcanaName } from "@aov/ui/components/warehouse/arcana-cards"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  ARCANA_COLORS,
  ARCANA_FAMILIES,
  arcanaChosenCodes,
  arcanaFilters,
  arcanaRows,
  type ArcanaColor,
  type ArcanaFamily,
  type WarehouseArcana,
} from "./use-item-catalog"
import { WarehouseArtwork } from "./warehouse-artwork"
import { WarehouseEntryLink } from "./warehouse-entry-link"
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

const NONE: ReadonlySet<string> = new Set()

/**
 * One arcana as its stats, one to a line with the figure at the end. Its name only lists those same stats, so the row
 * leaves it to the reader's screen reader and the detail panel.
 */
function ArcanaRow({
  entry,
  pieces,
  chosen,
  dimmed,
  selected,
  onOpen,
}: {
  entry: WarehouseArcana
  pieces: Pieces
  chosen: ReadonlySet<string>
  dimmed: boolean
  selected: boolean
  onOpen: (entry: WarehouseEntry, element: HTMLElement) => void
}) {
  const { locale } = useWikiContext()
  return (
    <WarehouseEntryLink
      kind="arcana"
      entry={entry}
      selected={selected}
      onOpen={onOpen}
      className="wiki-arcana-row arcana-card"
      data-dimmed={(dimmed && !selected) || undefined}
      aria-label={wikiText(locale, `Xem ${warehouseName(entry, locale)}`, `View ${warehouseName(entry, locale)}`)}
    >
      <WarehouseArtwork entry={entry} kind="arcana" />
      <ArcanaStatLines entry={entry} pieces={pieces} chosen={chosen} />
    </WarehouseEntryLink>
  )
}

/** An arcana's stats, one to a line with the figure at the end, for one piece or several. */
export function ArcanaStatLines({
  entry,
  pieces = 1,
  chosen = NONE,
}: {
  entry: WarehouseArcana
  pieces?: number
  /** The stat codes the reader filtered on: those lines stay bright and the others step back. */
  chosen?: ReadonlySet<string>
}) {
  const { locale } = useWikiContext()
  const text = warehouseText(entry.content.translations, locale)
  return (
    <span className="wiki-arcana-row-stats" data-comparing={chosen.size ? "" : undefined}>
      {entry.content.stats.map((stat) => (
        <span key={stat.key} data-chosen={chosen.has(stat.key) || undefined}>
          <span>{warehouseStatLabel(stat.key, text, locale)}</span>
          <b>{warehouseStatValue({ ...stat, value: stat.value * pieces }, locale)}</b>
        </span>
      ))}
      {!entry.content.stats.length && <span>{wikiText(locale, "Chưa có chỉ số", "No stats recorded")}</span>}
    </span>
  )
}

/** An arcana named by its stats in the shared stat names, as its rows show them, in the reader's language. */
export function arcanaStatName(entry: WarehouseArcana, locale: string) {
  const text = warehouseText(entry.content.translations, locale)
  const names = entry.content.stats.map((stat) => warehouseStatLabel(stat.key, text, locale))
  return names.length ? names.join(" / ") : arcanaTitle(entry, locale)
}

export function arcanaFamilyName(family: ArcanaFamily, locale: string) {
  return wikiText(locale, ...FAMILY_NAMES[family])
}

/**
 * One tier as columns of rows: a column for each color, or for each stat family once a single color is chosen. A column
 * lists its arcana one to a line, so no row of a grid is ever left half empty.
 */
function ArcanaTier({
  rows,
  color,
  pieces,
  chosen,
  matches,
  allEntries,
  selectedId,
  onOpen,
}: {
  rows: Row[]
  color: string
  pieces: Pieces
  chosen: ReadonlySet<string>
  /** The arcana a search or stat filter matches; the others are dimmed. Null when nothing narrows the list. */
  matches: ReadonlySet<string> | null
  allEntries: PublishedWarehouseRecord[]
  selectedId: string | null
  onOpen: (entry: WarehouseEntry, element: HTMLElement) => void
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
          groups: ARCANA_FAMILIES.map((member) => ({
            key: member,
            label: family(member),
            rows: members.filter((row) => row.family === member),
          })),
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
                    chosen={chosen}
                    dimmed={!!matches && !matches.has(entry.id)}
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
  onFilters,
}: {
  /** Entries left by the page search. */
  entries: PublishedWarehouseRecord[]
  allEntries: PublishedWarehouseRecord[]
  group: string
  params: URLSearchParams
  searching: boolean
  selectedId: string | null
  onSelect: (entry: WarehouseEntry, button?: HTMLElement) => void
  onFilters: (filters: Record<string, string | null>) => void
}) {
  const { locale } = useWikiContext()
  const filters = arcanaFilters(params, group)
  // As on the item board, a search or a stat filter leaves every arcana in its place and dims the ones it does not
  // match, so the columns never jump; only the color filter takes arcana off the page.
  const rows = arcanaRows(allEntries, { ...filters, stats: [] }, locale)
  const narrowed = searching || filters.stats.length > 0
  const matches = narrowed ? new Set(arcanaRows(entries, filters, locale).map(({ entry }) => entry.id)) : null
  const [top, ...lower] = [...new Set(rows.map(({ entry }) => entry.content.tier))]
  // Kept in the address, so it stays as the reader changes filters or shares the link.
  const pieces: Pieces = params.get("pieces") === String(PIECES_PER_COLOR) ? PIECES_PER_COLOR : 1
  // What the reader did with the lower tiers by hand; untouched, they follow the filters and the open entry.
  const [lowerChosen, setLowerChosen] = useState<boolean>()
  const chosen = arcanaChosenCodes(filters.stats)
  const selectedTier = rows.find(({ entry }) => entry.id === selectedId)?.entry.content.tier
  if (!rows.length || matches?.size === 0) return <EmptyGroup />

  const tierTitle = (tier: number) =>
    ARCANA_COLORS.some((color) => color === filters.color)
      ? arcanaGroupLabel(filters.color as ArcanaColor, tier, locale)
      : wikiText(locale, `Ngọc bậc ${romanTier(tier)}`, `Tier ${romanTier(tier)} arcana`)
  const inTier = (tier: number) => rows.filter(({ entry }) => entry.content.tier === tier)
  const body = (tier: number) => (
    <ArcanaTier
      rows={inTier(tier)}
      color={filters.color}
      pieces={pieces}
      chosen={chosen}
      matches={matches}
      allEntries={allEntries}
      selectedId={selectedId}
      onOpen={onSelect}
    />
  )
  // The lower tiers stay folded while searching, as they are rarely what the reader wants; their line says how many
  // arcana in them match. They open by themselves only for the open entry.
  const lowerMatches = matches
    ? rows.filter(({ entry }) => lower.includes(entry.content.tier) && matches.has(entry.id)).length
    : 0
  const lowerOpen = lowerChosen ?? (selectedTier !== undefined && lower.includes(selectedTier))
  const lowerNames = [...lower].reverse().map(romanTier)
  return (
    <div className="wiki-arcana">
      {/* The highest tier on screen is the one builds use, so it is always open. */}
      <section className="wiki-warehouse-section" aria-label={tierTitle(top)}>
        <GroupHeading
          title={tierTitle(top)}
          count={inTier(top).length}
          aside={
            <PiecesSwitch
              pieces={pieces}
              onChange={(count) => onFilters({ pieces: count === 1 ? null : String(count) })}
            />
          }
        />
        {body(top)}
      </section>
      {lower.length > 0 && (
        // Lower tiers only stand in until a player owns the top one: one quiet line until asked for.
        <FoldedGroup
          title={
            wikiText(locale, `Ngọc bậc ${lowerNames.join(" và ")}`, `Tier ${lowerNames.join(" and ")} arcana`) +
            (lowerMatches ? wikiText(locale, ` · ${lowerMatches} khớp`, ` · ${lowerMatches} match`) : "")
          }
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
