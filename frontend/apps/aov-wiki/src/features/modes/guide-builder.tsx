import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiText } from "../../context/wiki-context"
import { BOARD_SLOTS, cellOf, ROW_NAMES } from "./auto-chess-model"
import { BuilderEmblems, BuilderPool, BuilderSlot, BuilderTraits, EmblemDialog, PasteLineup } from "./builder-parts"
import { SaveLineup } from "./builder-save"
import { BoardGrid, BoardPiece, LineupViewSwitch } from "./lineup-board"
import { UnitFilters } from "./guide-filters"
import type { GuideIndex } from "./guide-ui"
import { ModeDialog, ModeHeading } from "./mode-ui"
import { BOARD_SLOT, useLineupBuilder } from "./use-lineup-builder"
import "./guide-builder.css"

type Builder = ReturnType<typeof useLineupBuilder>

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
  const text = useWikiText()
  const builder = useLineupBuilder(index, compact)
  const {
    units,
    emblems,
    filter,
    picking,
    setPicking,
    view,
    target,
    setTarget,
    emblemPicking,
    setEmblemPicking,
    posting,
    setPosting,
    pasting,
    setPasting,
    applyPasted,
    chosen,
    counts,
    suggestions,
    full,
    write,
    toggleUnit,
  } = builder

  const pool = (
    <BuilderPool
      units={filter.units}
      chosen={chosen}
      full={full}
      compact={compact}
      index={index}
      onToggle={toggleUnit}
    />
  )

  return (
    <div className="wiki-guide-tab-body">
      <div className="wiki-guide-builder">
        <div className="wiki-guide-builder-main">
          <section className="wiki-guide-builder-card" aria-label={text("Đội hình đang xếp", "Lineup being built")}>
            <BuilderToolbar builder={builder} compact={compact} />
            {view === "board" ? (
              <BuilderBoard builder={builder} index={index} compact={compact} onOpen={onOpen} />
            ) : (
              <BuilderSlots builder={builder} index={index} compact={compact} onOpen={onOpen} />
            )}
            <BuilderEmblems
              emblems={emblems}
              index={index}
              onAdd={() => setEmblemPicking(true)}
              onRemove={(at) =>
                write(
                  units,
                  emblems.filter((_, other) => other !== at),
                )
              }
            />
            {pasting.open && (
              <PasteLineup
                value={pasting.text}
                onChange={(value) => setPasting({ ...pasting, text: value })}
                onUse={() => applyPasted(pasting.text)}
                onCancel={() => setPasting({ open: false, text: "", message: "" })}
              />
            )}
            {pasting.message && (
              <p className="wiki-mode-meta" role="status">
                {pasting.message}
              </p>
            )}
          </section>
          {compact && (
            <button
              type="button"
              className="wiki-guide-primary wiki-guide-builder-post"
              onClick={() => setPosting(true)}
            >
              {text("Đăng đội hình", "Post a lineup")}
            </button>
          )}

          {!compact && (
            <section className="wiki-mode-section" aria-labelledby="builder-pool-title">
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
                    : text(
                        "Bấm để thêm vào đội hình, hoặc kéo thả lên một ô của bàn cờ.",
                        "Tap to add a unit to the lineup, or drag it onto a cell of the board.",
                      )
                }
                action={
                  target ? (
                    <button type="button" className="wiki-guide-clear" onClick={() => setTarget(null)}>
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

        <BuilderTraits counts={counts} suggestions={suggestions} index={index} full={full} onAdd={toggleUnit} />
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
        <div className="wiki-guide-unit-picker">
          <UnitFilters index={index} filter={filter} inline />
          {pool}
        </div>
      </ModeDialog>
      <EmblemDialog
        open={emblemPicking}
        onClose={() => setEmblemPicking(false)}
        emblems={emblems}
        index={index}
        onAdd={(trait) => write(units, [...emblems, trait])}
      />
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

/** The card's head: how many units the lineup holds, the way to view it, and adding, sharing, pasting and clearing. */
function BuilderToolbar({ builder, compact }: { builder: Builder; compact: boolean }) {
  const text = useWikiText()
  const { units, view, setView, full, setPicking, copied, copyLink, paste, setSelected, write, setPosting } = builder
  return (
    <header className="wiki-guide-builder-card-head">
      <span className="wiki-guide-builder-count">
        {text("Đội hình", "Lineup")}{" "}
        <b>
          {Math.min(units.length, BOARD_SLOTS)}/{BOARD_SLOTS}
        </b>
        {units.length > BOARD_SLOTS ? text(" + ô thêm", " + extra slot") : ""}
      </span>
      <span className="wiki-guide-builder-tools">
        <LineupViewSwitch view={view} onChange={setView} />
        {compact && (
          <button
            type="button"
            className="wiki-guide-lineup-icon-button"
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
          className="wiki-guide-lineup-icon-button"
          aria-label={
            copied ? text("Đã chép đường dẫn", "Link copied") : text("Chép đường dẫn chia sẻ", "Copy share link")
          }
          title={copied ? text("Đã chép đường dẫn", "Link copied") : text("Chép đường dẫn chia sẻ", "Copy share link")}
          data-done={copied || undefined}
          disabled={!units.length}
          onClick={() => void copyLink()}
        >
          <WikiIcon name={copied ? "check" : "share"} size={18} />
        </button>
        <button
          type="button"
          className="wiki-guide-lineup-icon-button"
          aria-label={text("Dán đội hình đã sao chép", "Paste a copied lineup")}
          title={text("Dán đội hình đã sao chép", "Paste a copied lineup")}
          onClick={() => void paste()}
        >
          <WikiIcon name="clipboard" size={18} />
        </button>
        <button
          type="button"
          className="wiki-guide-lineup-icon-button"
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
          <button type="button" className="wiki-guide-primary" onClick={() => setPosting(true)}>
            {text("Đăng đội hình", "Post a lineup")}
          </button>
        )}
      </span>
    </header>
  )
}

type BuilderViewProps = { builder: Builder; index: GuideIndex; compact: boolean; onOpen: (code: string) => void }

/**
 * The board view: placed units on their cells and the empty cells to fill, then the units not placed yet and what can
 * be done with the selected one. On wide screens units are dragged between cells as well.
 */
function BuilderBoard({ builder, index, compact, onOpen }: BuilderViewProps) {
  const text = useWikiText()
  const { placed, bench, selected, setSelected, target, full, moveTo, placeAt, chooseCell } = builder
  return (
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
            className="wiki-guide-board-empty"
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
            <div className="wiki-guide-board-bench" aria-label={text("Chưa xếp chỗ", "Not placed yet")}>
              <span className="wiki-mode-meta">{text("Chưa xếp chỗ", "Not placed yet")}</span>
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
          <SelectedPiece builder={builder} onOpen={onOpen} />
        </>
      }
    />
  )
}

/** The selected unit's name and its actions: mark it as a carry, open it, send it to the bench or remove it. */
function SelectedPiece({ builder, onOpen }: { builder: Builder; onOpen: (code: string) => void }) {
  const text = useWikiText()
  const { selectedUnit, selectedInfo, toggleCarry, moveTo, toggleUnit } = builder
  if (!selectedUnit || !selectedInfo) return null
  return (
    <div
      className="wiki-guide-board-selected"
      aria-label={text(`Đang chọn ${selectedInfo.name}`, `${selectedInfo.name} selected`)}
    >
      <span>
        <strong>{selectedInfo.name}</strong>
        <small>{text("Bấm một ô để chuyển tới đó", "Tap a square to move it there")}</small>
      </span>
      <span className="wiki-guide-builder-actions">
        <button
          type="button"
          aria-pressed={selectedUnit.carry}
          className="wiki-guide-carry-toggle"
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
  )
}

/** The list view: the game's ten slots in a grid, and the one more slot an item opens, kept apart under them. */
function BuilderSlots({ builder, index, compact, onOpen }: BuilderViewProps) {
  const text = useWikiText()
  const { units, setPicking, focusPool, toggleUnit, toggleCarry } = builder
  const slotAt = (slot: number) => (
    <BuilderSlot
      key={units[slot]?.unitCode ?? slot}
      slot={slot}
      item={units[slot]}
      index={index}
      onAdd={() => (compact ? setPicking(true) : focusPool())}
      onOpen={onOpen}
      onToggle={toggleUnit}
      onToggleCarry={toggleCarry}
    />
  )
  return (
    <>
      <div className="wiki-guide-builder-slots">{Array.from({ length: BOARD_SLOTS }, (_, slot) => slotAt(slot))}</div>
      {/* An item opens one more slot; it stays apart so the board reads as the game's ten. */}
      <div className="wiki-guide-builder-extra">
        {slotAt(BOARD_SLOTS)}
        <p className="wiki-mode-meta">
          <b>{text("Ô thêm", "Extra slot")}</b>
          {text(
            ` · cho quân thứ ${BOARD_SLOTS + 1} khi có trang bị mở thêm ô.`,
            ` · for unit number ${BOARD_SLOTS + 1}, when an item opens one more slot.`,
          )}
        </p>
      </div>
    </>
  )
}
