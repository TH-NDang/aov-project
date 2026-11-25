import { useEffect, useRef } from "react"
import { RegionMark } from "../../../components/region-mark"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionRegionName } from "../../../lib/competition-filters"

/** The regions of a list as chips with their flags. The row scrolls sideways and keeps the chosen region in view. */
export function RegionChips({
  regions,
  value,
  onChange,
  className,
}: {
  regions: string[]
  /** The chosen region, or "all". */
  value: string
  onChange: (region: string) => void
  className?: string
}) {
  const { text, languageTag } = useStreamLocale()
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = row.current
    const chosen = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (box && chosen) box.scrollLeft = chosen.offsetLeft - (box.clientWidth - chosen.offsetWidth) / 2
  }, [value])
  if (regions.length < 2 && value === "all") return null
  return (
    <div
      ref={row}
      className={className ? `hub-pills ${className}` : "hub-pills"}
      role="group"
      aria-label={text("Khu vực", "Region")}
      data-padded=""
    >
      <button type="button" aria-pressed={value === "all"} onClick={() => onChange("all")}>
        <RegionMark code="GLOBAL" size={16} />
        {text("Mọi khu vực", "All regions")}
      </button>
      {regions.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={value === code}
          onClick={() => onChange(value === code ? "all" : code)}
        >
          <RegionMark code={code} size={18} />
          {competitionRegionName(code, languageTag)}
        </button>
      ))}
    </div>
  )
}
