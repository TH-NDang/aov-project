import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { arcanaGroupLabel } from "@aov/ui/components/warehouse/arcana-cards"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  ARCANA_PAGE_SLOTS,
  addPieces,
  byColor,
  clearColor,
  colorCount,
  fillColor,
  pageTotals,
  readArcanaPage,
  removePieces,
  writeArcanaPage,
  type PageArcana,
  type PagePiece,
} from "./arcana-page-model"
import { ARCANA_COLORS, ARCANA_FAMILIES, arcanaRows, type ArcanaColor, type WarehouseArcana } from "./use-item-catalog"
import { arcanaFamilyName, arcanaStatName, ArcanaStatLines } from "./warehouse-arcana"
import { WarehouseArtwork } from "./warehouse-artwork"
import { ArcanaColorArt, arcanaColorName } from "./warehouse-parts"
import { warehouseStatLabel, warehouseStatValue, type PublishedWarehouseRecord } from "../../lib/warehouse-types"
import "./warehouse-arcana-page.css"

/** The arcana a page is built from: the top tier alone, as lower tiers only stand in until a player owns it. */
export function pageArcanaOf(entries: PublishedWarehouseRecord[]) {
  const records = entries.filter((entry): entry is WarehouseArcana => entry.kind === "arcana")
  const tier = Math.max(0, ...records.map((entry) => entry.content.tier))
  const pool = records.filter((entry) => entry.content.tier === tier)
  const arcana: PageArcana[] = pool.map((entry) => ({
    code: entry.code,
    color: entry.content.color,
    stats: entry.content.stats,
  }))
  return { tier, pool, arcana }
}

/**
 * The arcana page as the game's arcana screen: ten slots of each color, filled from the top tier, with the stats of the
 * whole page added up beside it. The page lives in the address (`slots=`), so a link shares it.
 */
