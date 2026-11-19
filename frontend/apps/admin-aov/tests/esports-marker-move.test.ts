import assert from "node:assert/strict"
import { test } from "node:test"
import type { RetimeTarget } from "../src/features/esports/model/broadcast-timeline"
import { buildGameView } from "../src/features/esports/model/game-view"
import { markerMove } from "../src/features/esports/model/marker-move"
import { layoutChapters } from "../src/features/esports/model/series-vod"
import { readTimeline } from "../src/features/esports/model/timeline-io"
import { VIDEO_MARK, youtubeVideoId } from "../src/features/esports/model/vod"
import * as data from "./fixtures/esports-data"

// Game 1 of the fixture final: ban/pick from 0:00 to the lock at 1:32 of the video, then live from 1:35.
const [chapter] = layoutChapters([data.game], youtubeVideoId(data.game.content.sourceUrl))
const view = buildGameView(data.game, data.teams, data.players)
const content = data.game.content
const gameId = data.GAME_ID
const move = (target: RetimeTarget, second: number) => markerMove(target, second, chapter!, view)!

test("a ban/pick turn moved on the bar names its hero and goes back to its old second", () => {
  const turn = move({ kind: "turn", gameId, order: 1 }, 20)
  assert.equal(turn.text, `Đã đổi giây · Lượt 1 · Eland'orr: ${VIDEO_MARK} 0:15 → 0:20`)
  const moved = turn.apply(content)!
  assert.equal(moved.draft!.turns[0]!.atSecond, 20)
  assert.equal(turn.revert(moved)!.draft!.turns[0]!.atSecond, 15)
})

test("the edges of the ban/pick phase move on the video", () => {
  const lock = move({ kind: "draftLock", gameId }, 90)
  assert.equal(lock.text, `Đã đổi giây · Chốt đội hình · Ván 1: ${VIDEO_MARK} 1:32 → 1:30`)
  assert.equal(lock.apply(content)!.draft!.lockedSecond, 90)
  assert.equal(lock.revert(lock.apply(content)!)!.draft!.lockedSecond, 92)

  const start = move({ kind: "draftStart", gameId }, 5)
  assert.equal(start.text, `Đã đổi giây · Bắt đầu cấm chọn · Ván 1: ${VIDEO_MARK} 0:00 → 0:05`)
  assert.equal(start.apply(content)!.draft!.startSecond, 5)
})

test("a moved game start takes the game's moments with it", () => {
  const start = move({ kind: "gameStart", gameId }, 100)
  assert.equal(start.text, `Đã đổi giây · Vào trận · Ván 1: ${VIDEO_MARK} 1:35 → 1:40 · sự kiện của ván dời theo`)
  assert.equal(start.apply(content)!.sourceTimestampSeconds, 100)
  assert.equal(start.revert(start.apply(content)!)!.sourceTimestampSeconds, 95)
})

test("a moment moved on the video is stored at its new second of the game clock", () => {
  const kill = move({ kind: "event", gameId, id: "fx-1" }, 200)
  assert.equal(kill.text, "Đã đổi giây · Hạ gục · Ván 1: ⏱ 1:35 → 1:45")
  const moved = kill.apply(content)!
  assert.equal(readTimeline(moved).find((event) => event.id === "fx-1")?.at, 105)
  assert.equal(readTimeline(kill.revert(moved)!).find((event) => event.id === "fx-1")?.at, 95)

  const note = move({ kind: "event", gameId, id: "fx-n1" }, 560)
  assert.equal(note.text, "Đã đổi giây · Giao tranh tổng ở hang Rồng · Ván 1: ⏱ 7:35 → 7:45")
})

test("a loadout mark moved on the video names the team and moves on the game clock", () => {
  const mark = move({ kind: "mark", gameId, side: "BLUE", part: "equipment", at: 360 }, 465)
  assert.equal(mark.text, "Đã đổi giây · Video hiện trang bị · AZT: ⏱ 6:00 → 6:10")
  const snapshots = (next: typeof content) =>
    next.sides[0]!.participants.find((participant) => participant.lane === "MID")!.equipmentSnapshots
  const moved = mark.apply(content)!
  assert.equal(snapshots(moved)[0]!.atSeconds, 370)
  assert.equal(snapshots(mark.revert(moved)!)[0]!.atSeconds, 360)
})

test("a marker dropped where it already is, or one the game does not hold, is no move", () => {
  const unchanged: [RetimeTarget, number][] = [
    [{ kind: "turn", gameId, order: 1 }, 15],
    [{ kind: "turn", gameId, order: 99 }, 15],
    [{ kind: "draftStart", gameId }, 0],
    [{ kind: "draftLock", gameId }, 92],
    [{ kind: "gameStart", gameId }, 95],
    [{ kind: "event", gameId, id: "fx-1" }, 190],
    [{ kind: "event", gameId, id: "missing" }, 300],
    [{ kind: "mark", gameId, side: "BLUE", part: "equipment", at: 360 }, 455],
  ]
  for (const [target, second] of unchanged)
    assert.equal(markerMove(target, second, chapter!, view), null, `${target.kind} at ${second}`)
})
