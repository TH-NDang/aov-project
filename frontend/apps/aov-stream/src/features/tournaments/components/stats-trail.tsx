import { PlaceSteps, PlaceTrail, type Step } from "../../../components/place-trail"
import { useStreamLocale } from "../../../components/stream-locale"
import type { FeedPeriod } from "../../../lib/game-feed"
import { statsHref, type StatsPart } from "../../../lib/statistics-routes"
import type { StatsData } from "./stats-data"
import { BansUnknown, PART_NAMES, StatsScope } from "./stats-parts"
import "./stats-trail.css"

/**
 * Where one hero or one team stands in the statistics: the ways up, the ones before and after it in the order of their
 * list, and at the end of the line what is counted; under it how many of the games do not show their bans.
 */
export function StatsTrail({
  data,
  periods,
  part,
  current,
  label,
  before,
  after,
}: {
  data: StatsData
  /** The periods that hold something of it; all of them unless told. */
  periods?: FeedPeriod[]
  part: StatsPart
  current: string
  /** What `before` and `after` are. */
  label: string
  before: Step | null
  after: Step | null
}) {
  const { text } = useStreamLocale()
  const scope = data.period?.key
  return (
    <div className="tn-stats-trail">
      <PlaceTrail
        places={[
          { to: statsHref(data.view.id, { scope }), name: text("Thống kê", "Statistics") },
          { to: statsHref(data.view.id, { part, scope }), name: text(...PART_NAMES[part]) },
        ]}
        current={<span className="tn-stats-trail-name">{current}</span>}
        steps={<PlaceSteps label={label} before={before} after={after} />}
      />
      <StatsScope data={data} periods={periods} />
      <BansUnknown data={data} />
    </div>
  )
}
