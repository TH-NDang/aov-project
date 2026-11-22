import { useEffect, useRef, useState, type ReactElement } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import type { HeroFilterOption } from "../../../lib/hero-classifications"
import { HeroGlyph } from "../../../components/hero-glyph"
import "./hero-filter-chips.css"

/**
 * One group of hero filters as chips with their mark and name: the lanes, or the roles. `sheet` is for the quick
 * switch, whose rows scroll and clip: the focus ring is drawn inside each chip and phones get taller chips. `counts`
 * writes after each chip how many heroes it would show with the other filters kept; a chip that would show none is dimmed.
 * `icons` is for phones: each choice is its mark alone, and a chosen one spells out its name so the reader sees what
 * is on. A tooltip names the mark and its count: on hover or focus, and for a moment after a tap, since touch screens
 * have no hover.
 */
export function HeroFilterChips<Value extends string>({
  label,
  options,
  selected,
  onToggle,
  layout,
  counts,
}: {
  label: string
  options: readonly HeroFilterOption<Value>[]
  selected: readonly Value[]
  onToggle: (value: Value) => void
  layout?: "sheet" | "icons"
  counts?: ReadonlyMap<Value, number>
}) {
  const { locale } = useWikiContext()
  const [tapped, setTapped] = useState<Value | null>(null)
  const [hovered, setHovered] = useState<Value | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const showAfterTap = (value: Value) => {
    window.clearTimeout(timer.current)
    setTapped(value)
    timer.current = window.setTimeout(() => setTapped(null), 1600)
  }
  const named = (option: HeroFilterOption<Value>) => {
    const count = counts?.get(option.value)
    return count === undefined
      ? option.label
      : wikiText(locale, `${option.label} · ${count} tướng`, `${option.label} · ${count} heroes`)
  }
  const withTip = (option: HeroFilterOption<Value>, button: ReactElement) =>
    layout === "icons" ? (
      <Tooltip
        key={option.value}
        open={tapped === option.value || hovered === option.value}
        onOpenChange={(open) => setHovered(open ? option.value : null)}
      >
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="wiki-hero-chip-tip">
          {named(option)}
        </TooltipContent>
      </Tooltip>
    ) : (
      button
    )
  const chips = (
    <div
      className="wiki-hero-chips"
      data-layout={layout}
      role="group"
      aria-label={wikiText(locale, `Lọc theo ${label.toLowerCase()}`, `Filter by ${label.toLowerCase()}`)}
    >
      <span className="wiki-hero-chips-label" aria-hidden="true">
        {label}
      </span>
      {options.map((option) => {
        const count = counts?.get(option.value)
        return withTip(
          option,
          <button
            key={option.value}
            type="button"
            className="wiki-hero-chip"
            aria-label={layout === "icons" ? named(option) : undefined}
            aria-pressed={selected.includes(option.value)}
            data-empty={(count === 0 && !selected.includes(option.value)) || undefined}
            onPointerUp={(event) => {
              if (layout === "icons" && event.pointerType !== "mouse") showAfterTap(option.value)
            }}
            onClick={() => onToggle(option.value)}
          >
            <HeroGlyph name={option.glyph} />
            <span className="wiki-hero-chip-name">{option.label}</span>
            {counts && layout !== "icons" && <span className="wiki-hero-chip-count">{count ?? 0}</span>}
          </button>,
        )
      })}
    </div>
  )
  return layout === "icons" ? <TooltipProvider delayDuration={200}>{chips}</TooltipProvider> : chips
}
