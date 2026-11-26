import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { barOf, marksOf, xOf } from "../../../lib/watch-bar"
import { told, toStory } from "../../../lib/watch-place"
import type { WatchView } from "../../../lib/watch-store"
import type { Bar, WatchMatch } from "../../../lib/watch-types"
import { shortName } from "../../../lib/watch-words"
import { StoryCell } from "./story-cell"
import { AXIS } from "./story-marks"
import { StoryReadout } from "./story-readout"
import "./story-bar.css"

/**
 * The pixels of the bar by its size: over the labels, their row, the space under them, the lane of a team and what is
 * left under the games; and at both ends.
 */
const SIZES = {
  wide: { top: 8, label: 24, space: 4, lane: 16, foot: 6, side: 20 },
  low: { top: 4, label: 20, space: 2, lane: 14, foot: 4, side: 20 },
  turned: { top: 4, label: 16, space: 6, lane: 10, foot: 4, side: 14 },
} as const

/** Pixels left of the games, where the logos say whose lane is whose. */
export const LANES = 26
/** Where a place before the first game stands: between the logos and the games. */
const BEFORE = -6
/** Below this width the games stand closer together. */
const ROOMY = 1174
const NARROW = { gap: 8, cut: 3, blank: 64 }

/** The game the video is in, or the one that comes. */
export const currentGame = ({ place, chosen }: WatchView) => (place?.chapter ?? place?.next)?.index ?? chosen

/** What the parts of a bar are sized by. */
export const storyStyle = ({
  top,
  label,
  space,
  lane,
  foot,
}: Record<"top" | "label" | "space" | "lane" | "foot", number>) =>
  ({
    "--story-top": `${top}px`,
    "--story-label": `${label}px`,
    "--story-staff": `${label + space}px`,
    "--story-lane": `${lane}px`,
    "--story-axis": `${AXIS}px`,
    "--story-foot": `${foot}px`,
  }) as CSSProperties

/** Whose lane is above the line and whose below it. */
export function StoryLanes({ match }: { match: WatchMatch }) {
  return (
    <span className="tn-story-lanes" aria-hidden="true">
      {(["A", "B"] as const).map((team) => {
        const { logoUrl, logoDarkUrl } = match.teams[team]
        return <StreamImage key={team} src={logoUrl} darkSrc={logoDarkUrl} logo name={shortName(match, team)} />
      })}
    </span>
  )
}

/**
 * Games of the story with the place of the video on them. The place follows the video by itself: it is written to the
 * element with every reading of the time, and nothing is rendered for it. `placeOf` says where a second of a video
 * stands.
 */
export function StoryTrack({
  match,
  bar,
  placeOf,
  lane,
  label,
}: {
  match: WatchMatch
  bar: Bar
  placeOf: (video: string, second: number) => { x: number; gap: boolean }
  lane: number
  /** Whether the name over a game is pressed or only read; null where the names stand elsewhere. */
  label: "PRESSED" | "READ" | null
}): ReactNode {
  const { story } = match
  const track = useRef<HTMLDivElement>(null)
  const current = useWatch(currentGame)
  const reached = useWatch((view) => view.reached)
  const done = useWatch((view) => view.done)
  const length = useWatch((view) => view.length)
  const crossed = useWatch((view) => view.place?.state === "SPAN")
  // What is drawn of the marks of a game changes as the viewer comes to the next of them, not with every second.
  const marks = useMemo(() => bar.cells.map((cell) => marksOf(cell, Infinity).map(({ at }) => at)), [bar])
  useLayoutEffect(() => {
    const write = (second: number) => {
      const { video } = watch.view()
      if (!track.current || !video) return
      const { x, gap } = placeOf(video, second)
      track.current.style.setProperty("--story-x", `${x.toFixed(1)}px`)
      track.current.style.setProperty("--story-at", toStory(story, video, second).at.toFixed(1))
      track.current.toggleAttribute("data-gap", gap)
    }
    write(watch.view().second)
    return watch.onTime(write)
  }, [story, placeOf])
  return (
    <div ref={track} className="tn-story-track" data-length={length}>
      {bar.cells.map((cell, index) => (
        <StoryCell
          key={cell.chapter.index}
          match={match}
          cell={cell}
          current={cell.chapter.index === current}
          told={told(story, cell.chapter, reached, done)}
          limit={Math.max(-1, ...marks[index]!.filter((at) => at <= reached))}
          lane={lane}
          length={length}
          label={label}
          crossed={crossed}
        />
      ))}
      <span className="tn-story-head" aria-hidden="true" />
      <StoryReadout match={match} bar={bar} whole={label === null} />
    </div>
  )
}

/**
 * The story of a match as one line: a chapter a game, in which breaks take no room, with what both teams did above
 * and below its middle. Everything on it takes the video there.
 */
export function StoryBar({
  match,
  width,
  size,
}: {
  match: WatchMatch
  width: number
  size: "wide" | "low" | "turned"
}): ReactNode {
  const { text } = useStreamLocale()
  const { story } = match
  const sizes = SIZES[size]
  const lanes = size !== "turned"
  const track = Math.max(0, width - sizes.side * 2 - (lanes ? LANES : 0))
  const current = useWatch(currentGame)
  const bar = useMemo(() => barOf(story, track, current, track < ROOMY ? NARROW : {}), [story, track, current])
  const placeOf = useMemo(
    () => (video: string, second: number) => {
      const { x, gap } = xOf(story, bar, video, second)
      return { x: Math.max(BEFORE, x), gap }
    },
    [story, bar],
  )
  return (
    <div
      className="tn-story"
      role="group"
      aria-label={text("Các ván trong video", "The games in the video")}
      style={{ ...storyStyle(sizes), paddingInline: sizes.side }}
    >
      {lanes && <StoryLanes match={match} />}
      <StoryTrack
        match={match}
        bar={bar}
        placeOf={placeOf}
        lane={sizes.lane}
        label={size === "turned" ? "READ" : "PRESSED"}
      />
    </div>
  )
}
