import { useWikiContext, wikiText } from "../../../context/wiki-context"
import type { HeroFilterOption } from "../../../lib/hero-classifications"
import { HeroGlyph } from "../../../components/hero-glyph"
import "./hero-filter-chips.css"

/**
 * One group of hero filters as chips with their mark and name: the lanes, or the roles. `sheet` is for the quick
 * switch, whose rows scroll and clip: the focus ring is drawn inside each chip and phones get taller chips.
 */
export function HeroFilterChips<Value extends string>({
  label,
  options,
  selected,
  onToggle,
  layout,
}: {
  label: string
  options: readonly HeroFilterOption<Value>[]
  selected: readonly Value[]
  onToggle: (value: Value) => void
  layout?: "sheet"
}) {
  const { locale } = useWikiContext()
  return (
    <div
      className="wiki-hero-chips"
      data-layout={layout}
      role="group"
      aria-label={wikiText(locale, `Lọc theo ${label.toLowerCase()}`, `Filter by ${label.toLowerCase()}`)}
    >
      <span className="wiki-hero-chips-label" aria-hidden="true">
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="wiki-hero-chip"
          aria-pressed={selected.includes(option.value)}
          onClick={() => onToggle(option.value)}
        >
          <HeroGlyph name={option.glyph} />
          {option.label}
        </button>
      ))}
    </div>
  )
}
