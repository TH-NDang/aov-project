import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText, useWikiText } from "../../context/wiki-context"
import { signIn, useWikiSession } from "../../lib/wiki-auth"
import {
  BOARD_SLOTS,
  cellOf,
  decodeLineup,
  encodeLineup,
  MAX_EMBLEMS,
  MAX_LINEUP_UNITS,
  ROW_NAMES,
  suggestUnits,
  traitCounts,
  type BoardRow,
  type BuilderUnit,
} from "./auto-chess-model"
import { BoardGrid, BoardPiece, dragUnit, LineupViewSwitch, placeUnits, useLineupView } from "./lineup-board"
import { UNIT_FILTER_KEYS, UnitFilters, useUnitFilter } from "./guide-filters"
import { costStyle, TraitIcon, UnitPortrait, type GuideIndex } from "./guide-ui"
import { ModeDialog, ModeHeading } from "./mode-ui"
import { deleteLineup, lineupErrorMessage, modeKeys, myStateQuery, saveLineup } from "./mode-api"

type Cell = { row: BoardRow; column: number }

/** Marks the board being built, so its cells are found by their place and not by labels in the reader's language. */
const BOARD_SLOT = "builder-board"

/**
 * The lineup builder: the board is the screen's main thing, with what the lineup turns on beside it. On wide screens
 * every unit waits under the board, to tap or drag onto a cell; phones pick units in a bottom sheet. The lineup lives
 * in the address, so it can be shared as a link.
 */
