import { useMemo, type ReactNode } from "react"
import { MODE_PARAMS, paramNames, readParam, writeParam } from "../../lib/search-params"
import { useSearchParams } from "react-router"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText, useWikiText } from "../../context/wiki-context"
import { TRAIT_KIND_NAMES, type Trait, type Unit } from "./auto-chess-model"
import { GoldIcon } from "./gold-icon"
import { costStyle, GuideSearch, TraitIcon, type GuideIndex } from "./guide-ui"
import { foldSearchText } from "@aov/ui/lib/search-text"

const KINDS = ["FACTION", "CLASS"] as const

/** The address keys of the unit filter, old spellings included: the search, the price and the factions and classes. */
export const UNIT_FILTER_KEYS = paramNames([MODE_PARAMS.search, MODE_PARAMS.cost, MODE_PARAMS.traits])

/**
 * What narrows a list of units: part of a name, one price, and factions or classes. The filter lives in the address,
 * so a reload or a shared link keeps it; values the guide does not know are ignored.
 */
export function useUnitFilter(index: GuideIndex) {
  const [params, setParams] = useSearchParams()
  const costs = useMemo(() => [...new Set(index.content.units.map((unit) => unit.cost))].sort((a, b) => a - b), [index])
  const search = readParam(params, MODE_PARAMS.search) ?? ""
  const askedCost = Number(readParam(params, MODE_PARAMS.cost))
  const cost = costs.includes(askedCost) ? askedCost : null
  const picked = [...new Set((readParam(params, MODE_PARAMS.traits) ?? "").split(","))].filter((code) =>
    index.traits.has(code),
  )
  const change = (values: { q?: string; cost?: number | null; traits?: string[] }) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (values.q !== undefined) writeParam(next, MODE_PARAMS.search, values.q)
        if (values.cost !== undefined)
          writeParam(next, MODE_PARAMS.cost, values.cost === null ? "" : String(values.cost))
        if (values.traits !== undefined) writeParam(next, MODE_PARAMS.traits, values.traits.join(","))
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  const needle = foldSearchText(search.trim())
  // Several factions or several classes widen the choice; a faction and a class narrow it to units with both.
  const pickedOf = (kind: Trait["kind"]) => picked.filter((code) => index.traits.get(code)?.kind === kind)
  const fits = (unit: Unit, codes: string[]) => !codes.length || codes.some((code) => unit.traitCodes.includes(code))
  const base = index.content.units.filter(
    (unit) => (!cost || unit.cost === cost) && (!needle || foldSearchText(unit.name).includes(needle)),
  )
  return {
    search,
    setSearch: (value: string) => change({ q: value }),
    cost,
    setCost: (value: number | null) => change({ cost: value }),
    costs,
    picked,
    pickedOf,
    toggle: (code: string) =>
      change({ traits: picked.includes(code) ? picked.filter((entry) => entry !== code) : [...picked, code] }),
    units: base.filter((unit) => fits(unit, pickedOf("FACTION")) && fits(unit, pickedOf("CLASS"))),
    /** How many units a trait would show alongside what the other kind has chosen. */
    countWith: (code: string) => {
      const kind = index.traits.get(code)?.kind
      const other = pickedOf(kind === "FACTION" ? "CLASS" : "FACTION")
      return base.filter((unit) => unit.traitCodes.includes(code) && fits(unit, other)).length
    },
    /** Filters set apart from the search: the price and the traits. */
    active: (cost === null ? 0 : 1) + picked.length,
    reset: () => change({ cost: null, traits: [] }),
    /** Clears the search as well, in one change of the address. */
    clear: () => change({ q: "", cost: null, traits: [] }),
  }
}

export type UnitFilter = ReturnType<typeof useUnitFilter>

/** One chip per price, the coin and its number in the price's color; the chosen price again clears it. */
function CostChips({ filter }: { filter: UnitFilter }) {
  const text = useWikiText()
  return (
    <div className="mode-chip-row" role="group" aria-label={text("Giá", "Cost")}>
      {filter.costs.map((cost) => (
        <button
          key={cost}
          type="button"
          className="mode-chip guide-cost-chip"
          style={costStyle(cost)}
          aria-pressed={filter.cost === cost}
          aria-label={text(`${cost} vàng`, `${cost} gold`)}
          title={text(`${cost} vàng`, `${cost} gold`)}
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
  const { locale } = useWikiContext()
  return (
    <fieldset className="guide-choices">
      <legend className={legend ? undefined : "sr-only"}>{wikiText(locale, ...TRAIT_KIND_NAMES[kind])}</legend>
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
  const { locale } = useWikiContext()
  const name = wikiText(locale, ...TRAIT_KIND_NAMES[kind])
  const chosen = filter.pickedOf(kind).length
  return (
    <Popover mobileDrawer={false}>
      <PopoverTrigger asChild>
        <button type="button" className="mode-chip guide-menu-chip" data-active={chosen > 0 || undefined}>
          {name}
          {chosen > 0 && <small>{chosen}</small>}
          <WikiIcon name="chevron" size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} drawerTitle={name} className="guide-trait-menu">
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
  const text = useWikiText()
  const search = (
    <GuideSearch
      value={filter.search}
      onChange={filter.setSearch}
      label={text("Tìm quân cờ", "Search pieces")}
      placeholder={text("Tìm quân cờ…", "Search pieces…")}
    />
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
          title={text("Lọc quân cờ", "Filter pieces")}
          triggerLabel={text("Lọc", "Filter")}
          count={filter.active}
          resetLabel={text("Xóa lọc", "Clear filters")}
          onReset={filter.reset}
          resultLabel={text(`Xem ${filter.units.length} quân cờ`, `Show ${filter.units.length} pieces`)}
        >
          <fieldset className="guide-choices">
            <legend>{text("Giá", "Cost")}</legend>
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
  const text = useWikiText()
  const any = filter.active > 0 || !!filter.search.trim()
  return (
    <div className="guide-summary" role="status">
      <span>
        {filter.units.length} {text("quân cờ", filter.units.length === 1 ? "unit" : "units")}
        {any && ` / ${index.content.units.length}`}
      </span>
      {filter.picked.map((code) => {
        const trait = index.traits.get(code)
        return (
          <button
            key={code}
            type="button"
            className="mode-chip"
            aria-label={text(`Bỏ lọc ${trait?.name ?? code}`, `Clear the ${trait?.name ?? code} filter`)}
            onClick={() => filter.toggle(code)}
          >
            <TraitIcon trait={trait} index={index} size={18} />
            {trait?.name ?? code}
            <WikiIcon name="close" size={14} />
          </button>
        )
      })}
      {any && (
        <button type="button" className="guide-clear" onClick={filter.clear}>
          {text("Bỏ lọc", "Clear filters")}
        </button>
      )}
    </div>
  )
}
