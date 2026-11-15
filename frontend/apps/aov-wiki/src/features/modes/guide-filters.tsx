import { useMemo, useState, type ReactNode } from "react"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { foldText, TRAIT_KIND_LABEL, type Trait, type Unit } from "./auto-chess-model"
import { GoldIcon } from "./gold-icon"
import { costStyle, GuideSearch, TraitIcon, type GuideIndex } from "./guide-ui"

const KINDS = ["FACTION", "CLASS"] as const

/** What narrows a list of units: part of a name, one price, and factions or classes. */
export function useUnitFilter(index: GuideIndex) {
  const [search, setSearch] = useState("")
  const [cost, setCost] = useState<number | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const costs = useMemo(() => [...new Set(index.content.units.map((unit) => unit.cost))].sort((a, b) => a - b), [index])
  const needle = foldText(search.trim())
  // Several factions or several classes widen the choice; a faction and a class narrow it to units with both.
  const pickedOf = (kind: Trait["kind"]) => picked.filter((code) => index.traits.get(code)?.kind === kind)
  const fits = (unit: Unit, codes: string[]) => !codes.length || codes.some((code) => unit.traitCodes.includes(code))
  const base = index.content.units.filter(
    (unit) => (!cost || unit.cost === cost) && (!needle || foldText(unit.name).includes(needle)),
  )
  return {
    search,
    setSearch,
    cost,
    setCost,
    costs,
    picked,
    pickedOf,
    toggle: (code: string) =>
      setPicked((current) => (current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code])),
    units: base.filter((unit) => fits(unit, pickedOf("FACTION")) && fits(unit, pickedOf("CLASS"))),
    /** How many units a trait would show alongside what the other kind has chosen. */
    countWith: (code: string) => {
      const kind = index.traits.get(code)?.kind
      const other = pickedOf(kind === "FACTION" ? "CLASS" : "FACTION")
      return base.filter((unit) => unit.traitCodes.includes(code) && fits(unit, other)).length
    },
    /** Filters set apart from the search: the price and the traits. */
    active: (cost === null ? 0 : 1) + picked.length,
    reset: () => {
      setCost(null)
      setPicked([])
    },
  }
}

export type UnitFilter = ReturnType<typeof useUnitFilter>

/** One chip per price, the coin and its number in the price's color; the chosen price again clears it. */
function CostChips({ filter }: { filter: UnitFilter }) {
  return (
    <div className="mode-chip-row" role="group" aria-label="Giá">
      {filter.costs.map((cost) => (
        <button
          key={cost}
          type="button"
          className="mode-chip guide-cost-chip"
          style={costStyle(cost)}
          aria-pressed={filter.cost === cost}
          aria-label={`${cost} vàng`}
          title={`${cost} vàng`}
          onClick={() => filter.setCost(filter.cost === cost ? null : cost)}
        >
          <GoldIcon size={16} />
          <b>{cost}</b>
        </button>
      ))}
    </div>
  )
}

/** The factions or the classes as chips that toggle, each with its icon, its name and how many units it would show. */
function TraitChoices({
  kind,
  index,
  filter,
  legend = true,
}: {
  kind: Trait["kind"]
  index: GuideIndex
  filter: UnitFilter
  legend?: boolean
}) {
  return (
    <fieldset className="guide-choices">
      <legend className={legend ? undefined : "sr-only"}>{TRAIT_KIND_LABEL[kind]}</legend>
      <div>
        {index.content.traits
          .filter((trait) => trait.kind === kind)
          .map((trait) => {
            const count = filter.countWith(trait.code)
            const on = filter.picked.includes(trait.code)
            return (
              <button
                key={trait.code}
                type="button"
                className="mode-chip guide-trait-choice"
                aria-pressed={on}
                data-empty={(!on && count === 0) || undefined}
                onClick={() => filter.toggle(trait.code)}
              >
                <TraitIcon trait={trait} index={index} size={20} />
                {trait.name}
                <small>{count}</small>
              </button>
            )
          })}
      </div>
    </fieldset>
  )
}

