import type { GameContent } from "@aov/community-contracts"
import { formatClock } from "@/lib/clock"
import type { RetimeTarget } from "./broadcast-timeline"
import { moveTurn, setDraftTimes } from "./draft"
import type { GameView } from "./game-view"
import { MARK_LABELS, moveMark } from "./observation-marks"
import { chapterClock, type GameChapter } from "./series-vod"
import type { TimelineEvent } from "./timeline"
import { moveEvent, withPlayback } from "./timeline-io"
import { VIDEO_MARK } from "./vod"

/** A change of a game's content; null when it changes nothing. */
export type ContentChange = (content: GameContent) => GameContent | null

/** A marker moved on the timeline: what the undo note says, the move itself and how to put it back. */
export type MarkerMove = { text: string; apply: ContentChange; revert: ContentChange }

const eventName = (event: TimelineEvent) =>
  event.kind === "KILL"
    ? "Hạ gục"
    : event.kind === "OBJECTIVE"
      ? "Mục tiêu"
      : event.kind === "NOTE"
        ? event.title || "Khoảnh khắc"
        : "Trang bị"

/**
 * Moving one marker of a game to another video second, or null when it is already there. Turns, the edges of the
 * ban/pick phase and the game start are stored as video seconds; moments and the moments the broadcast showed
 * loadouts are stored on the game clock.
 */
export function markerMove(
  target: RetimeTarget,
  second: number,
  chapter: GameChapter,
  view: GameView | undefined,
): MarkerMove | null {
  const move = (text: string, apply: ContentChange, revert: ContentChange) => ({
    text: `Đã đổi giây · ${text}`,
    apply,
    revert,
  })
  const onVideo = (before: number) => `${VIDEO_MARK} ${formatClock(before)} → ${formatClock(second)}`
  const game = `Ván ${view?.number ?? chapter.number}`

  if (target.kind === "turn") {
    const turn = chapter.draft?.turns.find((candidate) => candidate.order === target.order)
    if (turn?.atSecond == null || turn.atSecond === second) return null
    const before = turn.atSecond
    return move(
      `Lượt ${turn.order} · ${turn.hero?.name ?? (turn.kind === "BAN" ? "cấm" : "chọn")}: ${onVideo(before)}`,
      (content) => moveTurn(content, target.order, second),
      (content) => moveTurn(content, target.order, before),
    )
  }
  if (target.kind === "draftStart" || target.kind === "draftLock") {
    const start = target.kind === "draftStart"
    const before = start ? chapter.draft?.start : chapter.draft?.locked
    if (before == null || before === second) return null
    const at = (value: number) => (start ? { startSecond: value } : { lockedSecond: value })
    return move(
      `${start ? "Bắt đầu cấm chọn" : "Chốt đội hình"} · ${game}: ${onVideo(before)}`,
      (content) => setDraftTimes(content, at(second)),
      (content) => setDraftTimes(content, at(before)),
    )
  }
  if (target.kind === "gameStart") {
    if (!chapter.live || chapter.start === second) return null
    const before = chapter.start
    // Moments are stored on the game clock, so they travel with its 0:00.
    return move(
      `Vào trận · ${game}: ${onVideo(before)} · sự kiện của ván dời theo`,
      (content) => withPlayback(content, { startSecond: second }),
      (content) => withPlayback(content, { startSecond: before }),
    )
  }
  if (target.kind === "mark") {
    const next = Math.round(chapterClock(chapter, second))
    if (next === target.at) return null
    return move(
      `Video hiện ${MARK_LABELS[target.part]} · ${view?.sides[target.side].team.shortName ?? game}: ⏱ ${formatClock(target.at)} → ${formatClock(next)}`,
      (content) => moveMark(content, target, next),
      (content) => moveMark(content, { ...target, at: next }, target.at),
    )
  }
  const event = chapter.events.find((candidate) => candidate.id === target.id)
  const next = Math.round(chapterClock(chapter, second))
  if (!event || next === Math.round(event.at)) return null
  const before = event.at
  return move(
    `${eventName(event)} · ${game}: ⏱ ${formatClock(before)} → ${formatClock(next)}`,
    (content) => moveEvent(content, target.id, next),
    (content) => moveEvent(content, target.id, before),
  )
}
