import { useState, type FocusEvent, type KeyboardEvent } from "react"
import { firstCell, nextCell, type CellAt } from "../../../lib/meetings-cells"

function cellOf(target: EventTarget): CellAt | null {
  const name = target instanceof Element ? target.closest<HTMLElement>("[data-cell]")?.dataset.cell : undefined
  const [row, column] = (name ?? "").split(":").map(Number)
  return row != null && column != null ? [row, column] : null
}

/**
 * One stop of the tab key for a table whose cells open something: the arrow keys walk from cell to cell, and coming back
 * returns to the cell that was left. `opens` tells which cells open; `row` is where a reader starts.
 */
export function useCellFocus(opens: boolean[][], row = 0) {
  const [left, setLeft] = useState<CellAt | null>(null)
  const at = left && opens[left[0]]?.[left[1]] ? left : firstCell(opens, row)
  return {
    table: {
      onFocus: ({ target }: FocusEvent) => setLeft((current) => cellOf(target) ?? current),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const cell = event.altKey || event.ctrlKey || event.metaKey ? null : cellOf(event.target)
        const next = cell && nextCell(opens, cell, event.key)
        if (!next) return
        event.preventDefault()
        const target = event.currentTarget.querySelector<HTMLElement>(`[data-cell="${next.join(":")}"]`)
        // Focus alone would leave the cell under what is pinned beside or above it.
        target?.focus({ preventScroll: true })
        target?.scrollIntoView({ block: "nearest", inline: "nearest" })
      },
    },
    cell: (atRow: number, column: number) => ({
      "data-cell": `${atRow}:${column}`,
      tabIndex: at?.[0] === atRow && at[1] === column ? 0 : -1,
    }),
  }
}
