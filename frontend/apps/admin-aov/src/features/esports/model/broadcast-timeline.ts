import type { DraftTurn, GameContent, Side } from "@aov/community-contracts"
import type { MarkPart } from "./observation-marks"
import { chapterVideo, knownEnd, recordedUntil, type GameChapter } from "./series-vod"
import type { TimelineEvent } from "./timeline"
import { gameToVideo, youtubeLinkTime, youtubeVideoId, type VodSync } from "./vod"

export type BroadcastChapter = { id: string; at: number; label: string }

/** Display copies use video seconds; persisted events continue to use the in-game clock. */
export function videoTimelineEvents(sync: VodSync, events: TimelineEvent[]): TimelineEvent[] {
  if (sync.startSecond === null) return []
  return events.map((event) => ({ ...event, at: gameToVideo(sync, event.at)! }))
}

/** Only chapters with a known position in this video belong on its timeline. */
export function broadcastChapters(
  videoId: string,
  seriesUrl: string | undefined,
  games: { id: string; content: Pick<GameContent, "number" | "sourceUrl" | "sourceTimestampSeconds"> }[],
): BroadcastChapter[] {
  const matching = games.filter(
    ({ content }) => youtubeVideoId(content.sourceUrl) === videoId && content.sourceTimestampSeconds != null,
  )
  const firstGame = matching.find(({ content }) => content.number === 1)
  const matchStart =
    (youtubeVideoId(seriesUrl) === videoId ? youtubeLinkTime(seriesUrl) : null) ??
    firstGame?.content.sourceTimestampSeconds
  const chapters = matching.map(({ id, content }) => ({
    id,
    at: content.sourceTimestampSeconds!,
    label:
      content.number === 1 && content.sourceTimestampSeconds === matchStart
        ? "Bắt đầu trận, vào trận ván 1"
        : `Vào trận ván ${content.number}`,
  }))
  if (matchStart != null && matchStart !== firstGame?.content.sourceTimestampSeconds) {
    chapters.push({ id: "match-start", at: matchStart, label: "Bắt đầu trận" })
  }
  return chapters.sort((a, b) => a.at - b.at)
}

/** Lengths of video the detail track offers to show at once, in seconds; the whole video is always the widest. */
const SPAN_STEPS = [300, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200, 14400, 28800]

export const timelineSpans = (duration: number) => [...SPAN_STEPS.filter((step) => step < duration), duration]

/** The span shown while no game has a place in the video: about a quarter of a long one, a short one whole. */
export function defaultSpan(duration: number) {
  const wanted = duration > 3600 ? duration / 4 : duration
  return timelineSpans(duration).find((span) => span >= wanted) ?? duration
}

/** The shortest span chosen without a gesture, in seconds. */
const SHORTEST_PHASE = 300

/** The span that holds a stretch of video with a little air on both sides. */
export const phaseSpan = (range: { from: number; to: number }, duration: number) =>
  Math.min(duration, Math.max(SHORTEST_PHASE, (range.to - range.from) * 1.08))

/** The shortest span a gesture can zoom in to, in seconds. */
const SHORTEST_SPAN = 60

/** A span a gesture asked for, kept between one minute and the whole video. */
export const clampSpan = (duration: number, span: number) =>
  Math.min(duration, Math.max(Math.min(SHORTEST_SPAN, duration), span))

export function spanLabel(span: number, duration: number) {
  if (span >= duration) return "Cả video"
  if (span < 3600) return `${Math.max(1, Math.round(span / 60))} phút`
  // Gestures stop anywhere, so hours carry one decimal, written the Vietnamese way.
  return `${String(Math.round(span / 360) / 10).replace(".", ",")} giờ`
}

/**
 * A marker of one game that an editor may drag along the video axis: a recorded moment, a ban/pick turn, an edge of
 * the ban/pick phase (its start, the line-up lock, the game start that ends it), the end of the game or the moment the
 * broadcast showed a part of a team's loadouts.
 */
export type RetimeTarget =
  | { kind: "event"; gameId: string; id: string }
  | { kind: "turn"; gameId: string; order: number }
  | { kind: "draftStart"; gameId: string }
  | { kind: "draftLock"; gameId: string }
  | { kind: "gameStart"; gameId: string }
  | { kind: "gameEnd"; gameId: string }
  | { kind: "mark"; gameId: string; side: Side; part: MarkPart; at: number }

