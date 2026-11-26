import assert from "node:assert/strict"
import { test } from "node:test"
import type { GameChapter } from "../src/features/esports/model/series-vod"
import { timingIssues } from "../src/features/esports/model/timing-issues"

const game = (
  number: number,
  start: number,
  zero: number,
  length: number,
  extra: Partial<GameChapter> = {},
): GameChapter => ({
  gameId: `g${number}`,
  number,
  videoId: "j8AvYygkzm4",
  from: start,
  start: zero,
  end: zero + length,
  duration: length,
  synced: true,
  live: true,
  ended: true,
  draft: { start, locked: null, turns: [] },
  sync: { url: "", startSecond: zero, pauses: [] },
  winner: null,
  events: [],
  ...extra,
})
const told = (chapters: GameChapter[], duration: number | null = 13504) =>
  timingIssues(chapters, duration).map(
    (issue) => `${issue.gameId} ${issue.kind} ${issue.from}-${issue.to} ${issue.text}`,
  )

test("games that follow each other in the video have nothing to look at", () => {
  assert.deepEqual(told([game(1, 667, 1546, 883), game(2, 3154, 3718, 802), game(3, 5363, 5875, 596)]), [])
})

test("a game that begins before the one before it ends is told for both", () => {
  const text = "Cấm chọn ván 3 (▸1:13:20) bắt đầu trước khi ván 2 kết thúc (▸1:15:20)."
  assert.deepEqual(told([game(2, 3154, 3718, 802), game(3, 4400, 4900, 596)]), [
    `g2 overlap 4400-4520 ${text}`,
    `g3 overlap 4400-4520 ${text}`,
  ])
  const played = told([game(2, 3154, 3718, 802), game(3, 4400, 4400, 596, { draft: null })])
  assert.match(played[0]!, /Ván 3 \(▸1:13:20\) vào trận trước khi ván 2 kết thúc/)
})

test("an estimated end clashes with nothing, but what is recorded after the next game began does", () => {
  const open = game(2, 3154, 3718, 900, { ended: false })
  assert.deepEqual(told([open, game(3, 4400, 4900, 596)]), [])
  const late = { ...open, events: [{ id: "n", kind: "NOTE" as const, at: 800, title: "Steal" }] }
  assert.match(
    told([late, game(3, 4400, 4900, 596)])[0]!,
    /^g2 overlap 4400-4518 .* trước diễn biến cuối của ván 2 \(▸1:15:18\)\.$/,
  )
})

test("games out of order are told once for each, not as an overlap too", () => {
  const issues = timingIssues([game(1, 5000, 5400, 900), game(2, 3154, 3718, 802)], 13504)
  assert.deepEqual(
    issues.map((issue) => [issue.gameId, issue.kind]),
    [
      ["g1", "order"],
      ["g2", "order"],
    ],
  )
  assert.equal(issues[0]!.text, "Ván 2 (▸52:34) nằm trước ván 1 (▸1:23:20) trên video.")
})

test("a game longer than its video is told once the length of the video is known", () => {
  const last = game(6, 12900, 13000, 617)
  assert.deepEqual(told([last]), ["g6 length 13504-13617 Ván 6 dài hơn video."])
  assert.deepEqual(told([last], null), [])
  assert.deepEqual(told([game(6, 12900, 13000, 505)]), [], "a second more is how videos are measured")
})

test("a game without a place in the video clashes with nothing", () => {
  const elsewhere = game(2, 0, 0, 802, { from: 0, start: 0, end: 0, synced: false, live: false, draft: null })
  assert.deepEqual(told([game(1, 667, 1546, 883), elsewhere]), [])
})
