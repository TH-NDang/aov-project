import { Flag, Lock, ShieldBan, Square, type LucideIcon } from "lucide-react"
import type { BroadcastChapter, RetimeTarget } from "../../../model/broadcast-timeline"
import { atVideo } from "../../../model/game-times"
import type { Playhead } from "../../../model/playhead"
import { chapterAt, chapterVideo, knownEnd, type GameChapter } from "../../../model/series-vod"
import type { TimingIssue } from "../../../model/timing-issues"
import { SPINE_HEIGHT } from "../../../model/track-layout"
import { usePlayheadValue } from "../../game/use-playhead"
import { keyOf, type Retime } from "./use-retime"

/** Place of a second on the track, as a CSS length. */
export type Pct = (second: number) => string

const HANDLE_WIDTH = 20

type EdgeKind = "draftStart" | "draftLock" | "gameStart" | "gameEnd"
export type Handle = {
  key: string
  /** Null for a place that belongs to no game, such as the start of the match. */
  edge: EdgeKind | null
  target: RetimeTarget | null
  flagId: string | null
  second: number
  name: string
}

const EDGES: Record<EdgeKind, { icon: LucideIcon; name: (game: number) => string }> = {
  draftStart: { icon: ShieldBan, name: (game) => `Bắt đầu cấm chọn ván ${game}` },
  draftLock: { icon: Lock, name: (game) => `Chốt đội hình ván ${game}` },
  gameStart: { icon: Flag, name: (game) => `Vào trận ván ${game}` },
  gameEnd: { icon: Square, name: (game) => `Kết thúc ván ${game}` },
}

/** Every edge on the spine in time order; the starts of the games and of the match come from `flags`. */
export function spineHandles(chapters: GameChapter[], flags: BroadcastChapter[]): Handle[] {
  const handles: Handle[] = []
  const add = (edge: EdgeKind, chapter: GameChapter, second: number | null | undefined) => {
    if (second == null) return
    const target: RetimeTarget = { kind: edge, gameId: chapter.gameId }
    handles.push({ key: keyOf(target), edge, target, flagId: null, second, name: EDGES[edge].name(chapter.number) })
  }
  for (const chapter of chapters) {
    if (!chapter.synced) continue
    add("draftStart", chapter, chapter.draft?.start)
    add("draftLock", chapter, chapter.draft?.locked)
    add("gameEnd", chapter, chapter.live && chapter.ended ? chapter.end : null)
  }
  for (const flag of flags) {
    const chapter = chapters.find((candidate) => candidate.gameId === flag.id)
    const target: RetimeTarget | null = flag.id === "match-start" ? null : { kind: "gameStart", gameId: flag.id }
    handles.push({
      key: target ? keyOf(target) : `flag:${flag.id}`,
      edge: target ? "gameStart" : null,
      target,
      flagId: flag.id,
      second: flag.at,
      name: chapter ? EDGES.gameStart.name(chapter.number) : flag.label,
    })
  }
  return handles.sort((a, b) => a.second - b.second)
}

/**
 * The edges that have room to stand beside each other; the start of a game goes before its end and its draft. An edge
 * somebody may move is never left out, however close another one stands.
 */
export function visibleHandles(handles: Handle[], retime: Retime, pxPerSecond: number): Handle[] {
  const weight: (EdgeKind | null)[] = ["gameStart", "draftStart", "gameEnd", "draftLock", null]
  const at = (handle: Handle) => retime.shownAt(handle.key, handle.second)
  const kept: Handle[] = []
  for (const handle of [...handles].sort((a, b) => weight.indexOf(a.edge) - weight.indexOf(b.edge))) {
    const room = kept.every((other) => Math.abs(at(other) - at(handle)) * pxPerSecond >= HANDLE_WIDTH)
    if (room || (handle.target && retime.movable(handle.target))) kept.push(handle)
  }
  return handles.filter((handle) => kept.includes(handle))
}

type PartKind = "draft" | "wait" | "play" | "pause" | "guess" | "clash"

function Part({ part, from, to, pct }: { part: PartKind; from: number; to: number; pct: Pct }) {
  if (to <= from) return null
  return (
    <span className="esp-part" data-part={part} aria-hidden="true" style={{ left: pct(from), width: pct(to - from) }} />
  )
}

/** A game nobody recorded the end of: played as far as the video or a moment got, guessed beyond. */
function OpenGame({
  chapter,
  chapters,
  start,
  playhead,
  pct,
}: {
  chapter: GameChapter
  chapters: GameChapter[]
  start: number
  playhead: Playhead
  pct: Pct
}) {
  const here = usePlayheadValue(playhead, (second) =>
    chapterAt(chapters, second)?.gameId === chapter.gameId ? Math.floor(second) : null,
  )
  const reached = Math.max(start, knownEnd(chapter), here ?? start)
  const next = chapters.filter((other) => other.synced && other.from > chapter.start).map((other) => other.from)
  const guessed = Math.min(Math.max(chapter.end, reached), ...next)
  return (
    <>
      <Part part="play" from={start} to={reached} pct={pct} />
      <Part part="guess" from={reached} to={guessed} pct={pct} />
    </>
  )
}

