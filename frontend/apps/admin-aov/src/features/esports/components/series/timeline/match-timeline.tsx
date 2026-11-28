import { useCallback, useMemo } from "react"
import type { BroadcastChapter, RetimeTarget } from "../../../model/broadcast-timeline"
import type { GameView } from "../../../model/game-view"
import type { ItemLookups } from "../../../model/item-lookups"
import type { Playhead } from "../../../model/playhead"
import { chapterAt, type GameChapter } from "../../../model/series-vod"
import type { TimelineEvent } from "../../../model/timeline"
import type { TimingIssue } from "../../../model/timing-issues"
import type { TimelineRow } from "../../../model/track-layout"
import { usePlayheadValue } from "../../game/use-playhead"
import { Strip } from "./strip"
import { Track } from "./track"
import { trackMarks, trackRings } from "./track-marks"
import { useRetime } from "./use-retime"
import { useTimelineView } from "./use-timeline-view"
import "./timeline.css"

/** What the track may change, present only while an editor with write access is recording. */
export type TimelineEditing = {
  /** Game whose markers may be moved: the page saves through this game only. */
  gameId: string
  /** False until the game has gone live; moments cannot be recorded before that. */
  canCreate: boolean
  /** Records a moment in a row, at the video second that was pointed at. */
  onCreate: (row: TimelineRow, second: number) => void
  /** Moves one marker to another video second, already inside the range it is allowed in. */
  onRetime: (target: RetimeTarget, second: number) => void
}

const NO_FLAGS: BroadcastChapter[] = []
const NO_ISSUES: TimingIssue[] = []

/**
 * The time of a match, as two parts that stand side by side in the watch column: a strip of the whole video for far, and
 * a track of the phase on screen for near, with the moments, turns and edges of the games in its lanes. Only games with
 * a place in the video are on them.
 */
export function MatchTimeline({
  playhead,
  duration,
  chapters,
  flags = NO_FLAGS,
  events,
  views,
  focusedGameId,
  activeId,
  issues = NO_ISSUES,
  lookups,
  label = "Dòng thời gian video",
  playing = false,
  foldable = false,
  fit = 0,
  editing,
  onSeek,
  onSelect,
}: {
  playhead: Playhead
  duration: number
  chapters: GameChapter[]
  flags?: BroadcastChapter[]
  /** Moments already converted to video seconds (see `broadcastEvents`). */
  events: TimelineEvent[]
  views: Record<string, GameView>
  focusedGameId: string | null
  activeId: string | null
  issues?: TimingIssue[]
  lookups: ItemLookups
  label?: string
  playing?: boolean
  /** The track stands behind a button, where there is no room to keep it on screen. */
  foldable?: boolean
  /** Changes when the phase of the chosen game is asked for again. */
  fit?: number
  editing?: TimelineEditing
  onSeek: (second: number) => void
  onSelect: (event: TimelineEvent) => void
}) {
  const here = usePlayheadValue(playhead, (second) => chapterAt(chapters, second)?.gameId ?? null)
  const focused = chapters.find((chapter) => chapter.gameId === (focusedGameId ?? here)) ?? null

  const view = useTimelineView({ playhead, duration, chapters, focused, playing, fit })
  const { plane } = view
  const secondAt = useCallback(
    (clientX: number) => {
      const rect = plane.current!.getBoundingClientRect()
      return Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration)
    },
    [plane, duration],
  )
  const retime = useRetime({ playhead, duration, chapters, events, editing, secondAt, onSeek, onHold: view.hold })

  const marks = useMemo(() => trackMarks({ chapters, events, views, lookups }), [chapters, events, views, lookups])
  const rings = useMemo(() => trackRings(chapters, views), [chapters, views])

  return (
    <>
      <Strip
        playhead={playhead}
        duration={duration}
        chapters={chapters}
        flags={flags}
        events={events}
        focusedGameId={focused?.gameId ?? null}
        view={view}
        onSeek={onSeek}
      />
      <Track
        playhead={playhead}
        duration={duration}
        chapters={chapters}
        flags={flags}
        marks={marks}
        rings={rings}
        views={views}
        focused={focused}
        activeId={activeId}
        issues={issues}
        label={label}
        foldable={foldable}
        editing={editing}
        view={view}
        retime={retime}
        secondAt={secondAt}
        onSeek={onSeek}
        onSelect={onSelect}
      />
    </>
  )
}
