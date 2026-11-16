import { useState, type DragEvent, type ReactNode } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  ROW_NAMES,
  cellOf,
  traitCounts,
  type BoardRow,
  type LineupUnit,
} from "./auto-chess-model"
import { ChoiceSwitch, TraitIcon, UnitPortrait, type GuideIndex } from "./guide-ui"

/*
 * A player's half of the board as the game draws it: three rows of seven square cells, the front row on top facing
 * the opponent. Lineup cards show where each unit stands; the builder places units by tapping or dragging.
 */

const COLUMNS = Array.from({ length: BOARD_COLUMNS }, (_, at) => at + 1)

export type LineupView = "board" | "list"

const VIEW_KEY = "aov-wiki:lineup-view"

/** The reader's choice between the board and the plain list, remembered on this device. */
export function useLineupView() {
  const [view, setView] = useState<LineupView>(() => {
    try {
      return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board"
    } catch {
      return "board"
    }
  })
  const choose = (next: LineupView) => {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Storage may be off; the choice then lasts for this visit only.
    }
  }
  return [view, choose] as const
}

/** Switches a lineup between the board and the list. */
export function LineupViewSwitch({
  view,
  onChange,
  labels = false,
}: {
  view: LineupView
  onChange: (view: LineupView) => void
  labels?: boolean
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  return (
    <ChoiceSwitch
      label={text("Cách xem đội hình", "Lineup view")}
      value={view}
      onChange={onChange}
      labels={labels}
      options={[
        { value: "board", label: text("Bàn cờ", "Board"), icon: <WikiIcon name="chessboard" size={16} /> },
        { value: "list", label: text("Danh sách", "List"), icon: <WikiIcon name="all" size={16} /> },
      ]}
    />
  )
}

/** What a dragged unit carries: its code, under a type of its own so nothing else dropped on the board counts. */
const UNIT_DRAG = "application/x-aov-unit"

/** Starts dragging a unit, from the pool or from the board. */
export const dragUnit = (code: string) => (event: DragEvent) => {
  event.dataTransfer.setData(UNIT_DRAG, code)
  event.dataTransfer.effectAllowed = "move"
}

/**
 * The grid itself; `cell` draws what stands on each cell, `onDropUnit` lets units be dragged onto cells. The labels
 * follow the reader's language, so code that looks for a cell reads `data-cell` (`FRONT-3`) inside the board that
 * `slot` names.
 */
export function BoardGrid({
  label,
  slot,
  cell,
  footer,
  onDropUnit,
}: {
  label: string
  slot?: string
  cell: (row: BoardRow, column: number) => ReactNode
  footer?: ReactNode
  onDropUnit?: (code: string, row: BoardRow, column: number) => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [over, setOver] = useState<string | null>(null)
  const drop = (row: BoardRow, column: number) =>
    onDropUnit && {
      onDragOver: (event: DragEvent) => {
        if (!event.dataTransfer.types.includes(UNIT_DRAG)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
        setOver(`${row}-${column}`)
      },
      onDragLeave: () => setOver((current) => (current === `${row}-${column}` ? null : current)),
      onDrop: (event: DragEvent) => {
        const code = event.dataTransfer.getData(UNIT_DRAG)
        setOver(null)
        if (!code) return
        event.preventDefault()
        onDropUnit(code, row, column)
      },
    }
  return (
    <div className="board-wrap">
      <span className="board-enemy" aria-hidden="true">
        {text("↑ Phía đối thủ", "↑ Opponent's side")}
      </span>
      <div className="board" role="grid" aria-label={label} data-slot={slot}>
        {BOARD_ROWS.map((row) => (
          <div key={row} className="board-row" role="row" aria-label={text(...ROW_NAMES[row])}>
            {COLUMNS.map((column) => (
              <div
                key={column}
                className="board-cell"
                role="gridcell"
                aria-label={text(`${ROW_NAMES[row][0]}, ô ${column}`, `${ROW_NAMES[row][1]}, cell ${column}`)}
                data-cell={`${row}-${column}`}
                data-over={over === `${row}-${column}` || undefined}
                {...drop(row, column)}
              >
                {cell(row, column)}
              </div>
            ))}
          </div>
        ))}
      </div>
      {footer}
    </div>
  )
}

/** A unit standing on a cell or waiting on the bench: its portrait, the carry mark and, when there is room, its name. */
export function BoardPiece({
  item,
  index,
  selected,
  onClick,
  title,
  draggable,
}: {
  item: { unitCode: string; carry: boolean }
  index: GuideIndex
  selected?: boolean
  onClick: () => void
  title?: string
  draggable?: boolean
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const unit = index.units.get(item.unitCode)
  if (!unit) return null
  return (
    <button
      type="button"
      className="board-piece"
      aria-pressed={selected}
      title={title ?? `${unit.name}${item.carry ? text(" · chủ lực", " · carry") : ""}`}
      draggable={draggable || undefined}
      onDragStart={draggable ? dragUnit(unit.code) : undefined}
      onClick={onClick}
    >
      <UnitPortrait unit={unit} index={index} />
      {item.carry && (
        <em className="carry-mark" aria-label={text("Chủ lực", "Carry")}>
          M
        </em>
      )}
      <span className="board-name">{unit.name}</span>
    </button>
  )
}

/** Splits units into those standing on a cell (one per cell) and those still on the bench. */
export function placeUnits<T extends { unitCode: string; row?: BoardRow | null; column?: number | null }>(units: T[]) {
  const placed = new Map<string, T>()
  for (const unit of units) {
    const key = cellOf(unit)
    if (key && !placed.has(key)) placed.set(key, unit)
  }
  const bench = units.filter((unit) => {
    const key = cellOf(unit)
    return !key || placed.get(key) !== unit
  })
  return { placed, bench }
}

/** A lineup's units where they stand; units without a cell wait on the bench below the board. */
export function LineupBoard({
  units,
  index,
  onOpen,
}: {
  units: LineupUnit[]
  index: GuideIndex
  onOpen: (code: string) => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { placed, bench } = placeUnits(units.filter((item) => index.units.has(item.unitCode)))
  return (
    <BoardGrid
      label={text("Bàn cờ của đội hình", "Lineup board")}
      cell={(row, column) => {
        const item = placed.get(`${row}-${column}`)
        return item ? <BoardPiece item={item} index={index} onClick={() => onOpen(item.unitCode)} /> : null
      }}
      footer={
        bench.length > 0 && (
          <div className="board-bench" aria-label={text("Chưa xếp chỗ", "Not placed yet")}>
            <span className="mode-meta">{text("Chưa xếp chỗ", "Not placed yet")}</span>
            {bench.map((item) => (
              <BoardPiece key={item.unitCode} item={item} index={index} onClick={() => onOpen(item.unitCode)} />
            ))}
          </div>
        )
      }
    />
  )
}

/** The factions and classes a lineup turns on, each with how many of its units count toward it. */
export function ActiveTraits({ units, emblems, index }: { units: LineupUnit[]; emblems: string[]; index: GuideIndex }) {
  const { locale } = useWikiContext()
  const counts = traitCounts(
    index.content,
    units.map((unit) => unit.unitCode),
    emblems,
  ).filter((count) => count.reachedTier >= 0)
  if (!counts.length) return null
  return (
    <div
      className="guide-trait-tags"
      aria-label={wikiText(locale, "Phe và Nghề kích hoạt", "Active Factions and Classes")}
    >
      {counts.map((count) => (
        <span
          key={count.trait.code}
          className="guide-trait-tag"
          data-active="true"
          title={count.trait.tiers[count.reachedTier]?.effect}
        >
          <TraitIcon trait={count.trait} index={index} size={18} />
          <b>{count.count}</b>
          {count.trait.name}
        </span>
      ))}
    </div>
  )
}
