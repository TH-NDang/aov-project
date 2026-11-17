import { useWikiContext, wikiText } from "../../../context/wiki-context"
import type { HeroFilterOption } from "../../../lib/hero-classifications"
import { HeroGlyph } from "../../../components/hero-glyph"
import "./hero-filter-chips.css"

/** One group of hero filters as chips with their mark and name: the lanes, or the roles. */
export function HeroFilterChips<Value extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: readonly HeroFilterOption<Value>[]
  selected: readonly Value[]
  onToggle: (value: Value) => void
}) {
  const { locale } = useWikiContext()
  return (
    <div
      className="wiki-hero-chips"
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