export function ArcanaPageView({
  entries,
  params,
  onFilters,
}: {
  entries: PublishedWarehouseRecord[]
  params: URLSearchParams
  onFilters: (filters: Record<string, string | null>) => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { tier, pool, arcana } = useMemo(() => pageArcanaOf(entries), [entries])
  const page = readArcanaPage(params.get("slots"), arcana)
  const open = (from: PagePiece[]) => ARCANA_COLORS.find((key) => colorCount(from, arcana, key) < ARCANA_PAGE_SLOTS)
  const [chosen, setChosen] = useState<ArcanaColor>()
  const color = chosen ?? open(page) ?? "RED"
  // The arcana a reader picked on the board: the picker opens its color and brings its row into view for a moment.
  const [focused, setFocused] = useState<string | null>(null)
  const focus = (entry: WarehouseArcana) => {
    setChosen(entry.content.color)
    setFocused(entry.code)
    window.setTimeout(() => setFocused((current) => (current === entry.code ? null : current)), 1600)
  }

  /** Writes the page; a color that just filled up hands the picker to the next color with room. */
  const write = (next: PagePiece[]) => {
    onFilters({ slots: writeArcanaPage(next) || null })
    if (colorCount(next, arcana, color) === ARCANA_PAGE_SLOTS && colorCount(page, arcana, color) < ARCANA_PAGE_SLOTS)
      setChosen(open(next) ?? color)
  }

  if (!pool.length) return null
  return (
    <div className="wiki-arcana-builder">
      <div className="wiki-arcana-builder-main">
        <ArcanaBoard
          page={page}
          pool={pool}
          arcana={arcana}
          color={color}
          onColor={setChosen}
          onFocus={focus}
          onChange={write}
        />
        <ArcanaPicker
          rows={arcanaRows(pool, { color, tier: String(tier), stats: [] }, locale)}
          title={arcanaGroupLabel(color, tier, locale)}
          page={page}
          arcana={arcana}
          free={ARCANA_PAGE_SLOTS - colorCount(page, arcana, color)}
          focused={focused}
          onChange={write}
        />
      </div>
      <PageSummary page={page} pool={pool} arcana={arcana} onFocus={focus} onClear={() => write([])} text={text} />
    </div>
  )
}

/** Three lines of ten slots. A group opens its arcana in the picker, where its count is changed; so do the free slots. */
function ArcanaBoard({
  page,
  pool,
  arcana,
  color,
  onColor,
  onFocus,
  onChange,
}: {
  page: PagePiece[]
  pool: WarehouseArcana[]
  arcana: PageArcana[]
  color: ArcanaColor
  onColor: (color: ArcanaColor) => void
  onFocus: (entry: WarehouseArcana) => void
  onChange: (page: PagePiece[]) => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  return (
    <div className="wiki-arcana-board">
      {ARCANA_COLORS.map((key) => {
        const placed = colorCount(page, arcana, key)
        const name = arcanaColorName(key, locale)
        // One group per arcana, as wide as its pieces: ten identical pictures would not say which arcana they are.
        const groups = page.flatMap((piece) => {
          const entry = pool.find((candidate) => candidate.code === piece.code)
          return entry?.content.color === key ? [{ entry, count: piece.count }] : []
        })
        const free = ARCANA_PAGE_SLOTS - placed
        return (
          <section key={key} className="wiki-arcana-board-line" data-active={key === color || undefined}>
            <div className="wiki-arcana-board-head">
              <button
                type="button"
                aria-pressed={key === color}
                onClick={() => onColor(key)}
                aria-label={text(`Chọn ngọc ${name}`, `Pick ${name.toLowerCase()} arcana`)}
              >
                <ArcanaColorArt color={key} entries={pool} />
                {name}
                <small>
                  {placed}/{ARCANA_PAGE_SLOTS}
                </small>
              </button>
              {placed > 0 && (
                <button
                  type="button"
                  className="wiki-arcana-board-clear"
                  onClick={() => onChange(clearColor(page, arcana, key))}
                  aria-label={text(`Bỏ hết ngọc ${name}`, `Remove all ${name.toLowerCase()} arcana`)}
                  title={text(`Bỏ hết ngọc ${name}`, `Remove all ${name.toLowerCase()} arcana`)}
                >
                  <WikiIcon name="broom" size={16} />
                </button>
              )}
            </div>
            <ol className="wiki-arcana-slots" aria-label={text(`Ô ngọc ${name}`, `${name} slots`)}>
              {groups.map(({ entry, count }) => {
                const title = arcanaStatName(entry, locale)
                return (
                  <li key={entry.code} style={{ "--count": count } as CSSProperties}>
                    <div className="wiki-arcana-slot">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="wiki-arcana-slot-main"
                            onClick={() => onFocus(entry)}
                            aria-label={text(
                              `${title}, ${count} viên. Mở trong danh sách`,
                              `${title}, ${count} pieces. Open in the list`,
                            )}
                          >
                            <WarehouseArtwork entry={entry} kind="arcana" />
                            <span className="wiki-arcana-slot-name">{title}</span>
                            <b>×{count}</b>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6} className="wiki-arcana-slot-tip">
                          <strong>
                            {title} <b>×{count}</b>
                          </strong>
                          <span>{text(`${count} viên cộng vào bảng:`, `${count} pieces add:`)}</span>
                          <ArcanaStatLines entry={entry} pieces={count} />
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </li>
                )
              })}
              {free > 0 && (
                <li style={{ "--count": free } as CSSProperties}>
                  <button
                    type="button"
                    data-empty
                    onClick={() => onColor(key)}
                    aria-label={text(
                      `Còn ${free} ô trống, chọn ngọc ${name}`,
                      `${free} free slots, pick ${name.toLowerCase()} arcana`,
                    )}
                  >
                    <span className="wiki-arcana-slot-name">{text(`còn ${free} ô`, `${free} free`)}</span>
                  </button>
                </li>
              )}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

/** The top-tier arcana of one color, each with how many of it the page holds. */
function ArcanaPicker({
  rows,
  title,
  page,
  arcana,
  free,
  focused,
  onChange,
}: {
  rows: ReturnType<typeof arcanaRows>
  title: string
  page: PagePiece[]
  arcana: PageArcana[]
  free: number
  /** The arcana picked on the board, brought into view and marked for a moment. */
  focused: string | null
  onChange: (page: PagePiece[]) => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!focused) return
    const row = section.current?.querySelector<HTMLElement>(`[data-code="${CSS.escape(focused)}"]`)
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    row?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" })
  }, [focused])
  return (
    <section ref={section} className="wiki-arcana-picker" aria-label={title}>
      <h3>
        {title}
        <small>{free ? text(`còn ${free} ô`, `${free} slots free`) : text("đã đủ 10 viên", "all 10 filled")}</small>
      </h3>
      {ARCANA_FAMILIES.map((family) => {
        const members = rows.filter((row) => row.family === family)
        if (!members.length) return null
        return (
          <div key={family} className="wiki-arcana-picker-group">
            <h4>{arcanaFamilyName(family, locale)}</h4>
            {members.map(({ entry }) => {
              const count = page.find((piece) => piece.code === entry.code)?.count ?? 0
              const name = arcanaStatName(entry, locale)
              return (
                <div
                  key={entry.id}
                  className="wiki-arcana-pick"
                  data-code={entry.code}
                  data-placed={count > 0 || undefined}
                  data-focused={entry.code === focused || undefined}
                >
                  <button
                    type="button"
                    className="wiki-arcana-pick-main"
                    disabled={!free}
                    onClick={() => onChange(addPieces(page, arcana, entry.code))}
                    aria-label={text(`Thêm một viên ${name}`, `Add one ${name}`)}
                  >
                    <WarehouseArtwork entry={entry} kind="arcana" />
                    <ArcanaStatLines entry={entry} />
                  </button>
                  <div className="wiki-arcana-stepper" role="group" aria-label={name}>
                    <button
                      type="button"
                      disabled={!count}
                      onClick={() => onChange(removePieces(page, entry.code))}
                      aria-label={text(`Bớt một viên ${name}`, `One fewer ${name}`)}
                    >
                      <WikiIcon name="minus" size={16} />
                    </button>
                    <output aria-label={text(`Đã lắp ${count} viên`, `${count} placed`)}>{count}</output>
                    <button
                      type="button"
                      disabled={!free}
                      onClick={() => onChange(addPieces(page, arcana, entry.code))}
                      aria-label={text(`Thêm một viên ${name}`, `Add one ${name}`)}
                    >
                      <WikiIcon name="plus" size={16} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="wiki-arcana-pick-fill"
                    disabled={free < 2}
                    onClick={() => onChange(fillColor(page, arcana, entry.code))}
                    title={text(`Lắp ${name} vào mọi ô còn trống`, `Fill every free slot with ${name}`)}
                  >
                    {text("Lắp kín", "Fill")}
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}
    </section>
  )
}

/** The whole page added up, then what it holds, color by color; an arcana there opens it in the picker. */
function PageSummary({
  page,
  pool,
  arcana,
  onFocus,
  onClear,
  text,
}: {
  page: PagePiece[]
  pool: WarehouseArcana[]
  arcana: PageArcana[]
  onFocus: (entry: WarehouseArcana) => void
  onClear: () => void
  text: (vi: string, en: string) => string
}) {
  const { locale } = useWikiContext()
  const totals = pageTotals(page, arcana)
  const placed = page.reduce((total, piece) => total + piece.count, 0)
  return (
    <aside className="wiki-arcana-summary" aria-label={text("Tổng chỉ số", "Page totals")}>
      <h3>
        {text("Tổng chỉ số", "Page totals")}
        <small>
          {placed}/{ARCANA_PAGE_SLOTS * ARCANA_COLORS.length} {text("viên", "pieces")}
        </small>
      </h3>
      {totals.length ? (
        <dl className="wiki-arcana-totals">
          {totals.map((total) => (
            <div key={`${total.key}|${total.unit ?? ""}`}>
              <dt>{warehouseStatLabel(total.key, undefined, locale)}</dt>
              <dd>{warehouseStatValue(total, locale)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="wiki-arcana-summary-empty">
          {text(
            "Chưa lắp viên nào. Bấm một viên ngọc để lắp vào ô trống.",
            "No pieces yet. Press an arcana to place it in a free slot.",
          )}
        </p>
      )}
      {placed > 0 && (
        <>
          <ul className="wiki-arcana-placed">
            {byColor(page, arcana).map((piece) => {
              const entry = pool.find((candidate) => candidate.code === piece.code)
              return (
                entry && (
                  <li key={piece.code}>
                    <button
                      type="button"
                      onClick={() => onFocus(entry)}
                      aria-label={text(
                        `${arcanaStatName(entry, locale)}, ${piece.count} viên. Mở trong danh sách`,
                        `${arcanaStatName(entry, locale)}, ${piece.count} pieces. Open in the list`,
                      )}
                    >
                      <WarehouseArtwork entry={entry} kind="arcana" />
                      <span className="wiki-arcana-placed-name">{arcanaStatName(entry, locale)}</span>
                      <b>×{piece.count}</b>
                    </button>
                  </li>
                )
              )
            })}
          </ul>
          <button type="button" className="wiki-arcana-summary-clear" onClick={onClear}>
            <WikiIcon name="broom" size={16} />
            {text("Bỏ hết ngọc", "Clear the page")}
          </button>
        </>
      )}
    </aside>
  )
}
