import { formatClock } from "@/lib/clock"
import { knownEnd, type GameChapter } from "./series-vod"

/** Times of games on the video that cannot all be right; `from` and `to` are the video seconds they clash in. */
export type TimingIssue = {
  gameId: string
  kind: "overlap" | "order" | "length"
  from: number
  to: number
  text: string
}

const at = (second: number) => `(▸${formatClock(second)})`

/** YouTube reports whole seconds and a game may end with the video, so a small excess is no mistake. */
const LENGTH_SLACK = 2

/** What begins first of a game, as the subject of a sentence. */
const beginning = (chapter: GameChapter) =>
  chapter.draft
    ? `Cấm chọn ván ${chapter.number} ${at(chapter.from)} bắt đầu`
    : `Ván ${chapter.number} ${at(chapter.from)} vào trận`

/** What ends last of a game that is recorded, as the object of the sentence. */
function reach(chapter: GameChapter) {
  if (!chapter.live) return `khi ván ${chapter.number} cấm chọn xong ${at(knownEnd(chapter))}`
  return chapter.ended
    ? `khi ván ${chapter.number} kết thúc ${at(chapter.end)}`
    : `diễn biến cuối của ván ${chapter.number} ${at(knownEnd(chapter))}`
}

/**
 * Games whose times contradict each other or the video. A clash is reported for both games, because either may be the
 * one recorded wrongly; only recorded seconds count, never an estimated end.
 */
export function timingIssues(chapters: GameChapter[], videoDuration: number | null): TimingIssue[] {
  const placed = chapters.filter((chapter) => chapter.synced)
  const issues: TimingIssue[] = []
  const both = (first: GameChapter, second: GameChapter, issue: Omit<TimingIssue, "gameId">) =>
    issues.push({ gameId: first.gameId, ...issue }, { gameId: second.gameId, ...issue })

  placed.forEach((first, index) => {
    for (const second of placed.slice(index + 1)) {
      if (second.from < first.from)
        both(first, second, {
          kind: "order",
          from: second.from,
          to: Math.max(second.from, knownEnd(second)),
          text: `Ván ${second.number} ${at(second.from)} nằm trước ván ${first.number} ${at(first.from)} trên video.`,
        })
      else if (second.from < knownEnd(first))
        both(first, second, {
          kind: "overlap",
          from: second.from,
          to: knownEnd(first),
          text: `${beginning(second)} trước ${reach(first)}.`,
        })
    }
    if (videoDuration !== null && knownEnd(first) > videoDuration + LENGTH_SLACK)
      issues.push({
        gameId: first.gameId,
        kind: "length",
        from: Math.min(videoDuration, knownEnd(first)),
        to: knownEnd(first),
        text: `Ván ${first.number} dài hơn video.`,
      })
  })
  return issues
}
