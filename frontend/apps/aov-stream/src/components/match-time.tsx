import { LocalTime } from "@aov/ui/components/local-time"
import { useStreamLocale } from "./stream-locale"
import type { CompetitionMatch } from "../lib/match-model"
import { matchClock, matchTimeText } from "../lib/match-time"
import { useNow } from "../lib/use-now"

/** When a match starts, as a reader says it; the exact and the original time open from it. */
export function MatchTime({ entry, dayNamed = false }: { entry: CompetitionMatch; dayNamed?: boolean }) {
  const { text, languageTag } = useStreamLocale()
  const now = useNow()
  const { match, competition } = entry
  const at = Date.parse(match.scheduledAt || "")
  if (Number.isNaN(at)) return <>{text("Chờ lịch", "To be scheduled")}</>
  return (
    <LocalTime
      value={match.scheduledAt}
      sourceTimeZone={competition.content.plan.timezone}
      label={(zone) => (dayNamed ? matchClock(at, zone, languageTag) : matchTimeText(at, zone, now, languageTag))}
      locale={languageTag}
    />
  )
}