/** On wide screens each kind of trait waits behind one chip that names it and counts the chosen ones. */
function TraitMenu({ kind, index, filter }: { kind: Trait["kind"]; index: GuideIndex; filter: UnitFilter }) {
  const chosen = filter.pickedOf(kind).length
  return (
    <Popover mobileDrawer={false}>
      <PopoverTrigger asChild>
        <button type="button" className="mode-chip guide-menu-chip" data-active={chosen > 0 || undefined}>
          {TRAIT_KIND_LABEL[kind]}
          {chosen > 0 && <small>{chosen}</small>}
          <WikiIcon name="chevron" size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} drawerTitle={TRAIT_KIND_LABEL[kind]} className="guide-trait-menu">
        <TraitChoices kind={kind} index={index} filter={filter} legend={false} />
      </PopoverContent>
    </Popover>
  )
}

/**
 * Search, price and traits for a list of units. Wide screens keep them on one row; phones keep the search and fold the
 * rest into the filter sheet, or, with `inline`, inside a drawer that cannot open another, into rows that scroll.
 */
export function UnitFilters({
  index,
  filter,
  end,
  inline,
}: {
  index: GuideIndex
  filter: UnitFilter
  /** A control that closes the row on its right, such as the switch between views. */
  end?: ReactNode
  inline?: boolean
}) {
  const layout = usePageLayout()
  const search = (
    <GuideSearch value={filter.search} onChange={filter.setSearch} label="Tìm quân cờ" placeholder="Tìm quân cờ…" />
  )
  if (inline)
    return (
      <div className="guide-filter-stack">
        {search}
        <CostChips filter={filter} />
        {KINDS.map((kind) => (
          <div key={kind} className="guide-choice-row">
            <TraitChoices kind={kind} index={index} filter={filter} />
          </div>
        ))}
      </div>
    )
  if (layout === "compact")
    return (
      <div className="guide-toolbar">
        {search}
        <PublicFilterSheet
          title="Lọc quân cờ"
          triggerLabel="Lọc"
          count={filter.active}
          resetLabel="Xóa lọc"
          onReset={filter.reset}
          resultLabel={`Xem ${filter.units.length} quân cờ`}
        >
          <fieldset className="guide-choices">
            <legend>Giá</legend>
            <CostChips filter={filter} />
          </fieldset>
          {KINDS.map((kind) => (
            <TraitChoices key={kind} kind={kind} index={index} filter={filter} />
          ))}
        </PublicFilterSheet>
        {end}
      </div>
    )
  return (
    <div className="guide-toolbar">
      {search}
      <CostChips filter={filter} />
      {KINDS.map((kind) => (
        <TraitMenu key={kind} kind={kind} index={index} filter={filter} />
      ))}
      {end && <div className="guide-toolbar-end">{end}</div>}
    </div>
  )
}

/** How many units show, and the chosen traits as chips that remove themselves. */
export function FilterSummary({ index, filter }: { index: GuideIndex; filter: UnitFilter }) {
  const any = filter.active > 0 || !!filter.search.trim()
  return (
    <div className="guide-summary" role="status">
      <span>
        {filter.units.length} quân cờ{any && ` / ${index.content.units.length}`}
      </span>
      {filter.picked.map((code) => {
        const trait = index.traits.get(code)
        return (
          <button
            key={code}
            type="button"
            className="mode-chip"
            aria-label={`Bỏ lọc ${trait?.name ?? code}`}
            onClick={() => filter.toggle(code)}
          >
            <TraitIcon trait={trait} index={index} size={18} />
            {trait?.name ?? code}
            <WikiIcon name="close" size={14} />
          </button>
        )
      })}
      {any && (
        <button
          type="button"
          className="guide-clear"
          onClick={() => {
            filter.reset()
            filter.setSearch("")
          }}
        >
          Bỏ lọc
        </button>
      )}
    </div>
  )
}
