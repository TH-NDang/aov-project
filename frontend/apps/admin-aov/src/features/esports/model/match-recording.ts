import type { DocumentView, GameContent, SeriesContent } from "@aov/community-contracts"
import { recordingProgress, type RecordingProgress } from "./recording-progress"
import { youtubeVideoId } from "./vod"

/**
 * `upcoming`: not played yet, nothing to record. `missing`: games, score, video or required game data are missing.
 * `unconfirmed`: everything is recorded but some games wait for confirmation. `complete`: every game is confirmed.
 */
export type MatchRecordingState = "upcoming" | "missing" | "unconfirmed" | "complete"
export type MatchGap = { text: string; kind: "missing" | "confirm"; gameId?: string }
export type MatchRecording = {
  state: MatchRecordingState
  /** Games the score says were played, when there is a score. */
  expected: number | null
  games: { id: string; number: number; progress: RecordingProgress }[]
  confirmed: number
  gaps: MatchGap[]
}

/** What one match still needs before its record is complete, in the order an admin would fix it. */
export function matchRecording(
  series: SeriesContent,
  games: DocumentView<GameContent>[],
  now = Date.now(),
): MatchRecording {
  const result = series.result
  const expected = result ? (result.scoreA ?? 0) + (result.scoreB ?? 0) : null
  const started = !!result || (!!series.scheduledAt && Date.parse(series.scheduledAt) <= now)
  const rows = [...games]
    .sort((a, b) => a.content.number - b.content.number)
    .map((entry) => ({ id: entry.id, number: entry.content.number, progress: recordingProgress(entry) }))
  const confirmed = rows.filter((row) => row.progress.state === "confirmed").length
  if (!started && !rows.length) return { state: "upcoming", expected, games: rows, confirmed, gaps: [] }

  const gaps: MatchGap[] = []
  if (!result) gaps.push({ text: "Chưa có tỉ số trận", kind: "missing" })
  if (expected != null && rows.length < expected)
    gaps.push({ text: `Thiếu ${expected - rows.length}/${expected} ván`, kind: "missing" })
  const video = games.some((entry) => youtubeVideoId(entry.content.sourceUrl)) || !!youtubeVideoId(series.sourceUrl)
  if (!video) gaps.push({ text: "Chưa gắn video", kind: "missing" })
  for (const row of rows) {
    const { progress } = row
    if (progress.state === "recording") {
      const needed = progress.steps.filter((step) => step.required && step.status !== "done")
      gaps.push({
        text: `Ván ${row.number}: thiếu ${needed.map((step) => step.label.toLocaleLowerCase("vi")).join(", ")}`,
        kind: "missing",
        gameId: row.id,
      })
    } else if (progress.state === "ready")
      gaps.push({ text: `Ván ${row.number} chờ xác nhận`, kind: "confirm", gameId: row.id })
    else if (progress.state === "changed")
      gaps.push({ text: `Ván ${row.number} có thay đổi chưa xác nhận`, kind: "confirm", gameId: row.id })
  }

  const state: MatchRecordingState = gaps.some((gap) => gap.kind === "missing")
    ? "missing"
    : gaps.length
      ? "unconfirmed"
      : "complete"
  return { state, expected, games: rows, confirmed, gaps }
}
