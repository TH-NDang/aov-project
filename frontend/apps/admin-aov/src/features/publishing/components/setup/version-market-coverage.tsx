import { MarketBadge } from "./market-badge"
import { marketReleaseLabel, phaseLabels, type PublicationOverview } from "../../api/publication-overview"
import { dateLabel } from "@/features/publishing/model/setup/schedule-date"

type Scope = { seasonId: string; variantId?: never } | { variantId: string; seasonId?: never }

export function VersionMarketCoverage({
  data,
  scope,
  locale,
  compact = false,
}: {
  data: PublicationOverview
  scope: Scope
  locale: string
  compact?: boolean
}) {
  const seasonId = scope.seasonId
  const records = new Map<string, string>()
  const seasonVariants = new Set(data.variants.filter((v) => seasonId && v.seasonId === seasonId).map((v) => v.id))
  for (const release of data.releases) {
    if (seasonId) {
      if ((release.seasonId === seasonId || seasonVariants.has(release.variantId)) && release.status !== "CANCELLED")
        records.set(release.regionId, "Có lịch patch · Chưa ghi lịch mùa")
    } else if (release.variantId === scope.variantId) {
      const market = data.markets.find((m) => m.id === release.regionId)
      records.set(release.regionId, marketReleaseLabel(release, market))
    }
  }
  if (seasonId) {
    for (const schedule of data.seasonSchedules ?? []) {
      if (schedule.seasonId !== seasonId) continue
      const start = dateLabel(schedule.startsOn ?? schedule.startsAt, locale)
      const end = schedule.endsOn ?? schedule.endsAt
      const dates = end ? `${start} – ${dateLabel(end, locale)}` : `Từ ${start}`
      records.set(
        schedule.regionId,
        schedule.phase === "RECORDED" ? dates : `${dates} · ${phaseLabels[schedule.phase] ?? schedule.phase}`,
      )
    }
  }
  const label = seasonId ? "Thị trường trong mùa" : "Thị trường của patch"
  return (
    <span role="group" aria-label={label} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      {!compact && <span className="type-label text-muted-foreground">{label}</span>}
      {records.size ? (
        data.markets
          .filter((m) => records.has(m.id))
          .map((m) => (
            <span key={m.id} className="inline-flex flex-wrap items-center gap-1.5">
              <MarketBadge code={m.code} name={m.displayName} showName={!compact} detail={records.get(m.id)} />
              <span className="type-meta">{records.get(m.id)}</span>
            </span>
          ))
      ) : (
        <span className="type-meta">Chưa có thị trường ghi lịch</span>
      )}
    </span>
  )
}
