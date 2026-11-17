import { useWikiText } from "../../context/wiki-context"
import { WikiIcon } from "../../components/wiki-icon"
import { BOARD_SLOTS, MAX_EMBLEMS, suggestUnits, traitCounts, type BuilderUnit, type Unit } from "./auto-chess-model"
import { dragUnit } from "./lineup-board"
import { costStyle, TraitIcon, UnitPortrait, type GuideIndex } from "./guide-ui"
import { ModeDialog, ModeHeading } from "./mode-ui"

type TraitCount = ReturnType<typeof traitCounts>[number]
type Suggestion = ReturnType<typeof suggestUnits>[number]

/** What the lineup turns on, Faction and Class by Faction and Class, and the units that would add most to it. */
export function BuilderTraits({
  counts,
  suggestions,
  index,
  full,
  onAdd,
}: {
  counts: TraitCount[]
  suggestions: Suggestion[]
  index: GuideIndex
  full: boolean
  onAdd: (unitCode: string) => void
}) {
  const text = useWikiText()
  return (
    <aside className="wiki-guide-builder-side">
      <section className="wiki-mode-section" aria-labelledby="wiki-guide-builder-traits">
        <ModeHeading
          id="wiki-guide-builder-traits"
          title={text("Phe & Nghề", "Factions & Classes")}
          count={counts.length || undefined}
        />
        {counts.length ? (
          <ul className="wiki-guide-builder-traits">
            {counts.map((count) => (
              <li key={count.trait.code} className="wiki-guide-builder-trait" data-active={count.reachedTier >= 0}>
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
                <span className="wiki-guide-builder-steps" aria-label={text("Các mốc", "Thresholds")}>
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
          <p className="wiki-mode-meta">
            {text(
              "Chọn quân cờ để xem Phe và Nghề nào được kích hoạt.",
              "Choose pieces to see which factions and classes they activate.",
            )}
          </p>
        )}
      </section>
      {suggestions.length > 0 && (
        <section className="wiki-mode-section" aria-labelledby="wiki-guide-builder-suggestions">
          <ModeHeading id="wiki-guide-builder-suggestions" title={text("Gợi ý thêm", "Suggested additions")} />
          <div className="wiki-guide-builder-suggestions">
            {suggestions.map(({ unit, gains, shared }) => (
              <button
                key={unit.code}
                type="button"
                className="wiki-guide-builder-suggestion"
                style={costStyle(unit.cost)}
                onClick={() => onAdd(unit.code)}
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
  )
}

/** The sheet that adds emblems, each one more to a Faction or Class, up to the game's limit. */
export function EmblemDialog({
  open,
  onClose,
  emblems,
  index,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  emblems: string[]
  index: GuideIndex
  onAdd: (traitCode: string) => void
}) {
  const text = useWikiText()
  return (
    <ModeDialog
      open={open}
      onClose={onClose}
      label={text("Chọn huy hiệu", "Choose emblems")}
      title={`${text("Chọn huy hiệu", "Choose emblems")} · ${emblems.length}/${MAX_EMBLEMS}`}
    >
      <div className="wiki-guide-trait-index">
        <p className="wiki-mode-meta">
          {text(
            "Mỗi huy hiệu cộng 1 vào Phe/Nghề đó; có thể chọn cùng một Phe/Nghề nhiều lần.",
            "Each emblem adds 1 to that Faction/Class; the same Faction/Class can be chosen more than once.",
          )}
        </p>
        {(["FACTION", "CLASS"] as const).map((kind) => (
          <section key={kind} className="wiki-mode-section" aria-labelledby={`emblem-kind-${kind}`}>
            <ModeHeading
              id={`emblem-kind-${kind}`}
              title={kind === "FACTION" ? text("Phe", "Faction") : text("Nghề", "Class")}
            />
            <div className="wiki-guide-trait-index-grid">
              {index.content.traits
                .filter((trait) => trait.kind === kind)
                .map((trait) => {
                  const taken = emblems.filter((code) => code === trait.code).length
                  return (
                    <button
                      key={trait.code}
                      type="button"
                      className="wiki-guide-trait-index-item"
                      aria-pressed={taken > 0}
                      disabled={emblems.length >= MAX_EMBLEMS}
                      onClick={() => onAdd(trait.code)}
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
  )
}

/** Every unit the filter lets through, to tap or, on wide screens, drag onto the board. */
export function BuilderPool({
  units,
  chosen,
  full,
  compact,
  index,
  onToggle,
}: {
  units: Unit[]
  chosen: Set<string>
  full: boolean
  compact: boolean
  index: GuideIndex
  onToggle: (unitCode: string) => void
}) {
  const text = useWikiText()
  return (
    <div className="wiki-guide-builder-pool" id="wiki-guide-builder-pool">
      {units.map((unit) => (
        <button
          key={unit.code}
          type="button"
          className="wiki-guide-builder-pool-unit"
          aria-pressed={chosen.has(unit.code)}
          style={costStyle(unit.cost)}
          title={unit.traitCodes.map((code) => index.traits.get(code)?.name).join(" · ")}
          draggable={!compact || undefined}
          onDragStart={compact ? undefined : dragUnit(unit.code)}
          onClick={() => onToggle(unit.code)}
          disabled={!chosen.has(unit.code) && full}
        >
          <UnitPortrait unit={unit} index={index} size="sm" />
          <span>{unit.name}</span>
        </button>
      ))}
      {!units.length && (
        <p className="wiki-mode-meta">
          {text(
            "Không có quân cờ phù hợp. Thử tên khác hoặc bỏ bớt lọc.",
            "No piece fits. Try another name or remove a filter.",
          )}
        </p>
      )}
    </div>
  )
}

/** One of the lineup's slots: the unit with its carry mark and remove button, or a button that adds one. */
export function BuilderSlot({
  slot,
  item,
  index,
  onAdd,
  onOpen,
  onToggle,
  onToggleCarry,
}: {
  slot: number
  item: BuilderUnit | undefined
  index: GuideIndex
  onAdd: () => void
  onOpen: (unitCode: string) => void
  onToggle: (unitCode: string) => void
  onToggleCarry: (item: BuilderUnit) => void
}) {
  const text = useWikiText()
  const unit = item ? index.units.get(item.unitCode) : undefined
  if (!item || !unit)
    return (
      <button
        type="button"
        className="wiki-guide-builder-slot wiki-guide-builder-slot-empty"
        data-extra={slot >= BOARD_SLOTS || undefined}
        aria-label={
          slot >= BOARD_SLOTS
            ? text("Thêm quân vào ô thêm", "Add a unit to the extra slot")
            : text("Thêm quân cờ", "Add a unit")
        }
        onClick={onAdd}
      >
        <span className="wiki-guide-builder-slot-plus" aria-hidden="true">
          +
        </span>
        <span>{slot >= BOARD_SLOTS ? text("Ô thêm", "Extra slot") : text("Thêm quân", "Add unit")}</span>
      </button>
    )
  return (
    <div className="wiki-guide-builder-slot" data-extra={slot >= BOARD_SLOTS || undefined} style={costStyle(unit.cost)}>
      <button
        type="button"
        className="wiki-guide-builder-slot-portrait"
        title={text(`Xem ${unit.name}`, `View ${unit.name}`)}
        onClick={() => onOpen(unit.code)}
      >
        <UnitPortrait unit={unit} index={index} size="sm" />
      </button>
      <strong>{unit.name}</strong>
      <span className="wiki-guide-builder-actions">
        <button
          type="button"
          aria-pressed={item.carry}
          aria-label={text(`${unit.name} là chủ lực`, `${unit.name} is a carry`)}
          title={text("Chủ lực (M)", "Carry (M)")}
          className="wiki-guide-carry-toggle"
          onClick={() => onToggleCarry(item)}
        >
          M
        </button>
        <button
          type="button"
          onClick={() => onToggle(unit.code)}
          aria-label={text(`Bỏ ${unit.name}`, `Remove ${unit.name}`)}
          title={text("Bỏ khỏi đội hình", "Remove from the lineup")}
        >
          <WikiIcon name="close" size={14} />
        </button>
      </span>
    </div>
  )
}

/** Emblems from blessings such as the heart ones: each adds one to a Faction or Class without a unit. */
export function BuilderEmblems({
  emblems,
  index,
  onAdd,
  onRemove,
}: {
  emblems: string[]
  index: GuideIndex
  onAdd: () => void
  onRemove: (at: number) => void
}) {
  const text = useWikiText()
  return (
    <div className="wiki-guide-builder-emblems">
      <div className="wiki-guide-builder-emblems-head">
        <span className="wiki-guide-builder-count">
          {text("Huy hiệu", "Emblems")}{" "}
          <b>
            {emblems.length}/{MAX_EMBLEMS}
          </b>
        </span>
        <span className="wiki-mode-meta">
          {text(
            "+1 vào một Phe/Nghề, như khi có chúc phúc “Trái tim…”",
            "+1 to a Faction/Class, as with a “Trái tim…” blessing",
          )}
        </span>
        <button
          type="button"
          className="wiki-guide-lineup-icon-button"
          aria-label={text("Thêm huy hiệu", "Add an emblem")}
          title={text("Thêm huy hiệu", "Add an emblem")}
          disabled={emblems.length >= MAX_EMBLEMS}
          onClick={onAdd}
        >
          <WikiIcon name="plus" size={18} />
        </button>
      </div>
      {emblems.length > 0 && (
        <div className="wiki-guide-trait-tags">
          {emblems.map((emblem, at) => {
            const trait = index.traits.get(emblem)
            return (
              <button
                key={`${emblem}-${at}`}
                type="button"
                className="wiki-guide-trait-tag"
                aria-label={text(`Bỏ huy hiệu ${trait?.name ?? emblem}`, `Remove emblem ${trait?.name ?? emblem}`)}
                title={text("Bỏ huy hiệu", "Remove emblem")}
                onClick={() => onRemove(at)}
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
  )
}

/** Where a copied lineup link or code is pasted when the clipboard cannot be read directly. */
export function PasteLineup({
  value,
  onChange,
  onUse,
  onCancel,
}: {
  value: string
  onChange: (value: string) => void
  onUse: () => void
  onCancel: () => void
}) {
  const text = useWikiText()
  return (
    <form
      className="wiki-guide-builder-paste"
      onSubmit={(event) => {
        event.preventDefault()
        onUse()
      }}
    >
      <input
        className="wiki-guide-field"
        autoFocus
        value={value}
        placeholder={text("Dán đường dẫn hoặc mã đội hình…", "Paste a lineup link or code…")}
        aria-label={text("Đội hình đã sao chép", "Copied lineup")}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="submit" className="wiki-guide-primary" disabled={!value.trim()}>
        {text("Dùng", "Use")}
      </button>
      <button type="button" className="wiki-mode-chip" onClick={onCancel}>
        {text("Hủy", "Cancel")}
      </button>
    </form>
  )
}
