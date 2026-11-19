import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  decodeLineup,
  encodeLineup,
  MAX_LINEUP_UNITS,
  suggestUnits,
  traitCounts,
  type BoardRow,
  type BuilderUnit,
} from "./auto-chess-model"
import { placeUnits, useLineupView } from "./lineup-board"
import { UNIT_FILTER_KEYS, useUnitFilter } from "./guide-filters"
import type { GuideIndex } from "./guide-ui"

export type Cell = { row: BoardRow; column: number }

/** Marks the board being built, so its cells are found by their place and not by labels in the reader's language. */
export const BOARD_SLOT = "builder-board"

/**
 * The lineup being built and every way to change it. The lineup lives in the address, so a reload or a shared link
 * keeps it; the sheets, the selection and the chosen cell are the screen's own state.
 */
export function useLineupBuilder(index: GuideIndex, compact: boolean) {
  const { locale } = useWikiContext()
  const [params, setParams] = useSearchParams()
  const { units, emblems } = useMemo(() => decodeLineup(params.toString(), index.content), [params, index])
  const filter = useUnitFilter(index)
  const [picking, setPicking] = useState(false)
  const [view, setView] = useLineupView()
  const [selected, setSelected] = useState<string | null>(null)
  const [target, setTarget] = useState<Cell | null>(null)
  const [emblemPicking, setEmblemPicking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [posting, setPosting] = useState(false)
  const [pasting, setPasting] = useState<{ open: boolean; text: string; message: string }>({
    open: false,
    text: "",
    message: "",
  })
  const applyPasted = (text: string) => {
    const trimmed = text.trim()
    let query = trimmed.replace(/^\?/, "")
    try {
      query = new URL(trimmed).search
    } catch {
      // Not an address: the text is the lineup's query itself.
    }
    const next = decodeLineup(query, index.content)
    if (!next.units.length) {
      setPasting({
        open: true,
        text: trimmed,
        // `text` here is the pasted text, so the label helper is called by its full name.
        message: wikiText(
          locale,
          "Không đọc được đội hình từ nội dung này.",
          "No lineup could be read from this text.",
        ),
      })
      return
    }
    write(next.units, next.emblems)
    setPasting({
      open: false,
      text: "",
      message: wikiText(
        locale,
        `Đã dán ${next.units.length} quân.`,
        `Pasted ${next.units.length} ${next.units.length === 1 ? "unit" : "units"}.`,
      ),
    })
  }
  async function paste() {
    try {
      applyPasted(await navigator.clipboard.readText())
    } catch {
      setPasting({ open: true, text: "", message: "" })
    }
  }
  const chosen = new Set(units.map((unit) => unit.unitCode))
  const counts = traitCounts(
    index.content,
    units.map((unit) => unit.unitCode),
    emblems,
  )
  const suggestions = suggestUnits(index.content, [...chosen], emblems).slice(0, 6)
  const full = units.length >= MAX_LINEUP_UNITS

  function write(next: BuilderUnit[], nextEmblems = emblems) {
    setParams(
      (current) => {
        // The lineup replaces its own keys; the version, the open unit and the pool's filter stay.
        const result = new URLSearchParams(current)
        result.delete("u")
        result.delete("e")
        for (const [key, value] of new URLSearchParams(encodeLineup(next, nextEmblems))) result.set(key, value)
        return result
      },
      { replace: true, preventScrollReset: true },
    )
  }
  const { placed, bench } = placeUnits(units)
  // A unit picked in the sheet for an empty cell replaces the button that opened the sheet; once the sheet has closed,
  // keyboard focus moves to the new piece on that cell.
  const pieceToFocus = useRef<Cell | null>(null)
  useEffect(() => {
    const cell = pieceToFocus.current
    if (!cell || picking || !placed.has(`${cell.row}-${cell.column}`)) return
    pieceToFocus.current = null
    document
      .querySelector<HTMLElement>(
        `[data-slot="${BOARD_SLOT}"] .wiki-guide-board-cell[data-cell="${cell.row}-${cell.column}"] .wiki-guide-board-piece`,
      )
      ?.focus()
  })
  /** Adds a unit, onto the cell an empty-cell tap chose; removes it when already chosen. */
  const toggleUnit = (code: string) => {
    if (chosen.has(code)) {
      if (selected === code) setSelected(null)
      write(units.filter((unit) => unit.unitCode !== code))
      return
    }
    if (full) return
    const cell = target && !placed.has(`${target.row}-${target.column}`) ? target : null
    write([...units, cell ? { unitCode: code, carry: false, ...cell } : { unitCode: code, carry: false }])
    if (cell) {
      if (compact) pieceToFocus.current = cell
      setTarget(null)
      setPicking(false)
    }
  }
  /** A unit moved onto a cell, or off the board with no cell; whoever stood there takes the mover's old place. */
  const moveTo = (code: string, cell: Cell | null) => {
    const mover = units.find((unit) => unit.unitCode === code)
    if (!mover) return
    const occupant = cell ? placed.get(`${cell.row}-${cell.column}`) : undefined
    const at = (unit: BuilderUnit, next: { row?: BoardRow | null; column?: number | null } | null): BuilderUnit =>
      next?.row && next.column
        ? { unitCode: unit.unitCode, carry: unit.carry, row: next.row, column: next.column }
        : { unitCode: unit.unitCode, carry: unit.carry }
    write(
      units.map((unit) =>
        unit === mover ? at(unit, cell) : unit === occupant && occupant !== mover ? at(unit, mover) : unit,
      ),
    )
    setSelected(null)
  }
  /** A unit dragged onto a cell: one in the lineup moves there; a new one joins on it and sends whoever stood there to the bench. */
  const placeAt = (code: string, row: BoardRow, column: number) => {
    if (chosen.has(code)) return moveTo(code, { row, column })
    if (full) return
    const occupant = placed.get(`${row}-${column}`)
    write([
      ...units.map((unit) => (unit === occupant ? { unitCode: unit.unitCode, carry: unit.carry } : unit)),
      { unitCode: code, carry: false, row, column },
    ])
    setTarget(null)
  }
  const toggleCarry = (item: BuilderUnit) =>
    write(units.map((unit) => (unit === item ? { ...unit, carry: !unit.carry } : unit)))
  /** On wide screens the pool waits under the board: bring it into view and move keyboard focus to its first unit. */
  const focusPool = () => {
    const pool = document.getElementById("wiki-guide-builder-pool")
    pool?.querySelector<HTMLElement>(".wiki-guide-builder-pool-unit:not(:disabled)")?.focus({ preventScroll: true })
    pool?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }
  /** An empty cell chooses where the next unit goes: the pool under the board on wide screens, a sheet on phones. */
  const chooseCell = (cell: Cell) => {
    setTarget(cell)
    if (compact) setPicking(true)
    else focusPool()
  }
  const selectedUnit = selected ? units.find((unit) => unit.unitCode === selected) : undefined
  const selectedInfo = selectedUnit ? index.units.get(selectedUnit.unitCode) : undefined

  async function copyLink() {
    // The shared lineup keeps the version it was built on, not the pool filter or the open unit.
    const link = new URL(window.location.href)
    for (const key of [...UNIT_FILTER_KEYS, "unit"]) link.searchParams.delete(key)
    await navigator.clipboard?.writeText(link.toString())
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return {
    units,
    emblems,
    filter,
    picking,
    setPicking,
    view,
    setView,
    selected,
    setSelected,
    target,
    setTarget,
    emblemPicking,
    setEmblemPicking,
    copied,
    setCopied,
    posting,
    setPosting,
    pasting,
    setPasting,
    applyPasted,
    paste,
    chosen,
    counts,
    suggestions,
    full,
    write,
    placed,
    bench,
    toggleUnit,
    moveTo,
    placeAt,
    toggleCarry,
    focusPool,
    chooseCell,
    selectedUnit,
    selectedInfo,
    copyLink,
  }
}
