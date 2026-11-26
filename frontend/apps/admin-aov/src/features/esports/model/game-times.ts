import type { GameContent, Side } from "@aov/community-contracts"
import { formatClock } from "@/lib/clock"
import type { ContentChange, RecordedChange } from "./desk"
import { earliestLive, readDraft, setDraftTimes } from "./draft"
import type { GameChapter } from "./series-vod"
import { withPlayback } from "./timeline-io"
import { gameToVideo, videoToGame, youtubeVideoId } from "./vod"

/** The four edges of a game in its video: the ban/pick phase begins, its line-ups are locked, 0:00 and the end. */
export type GameTime = "draftStart" | "lock" | "live" | "end"

/** A position in the video; its mark tells it apart from a game clock. */
export const atVideo = (second: number) => `▸${formatClock(second)}`

/** The last second of the game clock anything is recorded at. The service accepts no length before it. */
export function lastRecorded(content: GameContent): number {
  const seconds = [
    ...(content.timeline?.events ?? []).map((event) => event.atSeconds),
    ...(content.timeline?.pauses ?? []).map((pause) => pause.atSeconds),
    ...content.sides.flatMap((side) =>
      side.participants.flatMap((participant) => [
        participant.spellObservedAtSeconds,
        participant.arcana.observedAtSeconds,
        participant.enchantments.observedAtSeconds,
        ...participant.equipmentSnapshots.map((snapshot) => snapshot.atSeconds),
        ...participant.equipmentEvents.map((event) => event.atSeconds),
        ...(participant.build ?? []).map((step) => step.atSeconds),
      ]),
    ),
  ]
  return Math.max(0, ...seconds.filter((second): second is number => second != null))
}

/** Why a typed or marked length is not accepted: the game is recorded past it. */
export function lengthRefusal(content: GameContent, seconds: number): string | null {
  if (seconds <= 0) return "Thời lượng phải lớn hơn 0."
  const last = lastRecorded(content)
  return seconds < last ? `Ván đã ghi tới ${formatClock(last)}, sau mốc này.` : null
}

function draftStartRefusal(content: GameContent, second: number) {
  const draft = readDraft(content)
  const first = draft.turns.find((turn) => turn.atSecond != null)
  const limits: [number | null | undefined, string][] = [
    [first?.atSecond, `lượt ${first?.order}`],
    [draft.lockedSecond, "lúc chốt đội hình"],
    [content.sourceTimestampSeconds, "lúc vào trận"],
  ]
  const passed = limits.find(([limit]) => limit != null && second > limit)
  return passed ? `Cấm chọn phải bắt đầu trước ${passed[1]} (${atVideo(passed[0]!)}).` : null
}

function lockRefusal(content: GameContent, second: number) {
  const draft = readDraft(content)
  if (draft.startSecond == null) return "Đặt lúc bắt đầu cấm chọn trước."
  const last = draft.turns.filter((turn) => turn.atSecond != null).at(-1)
  if (last && second < last.atSecond!) return `Chốt đội hình phải sau lượt ${last.order} (${atVideo(last.atSecond!)}).`
  if (second < draft.startSecond) return `Chốt đội hình phải sau lúc bắt đầu cấm chọn (${atVideo(draft.startSecond)}).`
  const live = content.sourceTimestampSeconds
  return live != null && second > live ? `Chốt đội hình phải trước lúc vào trận (${atVideo(live)}).` : null
}

function liveRefusal(content: GameContent, second: number, next: { from: number } | null) {
  const floor = earliestLive(readDraft(content))
  if (second < floor) return `Ván phải vào trận sau màn cấm chọn (${atVideo(floor)}).`
  const length = content.durationSeconds
  if (length == null || !next) return null
  const end = gameToVideo({ url: "", startSecond: second, pauses: content.timeline?.pauses ?? [] }, length)!
  return end >= next.from
    ? `Ván dài ${formatClock(length)} sẽ lấn sang ván sau, bắt đầu ở ${atVideo(next.from)}.`
    : null
}

function endRefusal(content: GameContent, chapter: GameChapter, second: number, next: { from: number } | null) {
  if (!chapter.live) return "Đặt lúc vào trận trước."
  if (second <= chapter.start) return `Ván phải kết thúc sau lúc vào trận (${atVideo(chapter.start)}).`
  if (next && second >= next.from) return `Ván sau đã bắt đầu ở ${atVideo(next.from)}.`
  return lengthRefusal(content, Math.round(videoToGame(chapter.sync, second) ?? 0))
}

/**
 * Why a mark cannot stand at a video second, as the service would refuse it; null when it can. `next` is the game after
 * this one on the same video, which this one may not reach into.
 */
export function timeRefusal(
  content: GameContent,
  chapter: GameChapter,
  time: GameTime,
  second: number,
  next: { from: number } | null,
): string | null {
  switch (time) {
    case "draftStart":
      return draftStartRefusal(content, second)
    case "lock":
      return lockRefusal(content, second)
    case "live":
      return liveRefusal(content, second, next)
    case "end":
      return endRefusal(content, chapter, second, next)
  }
}

const moved = (what: string, before: number, second: number) =>
  `Đã dời ${what}: ${atVideo(before)} → ${atVideo(second)}`

