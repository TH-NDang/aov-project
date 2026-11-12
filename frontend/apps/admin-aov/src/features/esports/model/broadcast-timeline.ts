import type { DraftTurn, GameContent, Side } from "@aov/community-contracts"
import type { MarkPart } from "./observation-marks"
import { chapterVideo, type GameChapter } from "./series-vod"
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
        ? "Bắt đầu trận · Ván 1"
        : `Bắt đầu ván ${content.number}`,
  }))
  if (matchStart != null && matchStart !== firstGame?.content.sourceTimestampSeconds) {
    chapters.push({ id: "match-start", at: matchStart, label: "Bắt đầu trận" })
  }
  return chapters.sort((a, b) => a.at - b.at)
}

/** Lengths of video the detail track offers to show at once, in seconds; the whole video is always the widest. */
const SPAN_STEPS = [300, 600, 900, 1800, 3600, 7200, 14400, 28800]

export const timelineSpans = (duration: number) => [...SPAN_STEPS.filter((step) => step < duration), duration]

/**
 * The span shown until the editor picks one. A broadcast runs for hours and a game for minutes, so the track opens
 * on the focused game with its ban/pick phase and a little air around it, whatever the length of the video. Without
 * a game it shows about a quarter of a long video.
 */
export function defaultSpan(duration: number, chapter?: Pick<GameChapter, "from" | "end"> | null) {
  const wanted = chapter ? (chapter.end - chapter.from) * 1.15 : duration > 3600 ? duration / 4 : duration
  return timelineSpans(duration).find((span) => span >= wanted) ?? duration
}

export const spanLabel = (span: number, duration: number) =>
  span >= duration ? "Cả video" : span < 3600 ? `${Math.round(span / 60)} phút` : `${span / 3600} giờ`

/**
 * A marker of one game that an editor may drag along the video axis: a recorded moment, a ban/pick turn, an edge of
 * the ban/pick phase (its start, the line-up lock, the game start that ends it) or the moment the broadcast showed a
 * part of a team's loadouts.
 */
export type RetimeTarget =
  | { kind: "event"; gameId: string; id: string }
  | { kind: "turn"; gameId: string; order: number }
  | { kind: "draftStart"; gameId: string }
  | { kind: "draftLock"; gameId: string }
  | { kind: "gameStart"; gameId: string }
  | { kind: "mark"; gameId: string; side: Side; part: MarkPart; at: number }

/** Where the games around a chapter sit, so a dragged edge never enters another game. */
export type Neighbours = { previousEnd?: number | null; nextFrom?: number | null }

/**
 * Video seconds between which a marker may be dropped, or null when it cannot move. A moment stays inside its game.
 * A ban/pick turn stays between its neighbours, inside the draft phase. The start of the phase stays before its
 * first mark, the lock between the last turn and the game start, and the game start after every draft mark with the
 * game still clear of the next one. Those are the positions the service accepts.
 */
export function retimeRange(
  chapter: GameChapter,
  target: RetimeTarget,
  axisEnd: number,
  neighbours: Neighbours = {},
): { min: number; max: number } | null {
  const range = (min: number, max: number) => (max >= min ? { min, max } : null)
  if (target.kind === "event") {
    const event = chapter.events.find((candidate) => candidate.id === target.id)
    // An equipment change depends on what the slots held just before it, so it is edited in its own form.
    return chapter.live && event && event.kind !== "ITEM" ? { min: chapter.start, max: chapter.end } : null
  }
  if (target.kind === "mark") {
    const mark = chapter.marks?.find(
      (candidate) => candidate.side === target.side && candidate.part === target.part && candidate.at === target.at,
    )
    return chapter.live && mark ? range(chapterVideo(chapter, mark.min), chapterVideo(chapter, mark.max)) : null
  }
  const draft = chapter.draft
  const timed = (turns: DraftTurn[]) => turns.flatMap((turn) => (turn.atSecond == null ? [] : [turn.atSecond]))
  const after = neighbours.previousEnd != null ? neighbours.previousEnd + 1 : 0
  if (target.kind === "gameStart") {
    if (!chapter.live) return null
    const length = chapter.end - chapter.start
    const min = draft ? Math.max(draft.start, draft.locked ?? 0, ...timed(draft.turns)) : Math.min(after, chapter.start)
    const before = neighbours.nextFrom != null ? Math.min(axisEnd, neighbours.nextFrom - 1) : axisEnd
    // A game that already runs past the limit may still be pulled back.
    return range(min, Math.max(before - length, chapter.start))
  }
  if (!draft) return null
  if (target.kind === "draftStart")
    return range(
      Math.min(after, draft.start),
      Math.min(axisEnd, draft.locked ?? axisEnd, chapter.live ? chapter.start : axisEnd, ...timed(draft.turns)),
    )
  if (target.kind === "draftLock")
    return draft.locked == null
      ? null
      : range(Math.max(draft.start, ...timed(draft.turns)), chapter.live ? chapter.start : axisEnd)
  const index = draft.turns.findIndex((turn) => turn.order === target.order)
  if (index < 0 || draft.turns[index]!.atSecond == null) return null
  const min = Math.max(draft.start, ...timed(draft.turns.slice(0, index)))
  const max = Math.min(
    axisEnd,
    draft.locked ?? axisEnd,
    chapter.live ? chapter.start : axisEnd,
    ...timed(draft.turns.slice(index + 1)),
  )
  return max >= min ? { min, max } : null
}