export function BuilderTab({
  code,
  index,
  onOpen,
}: {
  code: string
  index: GuideIndex
  onOpen: (code: string) => void
}) {
  const compact = usePageLayout() === "compact"
  const { locale } = useWikiContext()
  const text = useWikiText()
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
        `[data-slot="${BOARD_SLOT}"] .board-cell[data-cell="${cell.row}-${cell.column}"] .board-piece`,
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
    const pool = document.getElementById("builder-pool")
    pool?.querySelector<HTMLElement>(".builder-pool-unit:not(:disabled)")?.focus({ preventScroll: true })
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

  const pool = (
    <div className="builder-pool" id="builder-pool">
      {filter.units.map((unit) => (
        <button
          key={unit.code}
          type="button"
          className="builder-pool-unit"
          aria-pressed={chosen.has(unit.code)}
          style={costStyle(unit.cost)}
          title={unit.traitCodes.map((code) => index.traits.get(code)?.name).join(" · ")}
          draggable={!compact || undefined}
          onDragStart={compact ? undefined : dragUnit(unit.code)}
          onClick={() => toggleUnit(unit.code)}
          disabled={!chosen.has(unit.code) && full}
        >
          <UnitPortrait unit={unit} index={index} size="sm" />
          <span>{unit.name}</span>
        </button>
      ))}
      {!filter.units.length && (
        <p className="mode-meta">
          {text(
            "Không có quân cờ phù hợp. Thử tên khác hoặc bỏ bớt lọc.",
            "No piece fits. Try another name or remove a filter.",
          )}
        </p>
      )}
    </div>
  )

  const slotAt = (slot: number) => {
    const item = units[slot]
    const unit = item ? index.units.get(item.unitCode) : undefined
    if (!item || !unit)
      return (
        <button
          key={slot}
          type="button"
          className="builder-slot builder-slot-empty"
          data-extra={slot >= BOARD_SLOTS || undefined}
          aria-label={
            slot >= BOARD_SLOTS
              ? text("Thêm quân vào ô thêm", "Add a unit to the extra slot")
              : text("Thêm quân cờ", "Add a unit")
          }
          onClick={() => (compact ? setPicking(true) : focusPool())}
        >
          <span className="builder-slot-plus" aria-hidden="true">
            +
          </span>
          <span>{slot >= BOARD_SLOTS ? text("Ô thêm", "Extra slot") : text("Thêm quân", "Add unit")}</span>
        </button>
      )
    return (
      <div
        key={item.unitCode}
        className="builder-slot"
        data-extra={slot >= BOARD_SLOTS || undefined}
        style={costStyle(unit.cost)}
      >
        <button
          type="button"
          className="builder-slot-portrait"
          title={text(`Xem ${unit.name}`, `View ${unit.name}`)}
          onClick={() => onOpen(unit.code)}
        >
          <UnitPortrait unit={unit} index={index} size="sm" />
        </button>
        <strong>{unit.name}</strong>
        <span className="builder-actions">
          <button
            type="button"
            aria-pressed={item.carry}
            aria-label={text(`${unit.name} là chủ lực`, `${unit.name} is a carry`)}
            title={text("Chủ lực (M)", "Carry (M)")}
            className="carry-toggle"
            onClick={() => toggleCarry(item)}
          >
            M
          </button>
          <button
            type="button"
            onClick={() => toggleUnit(unit.code)}
            aria-label={text(`Bỏ ${unit.name}`, `Remove ${unit.name}`)}
            title={text("Bỏ khỏi đội hình", "Remove from the lineup")}
          >
            <WikiIcon name="close" size={14} />
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="guide-tab-body">
      <div className="builder">
        <div className="builder-main">
          <section className="builder-card" aria-label={text("Đội hình đang xếp", "Lineup being built")}>
            <header className="builder-card-head">
              <span className="builder-count">
                {text("Đội hình", "Lineup")}{" "}
                <b>
                  {Math.min(units.length, BOARD_SLOTS)}/{BOARD_SLOTS}
                </b>
                {units.length > BOARD_SLOTS ? text(" + ô thêm", " + extra slot") : ""}
              </span>
              <span className="builder-tools">
                <LineupViewSwitch view={view} onChange={setView} />
                {compact && (
                  <button
                    type="button"
                    className="lineup-icon-button"
                    aria-label={text("Thêm quân cờ", "Add a unit")}
                    title={text("Thêm quân cờ", "Add a unit")}
                    disabled={full}
                    onClick={() => setPicking(true)}
                  >
                    <WikiIcon name="plus" size={18} />
                  </button>
                )}
                <button
                  type="button"
                  className="lineup-icon-button"
                  aria-label={
                    copied
                      ? text("Đã chép đường dẫn", "Link copied")
                      : text("Chép đường dẫn chia sẻ", "Copy share link")
                  }
                  title={
                    copied
                      ? text("Đã chép đường dẫn", "Link copied")
                      : text("Chép đường dẫn chia sẻ", "Copy share link")
                  }
                  data-done={copied || undefined}
                  disabled={!units.length}
                  onClick={() => void copyLink()}
                >
                  <WikiIcon name={copied ? "check" : "share"} size={18} />
                </button>
                <button
                  type="button"
                  className="lineup-icon-button"
                  aria-label={text("Dán đội hình đã sao chép", "Paste a copied lineup")}
                  title={text("Dán đội hình đã sao chép", "Paste a copied lineup")}
                  onClick={() => void paste()}
                >
                  <WikiIcon name="clipboard" size={18} />
                </button>
                <button
                  type="button"
                  className="lineup-icon-button"
                  data-tone="danger"
                  aria-label={text("Xóa hết", "Clear all")}
                  title={text("Xóa hết", "Clear all")}
                  disabled={!units.length}
                  onClick={() => {
                    setSelected(null)
                    write([], [])
                  }}
                >
                  <WikiIcon name="broom" size={18} />
                </button>
                {!compact && (
                  <button type="button" className="guide-primary" onClick={() => setPosting(true)}>
                    {text("Đăng đội hình", "Post a lineup")}
                  </button>
                )}
              </span>
            </header>
            {view === "board" ? (
              <BoardGrid
                label={text("Bàn cờ đang xếp", "Board being built")}
                slot={BOARD_SLOT}
                onDropUnit={compact ? undefined : placeAt}
                cell={(row, column) => {
                  const item = placed.get(`${row}-${column}`)
                  if (item)
                    return (
                      <BoardPiece
                        item={item}
                        index={index}
                        selected={selected === item.unitCode}
                        draggable={!compact}
                        onClick={() =>
                          selected && selected !== item.unitCode
                            ? moveTo(selected, { row, column })
                            : setSelected(selected === item.unitCode ? null : item.unitCode)
                        }
                      />
                    )
                  const targeted = target?.row === row && target.column === column
                  return (
                    <button
                      type="button"
                      className="board-empty"
                      data-target={selected || targeted ? true : undefined}
                      aria-pressed={targeted || undefined}
                      aria-label={
                        selected
                          ? text(
                              `Đặt vào ${ROW_NAMES[row][0]}, ô ${column}`,
                              `Place in the ${ROW_NAMES[row][1].toLowerCase()}, cell ${column}`,
                            )
                          : text(
                              `Thêm quân vào ${ROW_NAMES[row][0]}, ô ${column}`,
                              `Add a unit to the ${ROW_NAMES[row][1].toLowerCase()}, cell ${column}`,
                            )
                      }
                      disabled={!selected && full}
                      onClick={() => (selected ? moveTo(selected, { row, column }) : chooseCell({ row, column }))}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  )
                }}
                footer={
                  <>
                    {bench.length > 0 && (
                      <div className="board-bench" aria-label={text("Chưa xếp chỗ", "Not placed yet")}>
                        <span className="mode-meta">{text("Chưa xếp chỗ", "Not placed yet")}</span>
                        {bench.map((item) => (
                          <BoardPiece
                            key={item.unitCode}
                            item={item}
                            index={index}
                            selected={selected === item.unitCode}
                            draggable={!compact}
                            onClick={() => setSelected(selected === item.unitCode ? null : item.unitCode)}
                          />
                        ))}
                      </div>
                    )}
                    {selectedUnit && selectedInfo && (
                      <div
                        className="board-selected"
                        aria-label={text(`Đang chọn ${selectedInfo.name}`, `${selectedInfo.name} selected`)}
                      >
                        <span>
                          <strong>{selectedInfo.name}</strong>
                          <small>{text("Bấm một ô để chuyển tới đó", "Tap a square to move it there")}</small>
                        </span>
                        <span className="builder-actions">
                          <button
                            type="button"
                            aria-pressed={selectedUnit.carry}
                            className="carry-toggle"
                            title={text("Chủ lực (M)", "Carry (M)")}
                            aria-label={text(`${selectedInfo.name} là chủ lực`, `${selectedInfo.name} is a carry`)}
                            onClick={() => toggleCarry(selectedUnit)}
                          >
                            M
                          </button>
                          <button
                            type="button"
                            title={text(`Xem ${selectedInfo.name}`, `View ${selectedInfo.name}`)}
                            aria-label={text(`Xem ${selectedInfo.name}`, `View ${selectedInfo.name}`)}
                            onClick={() => onOpen(selectedInfo.code)}
                          >
                            <WikiIcon name="info" size={16} />
                          </button>
                          {cellOf(selectedUnit) && (
                            <button
                              type="button"
                              title={text("Đưa xuống hàng chờ", "Move to the bench")}
                              aria-label={text("Đưa xuống hàng chờ", "Move to the bench")}
                              onClick={() => moveTo(selectedUnit.unitCode, null)}
                            >
                              <WikiIcon name="chevron" size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            title={text("Bỏ khỏi đội hình", "Remove from the lineup")}
                            aria-label={text(`Bỏ ${selectedInfo.name}`, `Remove ${selectedInfo.name}`)}
                            onClick={() => toggleUnit(selectedUnit.unitCode)}
                          >
                            <WikiIcon name="close" size={16} />
                          </button>
                        </span>
                      </div>
                    )}
                  </>
                }
              />
            ) : (
              <>
                <div className="builder-slots">{Array.from({ length: BOARD_SLOTS }, (_, slot) => slotAt(slot))}</div>
                {/* An item opens one more slot; it stays apart so the board reads as the game's ten. */}
                <div className="builder-extra">
                  {slotAt(BOARD_SLOTS)}
                  <p className="mode-meta">
                    <b>{text("Ô thêm", "Extra slot")}</b>
                    {text(
                      ` · cho quân thứ ${BOARD_SLOTS + 1} khi có trang bị mở thêm ô.`,
                      ` · for unit number ${BOARD_SLOTS + 1}, when an item opens one more slot.`,
                    )}
                  </p>
                </div>
              </>
            )}
            {/* Emblems come from blessings such as the heart ones: each adds one to a faction or class without a unit. */}
            <div className="builder-emblems">
              <div className="builder-emblems-head">
                <span className="builder-count">
                  {text("Huy hiệu", "Emblems")}{" "}
                  <b>
                    {emblems.length}/{MAX_EMBLEMS}
                  </b>
                </span>
                <span className="mode-meta">
                  {text(
                    "+1 vào một Phe/Nghề, như khi có chúc phúc “Trái tim…”",
                    "+1 to a Faction/Class, as with a “Trái tim…” blessing",
                  )}
                </span>
                <button
                  type="button"
                  className="lineup-icon-button"
                  aria-label={text("Thêm huy hiệu", "Add an emblem")}
                  title={text("Thêm huy hiệu", "Add an emblem")}
                  disabled={emblems.length >= MAX_EMBLEMS}
                  onClick={() => setEmblemPicking(true)}
                >
                  <WikiIcon name="plus" size={18} />
                </button>
              </div>
              {emblems.length > 0 && (
                <div className="guide-trait-tags">
                  {emblems.map((emblem, at) => {
                    const trait = index.traits.get(emblem)
                    return (
                      <button
                        key={`${emblem}-${at}`}
                        type="button"
                        className="guide-trait-tag"
                        aria-label={text(
                          `Bỏ huy hiệu ${trait?.name ?? emblem}`,
                          `Remove emblem ${trait?.name ?? emblem}`,
                        )}
                        title={text("Bỏ huy hiệu", "Remove emblem")}
                        onClick={() =>
                          write(
                            units,
                            emblems.filter((_, other) => other !== at),
                          )
                        }
                      >
                        <TraitIcon trait={trait} index={index} size={18} />
                        <b>+1</b>
                        {trait?.name ?? emblem}
                        <WikiIcon name="close" size={12} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {pasting.open && (
              <form
                className="builder-paste"
                onSubmit={(event) => {
                  event.preventDefault()
                  applyPasted(pasting.text)
                }}
              >
                <input
                  className="guide-field"
                  autoFocus
                  value={pasting.text}
                  placeholder={text("Dán đường dẫn hoặc mã đội hình…", "Paste a lineup link or code…")}
                  aria-label={text("Đội hình đã sao chép", "Copied lineup")}
                  onChange={(event) => setPasting({ ...pasting, text: event.target.value })}
                />
                <button type="submit" className="guide-primary" disabled={!pasting.text.trim()}>
                  {text("Dùng", "Use")}
                </button>
                <button
                  type="button"
                  className="mode-chip"
                  onClick={() => setPasting({ open: false, text: "", message: "" })}
                >
                  {text("Hủy", "Cancel")}
                </button>
              </form>
            )}
            {pasting.message && (
              <p className="mode-meta" role="status">
                {pasting.message}
              </p>
            )}
          </section>
          {compact && (
            <button type="button" className="guide-primary builder-post" onClick={() => setPosting(true)}>
              {text("Đăng đội hình", "Post a lineup")}
            </button>
          )}

          {!compact && (
            <section className="mode-section" aria-labelledby="builder-pool-title">
              <ModeHeading
                id="builder-pool-title"
                title={text("Quân cờ", "Units")}
                count={filter.units.length}
                note={
                  target
                    ? text(
                        `Chọn quân cho ${ROW_NAMES[target.row][0].toLowerCase()}, ô ${target.column}.`,
                        `Choose a unit for the ${ROW_NAMES[target.row][1].toLowerCase()}, cell ${target.column}.`,
                      )
                    : "Bấm để thêm vào đội hình, hoặc kéo thả lên một ô của bàn cờ."
                }
                action={
                  target ? (
                    <button type="button" className="guide-clear" onClick={() => setTarget(null)}>
                      {text("Bỏ chọn ô", "Deselect the square")}
                    </button>
                  ) : undefined
                }
              />
              <UnitFilters index={index} filter={filter} />
              {pool}
            </section>
          )}
        </div>

        <aside className="builder-side">
          <section className="mode-section" aria-labelledby="builder-traits">
            <ModeHeading
              id="builder-traits"
              title={text("Phe & Nghề", "Factions & Classes")}
              count={counts.length || undefined}
            />
            {counts.length ? (
              <ul className="builder-traits">
                {counts.map((count) => (
                  <li key={count.trait.code} className="builder-trait" data-active={count.reachedTier >= 0}>
                    <TraitIcon trait={count.trait} index={index} size={28} />
                    <div>
                      <strong>
                        <b>{count.count}</b> {count.trait.name}
                      </strong>
                      <p>
                        {count.reachedTier >= 0
                          ? count.trait.tiers[count.reachedTier]?.effect
                          : text(`Cần thêm ${count.missing} để kích hoạt`, `Needs ${count.missing} more to activate`)}
                      </p>
                    </div>
                    <span className="builder-steps" aria-label={text("Các mốc", "Thresholds")}>
                      {count.trait.tiers.map((tier, at) => (
                        <i key={tier.count} data-on={at <= count.reachedTier}>
                          {tier.count}
                        </i>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mode-meta">
                {text(
                  "Chọn quân cờ để xem Phe và Nghề nào được kích hoạt.",
                  "Choose pieces to see which factions and classes they activate.",
                )}
              </p>
            )}
          </section>
          {suggestions.length > 0 && (
            <section className="mode-section" aria-labelledby="builder-suggestions">
              <ModeHeading id="builder-suggestions" title={text("Gợi ý thêm", "Suggested additions")} />
              <div className="builder-suggestions">
                {suggestions.map(({ unit, gains, shared }) => (
                  <button
                    key={unit.code}
                    type="button"
                    className="builder-suggestion"
                    style={costStyle(unit.cost)}
                    onClick={() => toggleUnit(unit.code)}
                    disabled={full}
                  >
                    <UnitPortrait unit={unit} index={index} size="sm" />
                    <span>
                      <strong>{unit.name}</strong>
                      <small>
                        {gains.length
                          ? `${text("Mở mốc", "Unlocks a tier")}: ${gains.map((code) => index.traits.get(code)?.name).join(", ")}`
                          : `${text("Cùng", "Shares")} ${shared.map((code) => index.traits.get(code)?.name).join(", ")}`}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
      <ModeDialog
        open={compact && picking}
        onClose={() => {
          setPicking(false)
          setTarget(null)
        }}
        label={text("Chọn quân cờ", "Choose a unit")}
        title={
          target
            ? text(
                `Chọn quân cho ${ROW_NAMES[target.row][0].toLowerCase()}, ô ${target.column}`,
                `Choose a unit for the ${ROW_NAMES[target.row][1].toLowerCase()}, cell ${target.column}`,
              )
            : text("Chọn quân cờ", "Choose a unit")
        }
      >
        <div className="unit-picker">
          <UnitFilters index={index} filter={filter} inline />
          {pool}
        </div>
      </ModeDialog>
      <ModeDialog
        open={emblemPicking}
        onClose={() => setEmblemPicking(false)}
        label={text("Chọn huy hiệu", "Choose emblems")}
        title={`${text("Chọn huy hiệu", "Choose emblems")} · ${emblems.length}/${MAX_EMBLEMS}`}
      >
        <div className="trait-index">
          <p className="mode-meta">
            {text(
              "Mỗi huy hiệu cộng 1 vào Phe/Nghề đó; có thể chọn cùng một Phe/Nghề nhiều lần.",
              "Each emblem adds 1 to that Faction/Class; the same Faction/Class can be chosen more than once.",
            )}
          </p>
          {(["FACTION", "CLASS"] as const).map((kind) => (
            <section key={kind} className="mode-section" aria-labelledby={`emblem-kind-${kind}`}>
              <ModeHeading
                id={`emblem-kind-${kind}`}
                title={kind === "FACTION" ? text("Phe", "Faction") : text("Nghề", "Class")}
              />
              <div className="trait-index-grid">
                {index.content.traits
                  .filter((trait) => trait.kind === kind)
                  .map((trait) => {
                    const taken = emblems.filter((code) => code === trait.code).length
                    return (
                      <button
                        key={trait.code}
                        type="button"
                        className="trait-index-item"
                        aria-pressed={taken > 0}
                        disabled={emblems.length >= MAX_EMBLEMS}
                        onClick={() => write(units, [...emblems, trait.code])}
                      >
                        <TraitIcon trait={trait} index={index} size={40} />
                        <span>
                          <strong>{trait.name}</strong>
                          {taken > 0 && <small>+{taken}</small>}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </section>
          ))}
        </div>
      </ModeDialog>
      <ModeDialog
        open={posting}
        onClose={() => setPosting(false)}
        label={text("Đăng đội hình", "Post a lineup")}
        title={text("Đăng đội hình", "Post a lineup")}
      >
        <SaveLineup code={code} units={units} emblems={emblems} index={index} />
      </ModeDialog>
    </div>
  )
}

/** Name and note for the lineup, then the reader's own lineups; a signed-out reader is asked to sign in first. */
function SaveLineup({
  code,
  units,
  emblems,
  index,
}: {
  code: string
  units: BuilderUnit[]
  emblems: string[]
  index: GuideIndex
}) {
  const { href, locale } = useWikiContext()
  const text = useWikiText()
  const session = useWikiSession()
  const client = useQueryClient()
  const me = useQuery({ ...myStateQuery(code, session.revision), enabled: session.status === "authenticated" })
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")
  const refresh = () => client.invalidateQueries({ queryKey: modeKeys.mode(code) })
  const save = useMutation({
    mutationFn: () =>
      saveLineup(code, {
        name: name.trim(),
        note: note.trim() || undefined,
        units: units.map((unit) => ({ ...unit, itemCodes: [] })),
        emblems,
      }),
    onSuccess: () => {
      setMessage(text("Đã lưu và chia sẻ đội hình.", "Lineup saved and shared."))
      setName("")
      setNote("")
      void refresh()
    },
    onError: (error) => setMessage(lineupErrorMessage(error, locale)),
  })
  const remove = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deleteLineup(code, id, version),
    onSuccess: () => void refresh(),
    onError: (error) => setMessage(lineupErrorMessage(error, locale)),
  })
  const members = units.map((unit) => index.units.get(unit.unitCode)?.name).filter(Boolean)

  if (session.status !== "authenticated")
    return (
      <div className="lineup-post">
        <p className="mode-prose">
          {text(
            "Đăng nhập để lưu đội hình, chia sẻ với cộng đồng và nhận lượt thích.",
            "Sign in to save lineups, share them with the community and get likes.",
          )}
        </p>
        <button type="button" className="guide-primary" onClick={() => void signIn()}>
          {text("Đăng nhập", "Sign in")}
        </button>
      </div>
    )

  return (
    <div className="lineup-post">
      <p className="mode-meta">
        {members.length
          ? text(
              `${members.length} quân: ${members.join(", ")}`,
              `${members.length} ${members.length === 1 ? "unit" : "units"}: ${members.join(", ")}`,
            )
          : "Đội hình chưa có quân cờ nào."}
      </p>
      <form
        className="builder-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim() && units.length) save.mutate()
        }}
      >
        <label>
          <span>{text("Tên đội hình", "Lineup name")}</span>
          <input
            className="guide-field"
            value={name}
            maxLength={60}
            placeholder={text("Ví dụ: Pháp sư lãng khách", "For example: Wandering mages")}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>{text("Ghi chú lối chơi (tùy chọn)", "Gameplay notes (optional)")}</span>
          <textarea
            className="guide-field"
            value={note}
            maxLength={280}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button type="submit" className="guide-primary" disabled={!name.trim() || !units.length || save.isPending}>
          {save.isPending ? text("Đang lưu…", "Saving…") : text("Lưu và chia sẻ", "Save and share")}
        </button>
        {message && (
          <p className="mode-message" role="status">
            {message}
          </p>
        )}
      </form>
      {me.data && me.data.lineups.length > 0 && (
        <section className="guide-detail-block" aria-labelledby="my-lineups">
          <h3 id="my-lineups">{text("Đội hình của tôi", "My lineups")}</h3>
          <ul className="my-lineups">
            {me.data.lineups.map((lineup) => (
              <li key={lineup.id}>
                <Link
                  to={href(
                    `/modes/${encodeURIComponent(code)}/xep-doi-hinh?${encodeLineup(lineup.units, lineup.emblems)}`,
                  )}
                >
                  {lineup.name}
                </Link>
                <span className="mode-meta">
                  ♥ {lineup.likes}
                  {lineup.status === "HIDDEN" && text(" · đã bị ẩn", " · hidden")}
                </span>
                <button
                  type="button"
                  className="mode-chip"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: lineup.id, version: lineup.version })}
                >
                  {text("Xóa", "Delete")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
