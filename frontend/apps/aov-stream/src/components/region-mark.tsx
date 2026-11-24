import { GameIcon } from "@aov/ui/components/game-icons"
import { countryReferenceFlag } from "@aov/ui/lib/country-references"
import "./region-mark.css"

/**
 * The picture of a region: its flag, a globe for an area of several countries, or its code where no flag is bundled.
 * The name beside it says the same, so it stays out of the way of a screen reader.
 */
export function RegionMark({ code, size = 18 }: { code: string | null | undefined; size?: number }) {
  if (!code) return null
  const flag = countryReferenceFlag(code)
  if (flag)
    return <img className="hub-flag" src={flag} alt="" width={size} height={Math.round(size * 0.75)} loading="lazy" />
  if (/^[A-Z]{2}$/.test(code) && code !== "EU")
    return (
      <span className="hub-flag-code" aria-hidden="true">
        {code}
      </span>
    )
  return (
    <span className="hub-flag-globe" aria-hidden="true">
      <GameIcon name="world" size={size} />
    </span>
  )
}
