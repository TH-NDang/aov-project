import { useState, type ReactNode } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import { BOARD_COLUMNS, BOARD_ROWS, ROW_LABEL, cellOf, type BoardRow, type LineupUnit } from "./auto-chess-model"
import { UnitPortrait, type GuideIndex } from "./auto-chess-guide"

/*
 * A player's half of the board as the game draws it: three rows of seven square cells, the front row on top facing
 * the opponent. Lineup cards show where each unit stands; the builder places units by tapping cells.
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

/** Two icon buttons that switch a lineup between the board and the list. */
export function LineupViewSwitch({ view, onChange }: { view: LineupView; onChange: (view: LineupView) => void }) {
  return (
    <span className="view-switch" role="group" aria-label="Cách xem đội hình">
      <button
        type="button"
        aria-pressed={view === "board"}
        title="Xem trên bàn cờ"
        aria-label="Xem trên bàn cờ"
        onClick={() => onChange("board")}
      >
        <WikiIcon name="chessboard" size={18} />
      </button>
      <button
        type="button"
        aria-pressed={view === "list"}
        title="Xem dạng danh sách"
        aria-label="Xem dạng danh sách"
        onClick={() => onChange("list")}
      >
        <WikiIcon name="all" size={18} />
      </button>
    </span>
  )
}

/** The grid itself; `cell` draws what stands on each cell. */
export function BoardGrid({
  label,
  cell,
  footer,
}: {
  label: string
  cell: (row: BoardRow, column: number) => ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="board-wrap">
      <span className="board-enemy" aria-hidden="true">
        ↑ Phía đối thủ
      </span>
      <div className="board" role="grid" aria-label={label}>
        {BOARD_ROWS.map((row) => (
          <div key={row} className="board-row" role="row" aria-label={ROW_LABEL[row]}>
            {COLUMNS.map((column) => (
              <div key={column} className="board-cell" role="gridcell" aria-label={`${ROW_LABEL[row]}, ô ${column}`}>
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
}: {
  item: { unitCode: string; carry: boolean }
  index: GuideIndex
  selected?: boolean
  onClick: () => void
  title?: string
}) {
  const unit = index.units.get(item.unitCode)
  if (!unit) return null
  return (
    <button
      type="button"
      className="board-piece"
      aria-pressed={selected}
      title={title ?? `${unit.name}${item.carry ? " · chủ lực" : ""}`}
      onClick={onClick}
    >
      <UnitPortrait unit={unit} index={index} />
      {item.carry && (
        <em className="carry-mark" aria-label="Chủ lực">
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
  const { placed, bench } = placeUnits(units.filter((item) => index.units.has(item.unitCode)))
  return (
    <BoardGrid
      label="Bàn cờ của đội hình"
      cell={(row, column) => {
        const item = placed.get(`${row}-${column}`)
        return item ? <BoardPiece item={item} index={index} onClick={() => onOpen(item.unitCode)} /> : null
      }}
      footer={
        bench.length > 0 && (
          <div className="board-bench" aria-label="Chưa xếp chỗ">
            <span className="mode-meta">Chưa xếp chỗ</span>
            {bench.map((item) => (
              <BoardPiece key={item.unitCode} item={item} index={index} onClick={() => onOpen(item.unitCode)} />
            ))}
          </div>
        )
      }
    />
  )
}
