import type { ReactNode } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { countsAt } from "../../../lib/watch-place"
import type { WatchView } from "../../../lib/watch-store"
import type { Chapter, Place, RoomBar, RoomShape, WatchMatch } from "../../../lib/watch-types"
import { StoryBar } from "./story-bar"
import { StoryGames } from "./story-games"
import { StoryTabs } from "./story-tabs"
import { WatchAfter } from "./watch-after"
import { DraftBoard } from "./watch-draft"
import type { RoomFacts } from "./watch-facts"
import { RoomClose, RoomShrink } from "./watch-icon"
import { WatchLine } from "./watch-line"
import { LineupBoard, useCountedTo } from "./watch-lineup"
import { useEdges, WatchMoments } from "./watch-moments"
import { WatchBefore, WatchBreak } from "./watch-next"
import { spanGames, WatchNow } from "./watch-now"
import { WatchScore } from "./watch-score"
import { WatchTools } from "./watch-tools"
import { WatchTop } from "./watch-top"
import { WatchUsed } from "./watch-used"
import "./watch-inside.css"

/** Where the video is, or that nobody knows. */
const stateOf = ({ failure, place }: WatchView): Place["state"] => (failure || !place ? "UNKNOWN" : place.state)

function CountedTo({ chapter }: { chapter: Chapter }) {
  const at = useWatch((view) => Math.floor(view.place?.clock ?? 0))
  const words = useCountedTo(countsAt(chapter, at))
  if (!words) return null
  return (
    <p className="tn-room-fact" data-counts="">
      {words}
    </p>
  )
}

/** What is not known of the games the video is in; null where they are timed. */
function useFact(state: Place["state"], chapter: Chapter | null, several: boolean) {
  const { text } = useStreamLocale()
  const failed = useWatch((view) => view.failure != null)
  if (state === "GAME")
    return text("Video này chỉ có mốc bắt đầu của từng ván.", "This video only has the start of each game.")
  if (state === "UNKNOWN")
    return failed ? null : text("Video này chưa có mốc của từng ván.", "The games of this video are not timed yet.")
  if (state !== "SPAN" || !chapter) return null
  return several
    ? text("Các ván này nằm trong đoạn này, chưa có mốc.", "These games are somewhere in here; they are not timed yet.")
    : text(
        `Ván ${chapter.number} nằm trong đoạn này, chưa có mốc.`,
        `Game ${chapter.number} is somewhere in here; it is not timed yet.`,
      )
}

/** What the companion shows of where the video is: the two teams, what has happened, or what comes next. */
function Body({ match, facts, shape }: { match: WatchMatch; facts: RoomFacts; shape: RoomShape }) {
  const state = useWatch(stateOf)
  const at = useWatch((view) => view.place?.chapter ?? null)
  const chosen = useWatch((view) => view.chosen)
  const edges = useEdges<HTMLDivElement>()
  const { story } = match
  const chapter = state === "UNKNOWN" ? (story.chapters[chosen] ?? null) : at
  const several = state === "SPAN" && !!chapter && spanGames(story, chapter).length > 1
  const fact = useFact(state, chapter, several)
  const names = shape.density !== "tight"
  const scrolls = shape.shape !== "stack"

  const inside = (): ReactNode => {
    if (state === "BEFORE") return <WatchBefore />
    if (!chapter) return null
    const own = { match, chapter }
    switch (state) {
      case "DRAFT":
        return (
          <>
            <DraftBoard {...own} names={names} />
            {names && <WatchUsed {...own} />}
          </>
        )
      case "PLAY":
      case "PAUSE":
        return (
          <>
            <LineupBoard {...own} counted names={names} />
            <WatchMoments key={chapter.index} {...own} scrolls={scrolls} />
            <CountedTo chapter={chapter} />
          </>
        )
      case "BREAK":
      case "AFTER":
        return (
          <>
            {state === "BREAK" ? <WatchBreak chapter={chapter} /> : <WatchAfter {...own} facts={facts} />}
            {(state === "BREAK" || !match.finished) && (
              <WatchMoments key={`again-${chapter.index}`} {...own} again scrolls={scrolls} />
            )}
          </>
        )
      default:
        return (
          <>
            {!several && <LineupBoard {...own} names={names} />}
            {fact && <p className="tn-room-fact">{fact}</p>}
          </>
        )
    }
  }
  return (
    <div ref={edges} className="tn-room-body">
      {inside()}
    </div>
  )
}

/** Beside or under the video: what match it is, how it stands, and what is happening. */
function Companion({ match, facts, shape }: { match: WatchMatch; facts: RoomFacts; shape: RoomShape }) {
  const turned = shape.shape === "turned"
  const stacked = shape.shape === "stack"
  // A short window has no line of its own for the way up and out: what is needed of it ends another line.
  const top = !shape.phone && (stacked || (!turned && (shape.density === "roomy" || shape.density === "short")))
  return (
    <>
      {top && <WatchTop facts={facts} />}
      {!shape.phone && <WatchScore match={match}>{turned ? <RoomClose /> : !top && <RoomShrink />}</WatchScore>}
      <WatchNow match={match} phone={shape.phone} end={shape.phone && <RoomClose />} />
      <Body match={match} facts={facts} shape={shape} />
      <WatchTools match={match} stacked={stacked} bare={turned || shape.density === "tight"} />
    </>
  )
}

/**
 * What the room holds beside its video: what is happening, and the story of the match. It comes with a file of its own,
 * which the video does not wait for.
 */
export function WatchInside({
  match,
  facts,
  kind,
  shape,
  width,
}: {
  match: WatchMatch
  facts: RoomFacts
  kind: RoomBar
  shape: RoomShape
  /** The window's. */
  width: number
}): ReactNode {
  const { text } = useStreamLocale()
  if (kind === "NONE") return <WatchLine match={match} facts={facts} />
  const beside = shape.shape === "side" || shape.shape === "turned"
  const barWidth = beside ? shape.video.width + shape.companion : width
  const companion = (
    <aside key="companion" className="tn-room-side" aria-label={text("Theo dõi trận", "Following the match")}>
      <Companion match={match} facts={facts} shape={shape} />
    </aside>
  )
  const bar = (
    <div key="bar" className="tn-room-bar">
      {kind === "TABS" ? (
        <StoryTabs match={match} phone={shape.phone || shape.shape === "turned"} />
      ) : shape.phone ? (
        <StoryGames match={match} width={barWidth} />
      ) : (
        <StoryBar
          match={match}
          width={barWidth}
          size={shape.shape === "turned" ? "turned" : shape.bar < 76 ? "low" : "wide"}
        />
      )}
    </div>
  )
  return beside ? [companion, bar] : [bar, companion]
}