/** Writes a mark, with the link of the video it was read from where the game points to none yet. */
export function timeChange(
  content: GameContent,
  chapter: GameChapter,
  time: GameTime,
  second: number,
  url?: string,
): RecordedChange {
  if (time === "end") return endChange(content, chapter, second, null)
  // A mark says nothing without its video, and a new game may still carry the source of the match.
  const linked = !!url && !youtubeVideoId(content.sourceUrl)
  const link = (value: GameContent) => (linked ? { ...value, sourceUrl: url } : value)
  const unlink = (value: GameContent) =>
    linked && value.sourceUrl === url ? { ...value, sourceUrl: content.sourceUrl } : value

  if (time === "live") {
    const before = content.sourceTimestampSeconds ?? null
    const follow = content.timeline?.events.length ? ", diễn biến của ván dời theo" : ""
    return {
      text:
        before === null
          ? `Ván ${chapter.number} vào trận lúc ${atVideo(second)}`
          : `${moved("lúc vào trận", before, second)}${follow}`,
      apply: (current) => link(withPlayback(current, { startSecond: second })),
      revert: (current) => unlink(withPlayback(current, { startSecond: before })),
    }
  }

  const start = time === "draftStart"
  const draft = readDraft(content)
  const before = (start ? draft.startSecond : draft.lockedSecond) ?? null
  const write =
    (value: number | null): ContentChange =>
    (current) =>
      setDraftTimes(current, start ? { startSecond: value } : { lockedSecond: value })
  const first = start
    ? `Ván ${chapter.number} bắt đầu cấm chọn lúc ${atVideo(second)}`
    : `Đã chốt đội hình lúc ${atVideo(second)}`
  return {
    text: before === null ? first : moved(start ? "lúc bắt đầu cấm chọn" : "lúc chốt đội hình", before, second),
    apply: (current) => link(write(second)(current)),
    revert: (current) => unlink(write(before)(current)),
  }
}

type SideName = (side: Side) => string
const sideOfMap: SideName = (side) => (side === "BLUE" ? "bên xanh" : "bên đỏ")

/** Ends the game where the video is, and says who won when that was pressed with it. */
export function endChange(
  content: GameContent,
  chapter: GameChapter,
  second: number,
  winner: Side | null,
  name: SideName = sideOfMap,
): RecordedChange {
  const length = Math.round(videoToGame(chapter.sync, second) ?? 0)
  const won = winner ?? content.winner ?? null
  const before = { durationSeconds: content.durationSeconds ?? null, winner: content.winner ?? null }
  return {
    text: [`Ván ${chapter.number} kết thúc`, won && `${name(won)} thắng`, `dài ${formatClock(length)}`]
      .filter(Boolean)
      .join(", "),
    apply: (current) => ({
      ...withPlayback(current, { durationSeconds: length }),
      ...(winner ? { winner } : {}),
    }),
    revert: (current) => ({
      ...current,
      durationSeconds: before.durationSeconds,
      ...(winner ? { winner: before.winner } : {}),
    }),
  }
}

/** Records the length of a game that has no place in a video. */
export function lengthChange(content: GameContent, seconds: number): RecordedChange {
  const before = content.durationSeconds ?? null
  return {
    text: `Ván ${content.number} dài ${formatClock(seconds)}`,
    apply: (current) => withPlayback(current, { durationSeconds: seconds }),
    revert: (current) => ({ ...current, durationSeconds: before }),
  }
}

export function winnerChange(content: GameContent, winner: Side | null, name: SideName = sideOfMap): RecordedChange {
  const before = content.winner ?? null
  const won = winner && name(winner)
  return {
    text: won
      ? `${won.charAt(0).toLocaleUpperCase("vi")}${won.slice(1)} thắng ván ${content.number}`
      : `Đã bỏ đội thắng ván ${content.number}`,
    apply: (current) => ({ ...current, winner }),
    revert: (current) => ({ ...current, winner: before }),
  }
}

/** Why a mark cannot be taken away: other marks hang on it. */
export function clearRefusal(content: GameContent, time: GameTime): string | null {
  if (time !== "draftStart") return null
  const draft = readDraft(content)
  if (draft.lockedSecond != null) return "Bỏ mốc chốt đội hình trước."
  return draft.turns.some((turn) => turn.atSecond != null) ? "Các lượt cấm chọn còn mốc trên video." : null
}

const CLEARED: Record<GameTime, string> = {
  draftStart: "bắt đầu cấm chọn",
  lock: "chốt đội hình",
  live: "vào trận",
  end: "kết thúc",
}

/** Takes a mark away. */
export function clearChange(content: GameContent, time: GameTime): RecordedChange {
  const draft = readDraft(content)
  const changes: Record<GameTime, [apply: ContentChange, revert: ContentChange]> = {
    draftStart: [
      (current) => setDraftTimes(current, { startSecond: null }),
      (current) => setDraftTimes(current, { startSecond: draft.startSecond ?? null }),
    ],
    lock: [
      (current) => setDraftTimes(current, { lockedSecond: null }),
      (current) => setDraftTimes(current, { lockedSecond: draft.lockedSecond ?? null }),
    ],
    live: [
      (current) => withPlayback(current, { startSecond: null }),
      (current) => withPlayback(current, { startSecond: content.sourceTimestampSeconds ?? null }),
    ],
    end: [
      (current) => ({ ...current, durationSeconds: null }),
      (current) => ({ ...current, durationSeconds: content.durationSeconds ?? null }),
    ],
  }
  const [apply, revert] = changes[time]
  return { text: `Đã bỏ mốc ${CLEARED[time]} ván ${content.number}`, apply, revert }
}
