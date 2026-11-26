import type { PublicationOverview } from "../publishing/api/publication-overview"

type Overview = Pick<PublicationOverview, "markets" | "releases">
const releaseDay = (release?: Overview["releases"][number]) =>
  (release?.effectiveOn ?? release?.effectiveAt ?? "").slice(0, 10)

/**
 * Markets on the Wiki whose newer patch has reached its day and waits to be confirmed. A schedule that only knows its
 * day stays unconfirmed on purpose when it is history (01 spec, 16/10/2026), so older ones are not work.
 */
export function marketsAwaitingPatch(overview: Overview, asOf: string) {
  const today = asOf.slice(0, 10)
  return overview.markets.filter((market) => {
    if (!market.available) return false
    const current = releaseDay(overview.releases.find((release) => release.id === market.currentReleaseId))
    return overview.releases.some(
      (release) =>
        release.regionId === market.id &&
        release.phase === "AWAITING_CONFIRMATION" &&
        !!release.effectiveOn &&
        release.effectiveOn > current &&
        release.effectiveOn <= today,
    )
  }).length
}
