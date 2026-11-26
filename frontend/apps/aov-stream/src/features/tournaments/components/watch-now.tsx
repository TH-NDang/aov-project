import type { ReactNode } from "react"
import { GoLink } from "../../../components/go-link"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { clock } from "../../../lib/tournament-model"
import { scoreAt } from "../../../lib/watch-place"
import type { Chapter, Place, Story, WatchMatch } from "../../../lib/watch-types"
import { gameWords, shortName, videoClock, type Say } from "../../../lib/watch-words"
import { RoomIcon, RoomPress } from "./watch-icon"
import { useScore } from "./watch-score"
import "./watch-now.css"

/** The games without a time that stand in one stretch of the video. */
export const spanGames = (story: Story, { span, video }: Chapter) =>
  story.chapters.filter((other) => other.video === video && other.span?.from === span?.from)

/** Who won a game or the match, where the video has told it. */
function resultWords(match: WatchMatch, place: Place & { state: "BREAK" | "AFTER" }, text: Say) {
  if (place.state === "AFTER" && match.finished) {
    const { A, B } = scoreAt(match, place)
    if (A === B) return text(`Hòa ${A}–${B}`, `Draw ${A}–${B}`)
    const winner = shortName(match, A > B ? "A" : "B")
    return text(`${winner} thắng trận`, `${winner} win the match`)
  }
  const { number, winner } = place.chapter
  if (!winner) return text(`Hết ván ${number}`, `End of game ${number}`)
  const name = shortName(match, winner)
  return text(`${name} thắng ván ${number}`, `${name} win game ${number}`)
}

/** What is on: a game, which leads to its page, or what stands between two of them. */
function NowName({ match, place, chapter }: { match: WatchMatch; place: Place | null; chapter: Chapter | null }) {
  const { text } = useStreamLocale()
  if (place?.state === "BEFORE") {
    const number = place.next?.number ?? 1
    return number > 1 ? text(`Trước ván ${number}`, `Before game ${number}`) : text("Trước trận", "Before the match")
  }
  if (place?.state === "BREAK" || place?.state === "AFTER") return resultWords(match, place, text)
  if (!chapter) return null
  const games = place?.state === "SPAN" ? spanGames(match.story, chapter) : [chapter]
  if (games.length > 1) {
    const numbers = `${games[0]!.number}–${games.at(-1)!.number}`
    return text(`Ván ${numbers}`, `Games ${numbers}`)
  }
  return <GoLink to={`/games/${chapter.game.id}`}>{gameWords(chapter.number, text)}</GoLink>
}

/** What of it, in words; the clock of a game says it by itself. */
function useNowWords(place: Place | null) {
  const { text } = useStreamLocale()
  const count = useWatch((view) => view.count)
  if (place?.state === "DRAFT") return text("cấm chọn", "draft")
  if (place?.state === "GAME") return place.over ? null : text("đang chiếu", "on now")
  if (place?.state !== "WAIT" && place?.state !== "PAUSE") return null
  if (count) return text(`bỏ qua sau ${count.seconds} giây`, `skipping in ${count.seconds} s`)
  if (place.state === "PAUSE") return text(`tạm dừng ở ${clock(place.clock)}`, `paused at ${clock(place.clock)}`)
  return text(`vào trận sau ${videoClock(place.left)}`, `starts in ${videoClock(place.left)}`)
}

/** What the browser asks for before the video may play with its sound. */
const askedWords = (text: Say) =>
  window.matchMedia("(hover: none)").matches
    ? text("Chạm vào video để phát", "Tap the video to play")
    : text("Bấm vào video để phát", "Click the video to play")

/** From mark to mark, or from piece to piece of the short cut, around the clock of the game. */
function Steps({ at, quick }: { at: number | null; quick: boolean }) {
  const { text } = useStreamLocale()
  return (
    <span className="tn-room-steps">
      <RoomIcon
        icon="skipBack"
        data-solid=""
        label={quick ? text("Đoạn trước", "Previous piece") : text("Mốc trước", "Previous mark")}
        shortcut="["
        onClick={() => watch.step(-1)}
      />
      {at != null && <time>{clock(at)}</time>}
      <RoomIcon
        icon="skip"
        data-solid=""
        label={quick ? text("Đoạn sau", "Next piece") : text("Mốc sau", "Next mark")}
        shortcut="]"
        onClick={() => watch.step(1)}
      />
    </span>
  )
}

/** The way ahead from where the video is, or how long the game took that is told. */
function useAhead(match: WatchMatch, place: Place | null, chapter: Chapter | null): ReactNode {
  const { text } = useStreamLocale()
  const quick = useWatch((view) => view.length === "quick")
  const counting = useWatch((view) => view.count != null)
  const skip = (words: string) => (
    <RoomPress kind="skip" onClick={() => watch.skip()}>
      {words}
    </RoomPress>
  )
  if (place?.state === "PLAY") return <Steps at={place.clock} quick={quick} />
  if (place?.state === "DRAFT" && quick) return <Steps at={null} quick />
  if (counting && (place?.state === "WAIT" || place?.state === "PAUSE"))
    return (
      <RoomPress kind="stay" onClick={() => watch.stay()}>
        {text("Ở lại", "Stay")}
      </RoomPress>
    )
  if (place?.state === "DRAFT" || place?.state === "WAIT") return skip(text("Vào trận", "To the game"))
  if (place?.state === "PAUSE") return skip(text(`Bỏ qua ${videoClock(place.left)}`, `Skip ${videoClock(place.left)}`))
  if (place?.state === "GAME" || place?.state === "SPAN") {
    const next = place.state === "SPAN" || place.over ? place.next : null
    return next && skip(text(`Tới ván ${next.number}`, `To game ${next.number}`))
  }
  if (place?.state === "AFTER" && match.finished) return null
  return chapter?.length ? <span className="tn-room-took">{clock(chapter.length)}</span> : null
}

/**
 * Which game the video is in, what of it is on, and the way ahead. On a phone it carries the score too, and `end` closes
 * the line.
 */
export function WatchNow({ match, phone, end }: { match: WatchMatch; phone: boolean; end?: ReactNode }) {
  const { text } = useStreamLocale()
  const now = useWatch((view) => (view.failure ? null : view.place))
  const chosen = useWatch((view) => view.chosen)
  const tap = useWatch((view) => view.tapNeeded)
  const { A, B } = useScore(match)
  const place = now?.state === "UNKNOWN" ? null : now
  const chapter = place ? place.chapter : (match.story.chapters[chosen] ?? null)
  const words = useNowWords(place)
  const asked = tap ? askedWords(text) : null
  const ahead = useAhead(match, place, chapter)
  return (
    <div className="tn-room-now">
      <div className="tn-room-game">
        <h2>
          <NowName match={match} place={place} chapter={chapter} />
        </h2>
        {phone && (
          <small data-asked={tap || undefined}>
            {asked ?? `${shortName(match, "A")} ${A}–${B} ${shortName(match, "B")}`}
          </small>
        )}
      </div>
      {asked && !phone ? (
        <p data-asked="">{asked}</p>
      ) : (
        words && <p data-spare={place?.state === "DRAFT" || undefined}>{words}</p>
      )}
      {ahead && <div className="tn-room-ahead">{ahead}</div>}
      {end && <div className="tn-room-leave">{end}</div>}
    </div>
  )
}
