import { useSearchParams } from "react-router"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { capital } from "../../../lib/capital"
import { gamesText, periodName } from "../../../lib/feed-words"
import type { FeedPeriod } from "../../../lib/game-feed"
import { withParam } from "../../../lib/params"
import { statsHref, type StatsPart, type StatsPlace } from "../../../lib/statistics-routes"
import { ChoiceMenu } from "./choice-menu"
import { ChoiceTrack } from "./choice-track"
import type { StatsData } from "./stats-data"
import "./stats-parts.css"

/** The parts of the statistics, each named in Vietnamese and in English. */
export const PART_NAMES: Record<StatsPart, readonly [string, string]> = {
  heroes: ["Tướng", "Heroes"],
  teams: ["Đội", "Teams"],
  highlights: ["Điểm nhấn", "Highlights"],
  games: ["Tìm ván", "Find games"],
}

/** The parts of the statistics in one row; each keeps the period being counted. */
export function StatsParts({ data, place }: { data: StatsData; place: StatsPlace }) {
  const { text } = useStreamLocale()
  return (
    <div className="tn-stats-bar">
      <ChoiceTrack
        label={text("Phần của thống kê", "Parts of the statistics")}
        size="large"
        fill="compact"
        page
        value={place.part}
        choices={(Object.keys(PART_NAMES) as StatsPart[]).map((part) => ({
          key: part,
          name: text(...PART_NAMES[part]),
          to: statsHref(data.view.id, { part, scope: place.scope }),
        }))}
      />
      <StatsScope data={data} />
      <BansUnknown data={data} />
    </div>
  )
}

/** Says so where some of the games counted do not show their bans; nothing while all of them do. */
export function BansUnknown({ data: { counted } }: { data: StatsData }) {
  const { text, languageTag } = useStreamLocale()
  const unknown = counted.games - counted.shown
  if (!unknown) return null
  const games = gamesText(unknown, text, languageTag)
  return (
    <p className="tn-stats-unknown">
      {unknown === counted.games
        ? text("Các ván này chưa ghi lượt cấm.", "The bans of these games are not recorded.")
        : text(
            `${games} chưa ghi lượt cấm, nên số lần bị cấm và có mặt chỉ tính phần đã ghi.`,
            `The bans of ${games} are not recorded: bans and presence count only what is.`,
          )}
    </p>
  )
}

/** What is counted, in words, which opens the choice: the whole competition, a stage, or the games under a patch. */
export function StatsScope({
  data: { whole, feed, period },
  periods = whole.periods,
}: {
  data: StatsData
  /** The periods offered. */
  periods?: FeedPeriod[]
}) {
  const { text, languageTag } = useStreamLocale()
  const [, setParams] = useSearchParams()
  const games = gamesText(feed.games.length, text, languageTag)
  if (whole.periods.length < 2) return <p className="tn-stats-scope">{games}</p>
  const all = text("cả giải", "the whole tournament")
  const title = text("Đếm những ván nào", "Which games to count")
  const counted = period ? periodName(period, text, languageTag) : all
  return (
    <p className="tn-stats-scope">
      <span>
        <b>{games}</b> {text("của", "of")}
      </span>
      <ChoiceMenu
        title={title}
        value={period?.key ?? null}
        choices={[
          // The words continue a sentence on the button; in the menu they begin a line, as the other choices do.
          { key: null, name: capital(all), note: whole.games.length.toLocaleString(languageTag) },
          ...periods.map((item) => ({
            key: item.key,
            name: periodName(item, text, languageTag),
            note: item.games.toLocaleString(languageTag),
            part: !!item.patch,
          })),
        ]}
        onChoose={(key) => setParams((current) => withParam(current, "in", key), { replace: true })}
      >
        <button type="button" aria-label={`${title}: ${counted}`}>
          {counted}
          <StreamIcon name="chevronRight" size={14} />
        </button>
      </ChoiceMenu>
    </p>
  )
}