/** A draft nobody locked, or the wait for a game nobody started: as long as the video shows it. */
function OpenDraft({
  chapter,
  chapters,
  start,
  playhead,
  pct,
}: {
  chapter: GameChapter
  chapters: GameChapter[]
  start: number
  playhead: Playhead
  pct: Pct
}) {
  const here = usePlayheadValue(playhead, (second) =>
    chapterAt(chapters, second)?.gameId === chapter.gameId ? Math.floor(second) : null,
  )
  const locked = chapter.draft?.locked ?? null
  const reached = Math.max(start, knownEnd(chapter), here ?? start)
  return (
    <>
      <Part part="draft" from={start} to={locked ?? reached} pct={pct} />
      {locked !== null && <Part part="wait" from={locked} to={reached} pct={pct} />}
    </>
  )
}

/** What a game is on the spine: its draft, the wait for 0:00, the time played and the pauses in it. */
function GameParts({
  chapter,
  chapters,
  playhead,
  pct,
  retime,
}: {
  chapter: GameChapter
  chapters: GameChapter[]
  playhead: Playhead
  pct: Pct
  retime: Retime
}) {
  const { draft, gameId } = chapter
  const at = (kind: EdgeKind, second: number) => retime.shownAt(keyOf({ kind, gameId }), second)
  const draftStart = draft ? at("draftStart", draft.start) : null
  if (!chapter.live)
    return draftStart === null ? null : (
      <OpenDraft chapter={chapter} chapters={chapters} start={draftStart} playhead={playhead} pct={pct} />
    )

  const start = at("gameStart", chapter.start)
  // Nothing is banned or picked after the lock: the phase ends there, and the rest is the wait for the game.
  const locked = draft?.locked == null ? null : at("draftLock", draft.locked)
  const pauses = chapter.sync.pauses.filter((pause) => pause.durationSeconds > 0)
  return (
    <>
      {draftStart !== null && <Part part="draft" from={draftStart} to={locked ?? start} pct={pct} />}
      {locked !== null && <Part part="wait" from={locked} to={start} pct={pct} />}
      {chapter.ended ? (
        <Part part="play" from={start} to={at("gameEnd", chapter.end)} pct={pct} />
      ) : (
        <OpenGame chapter={chapter} chapters={chapters} start={start} playhead={playhead} pct={pct} />
      )}
      {pauses.map((pause) => {
        const from = chapterVideo(chapter, pause.atSeconds) + (start - chapter.start)
        return <Part key={pause.atSeconds} part="pause" from={from} to={from + pause.durationSeconds} pct={pct} />
      })}
    </>
  )
}

/**
 * The line between the lanes: drafts hatched, played time solid, what is only a guess dashed, and the edges of each
 * phase as handles. The ones of the chosen game are dragged while recording; all of them seek.
 */
export function TrackSpine({
  chapters,
  handles,
  issues,
  playhead,
  pct,
  top,
  retime,
  isStop,
  onSeek,
  onPoint,
}: {
  chapters: GameChapter[]
  handles: Handle[]
  issues: TimingIssue[]
  playhead: Playhead
  pct: Pct
  top: number
  retime: Retime
  /** Whether a handle is the one Tab stops at. */
  isStop: (key: string) => boolean
  onSeek: (second: number) => void
  /** Says in the band what is pointed at; null when nothing is any more. */
  onPoint: (point: { second: number; text: string } | null) => void
}) {
  // The two games of a clash both carry it.
  const clashes = new Map(issues.map((issue) => [`${issue.from}:${issue.to}`, issue]))
  return (
    <div className="esp-spine" style={{ top, height: SPINE_HEIGHT }}>
      {chapters.map((chapter) =>
        chapter.synced ? (
          <GameParts
            key={chapter.gameId}
            chapter={chapter}
            chapters={chapters}
            playhead={playhead}
            pct={pct}
            retime={retime}
          />
        ) : null,
      )}
      {[...clashes].map(([key, issue]) => (
        <Part key={key} part="clash" from={issue.from} to={issue.to} pct={pct} />
      ))}
      {handles.map((handle) => {
        const { target, key } = handle
        const at = retime.shownAt(key, handle.second)
        const movable = !!target && !!retime.movable(target)
        const Icon = handle.edge ? EDGES[handle.edge].icon : Flag
        const point = () => onPoint({ second: at, text: `${handle.name} ${atVideo(handle.second)}` })
        return (
          <button
            key={key}
            type="button"
            className="esp-handle"
            data-edge={handle.edge ?? undefined}
            data-walk="SPINE"
            data-at={handle.second}
            data-chapter={handle.flagId ?? undefined}
            data-movable={movable || undefined}
            data-dragging={retime.drag?.key === key || undefined}
            tabIndex={isStop(key) ? 0 : -1}
            style={{ left: pct(at) }}
            aria-label={`${handle.name}, ${atVideo(handle.second)}`}
            aria-keyshortcuts={movable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
            onPointerEnter={point}
            onPointerLeave={() => onPoint(null)}
            onFocus={point}
            onBlur={() => onPoint(null)}
            onPointerDown={(event) => retime.startPress(event, target, handle.second)}
            onKeyDown={(event) => target && retime.nudge(event, target, handle.second)}
            onClick={retime.clicked(() => onSeek(handle.second))}
          >
            <Icon size={11} strokeWidth={2.4} />
          </button>
        )
      })}
    </div>
  )
}
