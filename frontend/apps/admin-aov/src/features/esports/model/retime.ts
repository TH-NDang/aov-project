import type { GameContent, Side } from "@aov/community-contracts"
import { formatClock } from "@/lib/clock"
import type { RetimeTarget } from "./broadcast-timeline"
import type { RecordedChange } from "./desk"
import { setDraftTimes } from "./draft"
import { atVideo } from "./game-times"
import type { GameView } from "./game-view"
import { MARK_LABELS, moveMark } from "./observation-marks"
import { momentName } from "./quick-moment"
import { chapterClock, type GameChapter } from "./series-vod"
import { KIND_LABELS } from "./timeline"
import { moveEvent, withPlayback } from "./timeline-io"
import { videoToGame } from "./vod"

type Change = (content: GameContent) => GameContent | null

const recorded = (text: string, apply: Change, revert: Change): RecordedChange => ({
  text,
  apply: (content) => apply(content) ?? content,
  revert: (content) => revert(content) ?? content,
})

/**
 * What a mark dropped at another second of the video changes: the words for it and the way back. Null when nothing
 * moves, because the mark is not there any more or stands at that second already.
 */
export function retimeChange(
  chapter: GameChapter,
  view: GameView | undefined,
  target: RetimeTarget,
  second: number,
): RecordedChange | null {
  const team = (side: Side) => view?.sides[side].team.shortName ?? (side === "BLUE" ? "bên xanh" : "bên đỏ")
  const onVideo = (before: number) => `${atVideo(before)} → ${atVideo(second)}`
  const onClock = (before: number, after: number) => `${formatClock(before)} → ${formatClock(after)}`

  switch (target.kind) {
    case "draftStart":
    case "draftLock": {
      const start = target.kind === "draftStart"
      const before = start ? chapter.draft?.start : chapter.draft?.locked
      if (before == null || before === second) return null
      const at = (value: number) => (start ? { startSecond: value } : { lockedSecond: value })
      return recorded(
        `Đã dời lúc ${start ? "bắt đầu cấm chọn" : "chốt đội hình"}: ${onVideo(before)}`,
        (content) => setDraftTimes(content, at(second)),
        (content) => setDraftTimes(content, at(before)),
      )
    }
    case "gameStart": {
      if (!chapter.live || chapter.start === second) return null
      const before = chapter.start
      // Moments are stored on the game clock, so they travel with its 0:00.
      return recorded(
        `Đã dời lúc vào trận: ${onVideo(before)}, diễn biến của ván dời theo`,
        (content) => withPlayback(content, { startSecond: second }),
        (content) => withPlayback(content, { startSecond: before }),
      )
    }
    case "gameEnd": {
      if (!chapter.live || !chapter.ended) return null
      const before = chapter.duration
      const after = Math.round(videoToGame(chapter.sync, second) ?? before)
      if (after === before || after <= 0) return null
      return recorded(
        `Đã dời lúc kết thúc: ${onVideo(chapter.end)}, dài ${formatClock(after)}`,
        (content) => withPlayback(content, { durationSeconds: after }),
        (content) => withPlayback(content, { durationSeconds: before }),
      )
    }
    case "mark": {
      const after = Math.round(chapterClock(chapter, second))
      if (after === target.at) return null
      // Dropped onto another mark it joins it; the way back takes only the players it brought.
      const lanes = chapter.marks?.find(
        (mark) => mark.side === target.side && mark.part === target.part && mark.at === target.at,
      )?.lanes
      return recorded(
        `Đã dời lúc video hiện ${MARK_LABELS[target.part]} của ${team(target.side)}: ${onClock(target.at, after)}`,
        (content) => moveMark(content, target, after, lanes),
        (content) => moveMark(content, { ...target, at: after }, target.at, lanes),
      )
    }
    case "event": {
      const event = chapter.events.find((candidate) => candidate.id === target.id)
      const after = Math.round(chapterClock(chapter, second))
      if (!event || after === Math.round(event.at)) return null
      const before = event.at
      return recorded(
        `Đã dời ${view ? momentName(event, view) : KIND_LABELS[event.kind]}: ${onClock(before, after)}`,
        (content) => moveEvent(content, target.id, after),
        (content) => moveEvent(content, target.id, before),
      )
    }
  }
}
