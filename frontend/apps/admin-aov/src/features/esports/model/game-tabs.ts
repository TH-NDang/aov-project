import type { DocumentView, GameContent, SeriesContent } from "@aov/community-contracts"
import { formatClock } from "@/lib/clock"
import type { GameView, TeamView } from "./game-view"
import type { RecordingProgress } from "./recording-progress"
import { missingGameNumbers, nextGameNumber } from "./series-score"
import type { GameChapter } from "./series-vod"
import type { TimingIssue } from "./timing-issues"
import { youtubeVideoId } from "./vod"

/** What a tab of a game draws beside its number, the most pressing first; nothing for a published, unchanged game. */
export type GameMark = "attention" | "unplaced" | "recording" | "ready"
export type GameTab = {
  id: string
  number: number
  winner: TeamView | null
  mark: GameMark | null
  /** What a screen reader says: the game, who won it, how long it took and its mark in words. */
  name: string
}

const ISSUE_WORDS: Record<TimingIssue["kind"], string> = {
  overlap: "mốc video chồng ván khác",
  order: "mốc video sai thứ tự",
  length: "dài hơn video",
}

/** Whether a game has its place in the video it points to, whichever video is on screen. */
const isPlaced = (content: GameContent) =>
  !!youtubeVideoId(content.sourceUrl) && (content.sourceTimestampSeconds != null || content.draft?.startSecond != null)

export function gameTabs(
  games: readonly DocumentView<GameContent>[],
  chapters: readonly GameChapter[],
  views: Readonly<Record<string, GameView | undefined>>,
  progressOf: Readonly<Record<string, RecordingProgress | undefined>>,
  issues: readonly TimingIssue[],
  hasVideo: boolean,
): GameTab[] {
  return chapters.map((chapter) => {
    const entry = games.find((game) => game.id === chapter.gameId)
    const view = views[chapter.gameId]
    const progress = progressOf[chapter.gameId]
    const winner = chapter.winner && view ? view.sides[chapter.winner].team : null
    const own = issues.filter((issue) => issue.gameId === chapter.gameId)
    const changed = progress?.state === "changed"
    const unplaced = hasVideo && !!entry && !isPlaced(entry.content)
    const mark: GameMark | null =
      changed || own.length
        ? "attention"
        : unplaced
          ? "unplaced"
          : progress?.state === "recording"
            ? "recording"
            : progress?.state === "ready"
              ? "ready"
              : null
    const words = [
      `Ván ${chapter.number}`,
      winner && `${winner.shortName} thắng`,
      view?.durationSeconds != null && formatClock(view.durationSeconds),
      changed && "đã sửa sau khi xuất bản",
      ...new Set(own.map((issue) => ISSUE_WORDS[issue.kind])),
      unplaced && "chưa đặt mốc trên video",
      progress?.state === "recording" && `đang ghi, ${progress.done} trên ${progress.total} mục`,
      progress?.state === "ready" && "đủ dữ liệu, chờ xuất bản",
      progress?.state === "confirmed" && "đã xuất bản",
    ]
    return { id: chapter.gameId, number: chapter.number, winner, mark, name: words.filter(Boolean).join(", ") }
  })
}

/**
 * The numbers a new game can take, the first one to be recorded next: those the score names and nobody recorded, or the
 * next one while the match has no score that says how many were played.
 */
export function openNumbers(
  series: SeriesContent,
  games: Parameters<typeof missingGameNumbers>[1],
  canAdd: boolean,
): number[] {
  const missing = missingGameNumbers(series, games)
  if (missing.length) return missing
  return canAdd && !series.result ? [nextGameNumber(games)] : []
}
