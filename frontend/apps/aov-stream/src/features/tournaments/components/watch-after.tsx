import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { mvpOf } from "../../../lib/crew-model"
import { dayMonthInZone, matchClock } from "../../../lib/match-time"
import { firstOf } from "../../../lib/watch-follow"
import type { RoomNext, RoomSide } from "../../../lib/watch-match"
import type { Chapter, WatchMatch } from "../../../lib/watch-types"
import type { RoomFacts } from "./watch-facts"
import { RoomGo, RoomPress } from "./watch-icon"
import { RoomMvp } from "./watch-next"
import "./watch-after.css"

const Crest = ({ side }: { side: RoomSide }) => (
  <StreamImage src={side.logoUrl} darkSrc={side.logoDarkUrl} logo name={side.name} />
)

/** The match after this one: who meets and when, and the way to watch it where it can be watched. */
function NextMatch({ next }: { next: RoomNext }) {
  const { text, languageTag } = useStreamLocale()
  const length = useWatch((view) => view.length)
  const pair = `${next.a.name} – ${next.b.name}`
  const at = next.at ? Date.parse(next.at) : Number.NaN
  return (
    <div className="tn-room-following">
      <Link to={next.href}>
        <span aria-hidden="true">
          <Crest side={next.a} />
          <Crest side={next.b} />
        </span>
        <b>{pair}</b>
        <small>
          {next.sameDay ? text("Trận kế tiếp trong ngày", "Next match today") : text("Trận kế tiếp", "Next match")}
          {!Number.isNaN(at) && (
            <>
              {", "}
              <LocalTime
                value={next.at}
                sourceTimeZone={next.zone}
                locale={languageTag}
                label={(zone) =>
                  next.sameDay
                    ? matchClock(at, zone, languageTag)
                    : `${matchClock(at, zone, languageTag)} ${dayMonthInZone(at, zone, languageTag)}`
                }
              />
            </>
          )}
          {`, BO${next.bestOf}`}
        </small>
      </Link>
      {next.watchable && (
        <RoomGo icon="play" to={next.href} state={{ play: true, length }}>
          {text(`Xem ${pair}`, `Watch ${pair}`)}
        </RoomGo>
      )}
    </div>
  )
}

/**
 * After the last game that is recorded: who played best, the match from its start again, and the one after it. While
 * the result is not final there may be games still to be timed.
 */
export function WatchAfter({ match, facts, chapter }: { match: WatchMatch; facts: RoomFacts; chapter: Chapter }) {
  const { text } = useStreamLocale()
  const length = useWatch((view) => view.length)
  const mvp = match.finished ? facts.mvp : mvpOf(chapter.game.content.mvpPlayerId, chapter.game.players)
  const first = firstOf(match.story, match.cuts, length)
  return (
    <div className="tn-room-after">
      {mvp && <RoomMvp player={mvp} chapter={match.finished ? undefined : chapter} />}
      {!match.finished && (
        <p className="tn-room-note">
          {text("Các ván sau chưa có mốc trên video.", "The later games are not timed on the video yet.")}
        </p>
      )}
      {first && (
        <RoomPress onClick={() => watch.go(first)}>{text("Xem lại từ đầu", "Watch again from the start")}</RoomPress>
      )}
      {facts.next && <NextMatch next={facts.next} />}
    </div>
  )
}
