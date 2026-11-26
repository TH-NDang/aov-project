import type { CSSProperties, KeyboardEvent } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { referenceName } from "../../../lib/tournament-model"
import { toStory, toVideo } from "../../../lib/watch-place"
import type { Bar, BarRead, WatchMatch } from "../../../lib/watch-types"
import { placeWords, readWords, videoClock } from "../../../lib/watch-words"
import { useStoryPointer } from "./use-story-pointer"
import "./story-readout.css"

/** Seconds of the story a key moves the place by. */
const STEP = 5
/** Within this many pixels of the right end, what is read stands before the point. */
const LAST = 260

/**
 * The place of the video in the match as a slider, which takes the keys and is told to a screen reader. It is not
 * seen: the bar is drawn under it and the pointer is read by the bar.
 */
function StoryRange({ match: { story } }: { match: WatchMatch }) {
  const { text } = useStreamLocale()
  const reached = useWatch((view) => view.reached)
  useWatch((view) => view.second)
  useWatch((view) => view.place)
  const view = watch.view()
  const { at, part, inside } = toStory(story, view.video ?? story.videos[0]!, view.second)
  const go = (to: number) => {
    const target = toVideo(story, to)
    if (target) watch.go({ video: target.video, second: target.second })
  }
  // Within a part the video stays as it is, playing or not; into another one it is taken playing.
  const move = (by: number) => {
    const to = Math.min(story.seconds, Math.max(0, at + by))
    if (inside && toVideo(story, to)?.part === part) watch.seekBy(to - at)
    else go(to)
  }
  const moves: Record<string, () => void> = {
    ArrowLeft: () => move(-STEP),
    ArrowDown: () => move(-STEP),
    ArrowRight: () => move(STEP),
    ArrowUp: () => move(STEP),
    PageUp: () => watch.step(-1),
    PageDown: () => watch.step(1),
    Home: () => go(0),
    End: () => go(reached),
  }
  const press = (event: KeyboardEvent) => {
    const run = moves[event.key]
    if (!run || event.ctrlKey || event.altKey || event.metaKey) return
    event.preventDefault()
    run()
  }
  return (
    <input
      type="range"
      className="tn-story-range"
      min={0}
      max={Math.ceil(story.seconds / STEP) * STEP}
      step={STEP}
      value={Math.round(at / STEP) * STEP}
      aria-label={text("Vị trí trong trận", "Place in the match")}
      aria-valuetext={placeWords(view, text) || videoClock(view.second)}
      onChange={(event) => go(event.target.valueAsNumber)}
      onKeyDown={press}
    />
  )
}

/** What stands at a point of the bar, in words over the point; on a phone they take the row over the bar whole. */
function Reading({ match, bar, read, whole }: { match: WatchMatch; bar: Bar; read: BarRead; whole: boolean }) {
  const { text } = useStreamLocale()
  const { game, time, what } = readWords(read, match, text, ({ game: { catalog } }, turn) =>
    referenceName(catalog, "heroes", turn.hero, text("tướng chưa rõ", "an unknown hero")),
  )
  return (
    <>
      <span className="tn-story-line" style={{ left: read.x }} aria-hidden="true" />
      <p
        className="tn-story-readout"
        data-whole={whole || undefined}
        data-before={read.x > bar.width - LAST || undefined}
        style={{ "--x": `${read.x}px`, "--rest": `${bar.width - read.x}px` } as CSSProperties}
        aria-hidden="true"
      >
        <b>{game}</b>
        {time && <b>{time}</b>}
        {what && <span>{what}</span>}
      </p>
    </>
  )
}

/** What lies over the games of a bar: the slider, and what a pointer reads there. */
export function StoryReadout({ match, bar, whole }: { match: WatchMatch; bar: Bar; whole: boolean }) {
  const reached = useWatch((view) => view.reached)
  const { read, handlers } = useStoryPointer(bar, reached, match.cuts)
  return (
    <>
      <div className="tn-story-press" {...handlers}>
        <StoryRange match={match} />
      </div>
      {read && <Reading match={match} bar={bar} read={read} whole={whole} />}
    </>
  )
}