/** Where the games around a chapter sit, so a dragged edge never enters another game. */
export type Neighbours = { previousEnd?: number | null; nextFrom?: number | null }

/** The neighbours of a game on the video; a game without a place there bounds nothing. */
export function neighboursOf(chapters: GameChapter[], gameId: string): Neighbours {
  const index = chapters.findIndex((chapter) => chapter.gameId === gameId)
  const previous = chapters
    .slice(0, Math.max(0, index))
    .reverse()
    .find((chapter) => chapter.synced)
  const next = chapters.slice(index + 1).find((chapter) => chapter.synced)
  return { previousEnd: previous ? knownEnd(previous) : null, nextFrom: next?.from ?? null }
}

/**
 * Video seconds between which a marker may be dropped, or null when it cannot move. A moment stays inside its game,
 * which reaches to the next game until its end is recorded. A ban/pick turn stays between its neighbours, inside the
 * draft phase. The start of the phase stays before its first mark, the lock between the last turn and the game start,
 * the game start after every draft mark with the game still clear of the next one, and the end after everything
 * recorded in the game. Those are the positions the service accepts.
 */
export function retimeRange(
  chapter: GameChapter,
  target: RetimeTarget,
  axisEnd: number,
  neighbours: Neighbours = {},
): { min: number; max: number } | null {
  const range = (min: number, max: number) => (max >= min ? { min, max } : null)
  const before = neighbours.nextFrom != null ? Math.min(axisEnd, neighbours.nextFrom - 1) : axisEnd
  if (target.kind === "event") {
    const event = chapter.events.find((candidate) => candidate.id === target.id)
    // An equipment change depends on what the slots held just before it, so it is edited in its own form.
    return chapter.live && event && event.kind !== "ITEM"
      ? range(chapter.start, chapter.ended ? chapter.end : before)
      : null
  }
  if (target.kind === "mark") {
    const mark = chapter.marks?.find(
      (candidate) => candidate.side === target.side && candidate.part === target.part && candidate.at === target.at,
    )
    if (!chapter.live || !mark) return null
    const last = chapterVideo(chapter, mark.max)
    return range(chapterVideo(chapter, mark.min), chapter.ended ? last : Math.min(before, last))
  }
  if (target.kind === "gameEnd") {
    if (!chapter.live || !chapter.ended) return null
    const first = Math.max(chapter.start + 1, chapterVideo(chapter, recordedUntil(chapter)))
    return range(Math.min(first, chapter.end), Math.max(before, chapter.end))
  }
  const draft = chapter.draft
  const timed = (turns: DraftTurn[]) => turns.flatMap((turn) => (turn.atSecond == null ? [] : [turn.atSecond]))
  const after = neighbours.previousEnd != null ? neighbours.previousEnd + 1 : 0
  if (target.kind === "gameStart") {
    if (!chapter.live) return null
    const length = knownEnd(chapter) - chapter.start
    const min = draft ? Math.max(draft.start, draft.locked ?? 0, ...timed(draft.turns)) : Math.min(after, chapter.start)
    // A game that already runs past the limit may still be pulled back.
    return range(min, Math.max(before - length, chapter.start))
  }
  if (!draft) return null
  // A game that is not live yet ends nowhere, so nothing of its draft may go past the start of the next game.
  const open = chapter.live ? chapter.start : before
  if (target.kind === "draftStart")
    return range(Math.min(after, draft.start), Math.min(before, draft.locked ?? before, open, ...timed(draft.turns)))
  if (target.kind === "draftLock")
    return draft.locked == null ? null : range(Math.max(draft.start, ...timed(draft.turns)), open)
  const index = draft.turns.findIndex((turn) => turn.order === target.order)
  if (index < 0 || draft.turns[index]!.atSecond == null) return null
  const min = Math.max(draft.start, ...timed(draft.turns.slice(0, index)))
  const max = Math.min(before, draft.locked ?? before, open, ...timed(draft.turns.slice(index + 1)))
  return max >= min ? { min, max } : null
}
