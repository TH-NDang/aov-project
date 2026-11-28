import assert from "node:assert/strict"
import { test } from "node:test"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { buildGameView } from "../src/features/esports/model/game-view"
import { retimeChange } from "../src/features/esports/model/retime"
import { layoutChapters } from "../src/features/esports/model/series-vod"
import type { RetimeTarget } from "../src/features/esports/model/broadcast-timeline"
import { completeGame, seat, view } from "./fixtures/match-records"

const VIDEO = "R5rCsGqDJIg"
const teams = [
  view("a", { code: "a", name: "Azure", shortName: "AZU" }),
  view("b", { code: "b", name: "Crimson", shortName: "CRI" }),
] as Parameters<typeof buildGameView>[1]

const complete = completeGame(1, "a")
/** 0:00 at 1000, a pause of a minute at 5:00, fifteen minutes long; a dragon at 6:21 and spells shown at 0:27. */
const entry: DocumentView<GameContent> = seat(
  {
    ...complete,
    content: {
      ...complete.content,
      sourceUrl: `https://youtu.be/${VIDEO}`,
      sourceTimestampSeconds: 1000,
      draft: {
        startSecond: 600,
        lockedSecond: 800,
        turns: [
          { order: 1, kind: "BAN", side: "BLUE", hero: { id: null, name: "Aoi" }, atSecond: 610 },
          { order: 2, kind: "PICK", side: "RED", hero: { id: null, name: "Yue" }, atSecond: 620 },
        ],
      },
      timeline: {
        pauses: [{ atSeconds: 300, durationSeconds: 60 }],
        events: [{ id: "o1", kind: "OBJECTIVE", atSeconds: 381, side: "RED", objective: "ABYSSAL_DRAGON" }],
      },
    },
  },
  "BLUE",
  "MID",
  { spellObservedAtSeconds: 27 },
)

const [chapter] = layoutChapters([entry], VIDEO)
const change = (target: RetimeTarget, second: number) =>
  retimeChange(chapter!, buildGameView(entry, teams, []), target, second)

/** The game after the change, and after the change was taken back. */
function applied(target: RetimeTarget, second: number) {
  const moved = change(target, second)!
  const after = moved.apply(entry.content)
  return { text: moved.text, after, back: moved.revert!(after) }
}

test("a dragged moment is told with both its game times and can be put back", () => {
  const { text, after, back } = applied({ kind: "event", gameId: "g1", id: "o1" }, 1450)
  assert.equal(text, "Đã dời Rồng của CRI: 6:21 → 6:30")
  assert.equal(after.timeline!.events[0]!.atSeconds, 390)
  assert.equal(back.timeline!.events[0]!.atSeconds, 381)
})

test("the edges of the ban/pick phase move on the video", () => {
  const start = applied({ kind: "draftStart", gameId: "g1" }, 590)
  assert.equal(start.text, "Đã dời lúc bắt đầu cấm chọn: ▸10:00 → ▸9:50")
  assert.deepEqual([start.after.draft!.startSecond, start.back.draft!.startSecond], [590, 600])
  assert.deepEqual(
    start.after.draft!.turns.map((turn) => [turn.order, turn.atSecond]),
    [
      [1, undefined],
      [2, undefined],
    ],
    "the seconds older turns held go with the move: turns keep their order only",
  )

  const lock = applied({ kind: "draftLock", gameId: "g1" }, 810)
  assert.equal(lock.text, "Đã dời lúc chốt đội hình: ▸13:20 → ▸13:30")
  assert.deepEqual([lock.after.draft!.lockedSecond, lock.back.draft!.lockedSecond], [810, 800])
})

test("moving 0:00 says that the moments of the game travel with it", () => {
  const { text, after, back } = applied({ kind: "gameStart", gameId: "g1" }, 1002)
  assert.equal(text, "Đã dời lúc vào trận: ▸16:40 → ▸16:42, diễn biến của ván dời theo")
  assert.deepEqual([after.sourceTimestampSeconds, back.sourceTimestampSeconds], [1002, 1000])
  assert.equal(after.timeline!.events[0]!.atSeconds, 381, "moments stay on the game clock")
})

test("moving the end changes the length on the game clock, whatever pauses lie before it", () => {
  const { text, after, back } = applied({ kind: "gameEnd", gameId: "g1" }, 1990)
  assert.equal(text, "Đã dời lúc kết thúc: ▸32:40 → ▸33:10, dài 15:30")
  assert.deepEqual([after.durationSeconds, back.durationSeconds], [930, 900])
})

test("a mark of what the video showed moves for every player it stands for", () => {
  const { text, after, back } = applied({ kind: "mark", gameId: "g1", side: "BLUE", part: "spell", at: 27 }, 1030)
  const observed = (content: GameContent) =>
    content.sides[0]!.participants.find((participant) => participant.lane === "MID")!.spellObservedAtSeconds
  assert.equal(text, "Đã dời lúc video hiện phụ trợ của AZU: 0:27 → 0:30")
  assert.deepEqual([observed(after), observed(back)], [30, 27])
})

test("a mark dropped where it was, or one that is gone, changes nothing", () => {
  assert.equal(change({ kind: "draftLock", gameId: "g1" }, 800), null)
  assert.equal(change({ kind: "event", gameId: "g1", id: "gone" }, 1200), null)
})

test("a moment dropped on its own second changes nothing", () => {
  assert.equal(change({ kind: "event", gameId: "g1", id: "o1" }, 1441.3), null, "6:21 lies at ▸24:01 after the pause")
})

test("a moment dropped between two seconds lands on the nearer one", () => {
  const { text, after } = applied({ kind: "event", gameId: "g1", id: "o1" }, 1450.6)
  assert.equal(text, "Đã dời Rồng của CRI: 6:21 → 6:31")
  assert.equal(after.timeline!.events[0]!.atSeconds, 391)
})

test("an end dropped on 0:00 or before it changes nothing", () => {
  assert.equal(change({ kind: "gameEnd", gameId: "g1" }, 990), null)
})

test("a game whose end is not recorded has no end to drop", () => {
  const open = { ...entry, content: { ...entry.content, durationSeconds: null } }
  const [running] = layoutChapters([open], VIDEO)
  assert.equal(retimeChange(running!, undefined, { kind: "gameEnd", gameId: "g1" }, 1990), null)
})

test("a ring dropped onto another is taken back without the players who stood there before", () => {
  const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const
  const seen = lanes.reduce(
    (game, lane, index) => seat(game, "BLUE", lane, { spellObservedAtSeconds: index < 3 ? 60 : 90 }),
    entry,
  )
  const [rings] = layoutChapters([seen], VIDEO)
  const ring: RetimeTarget = { kind: "mark", gameId: "g1", side: "BLUE", part: "spell", at: 60 }
  const moved = retimeChange(rings!, undefined, ring, 1090)!
  const observed = (content: GameContent) =>
    Object.fromEntries(content.sides[0]!.participants.map((player) => [player.lane, player.spellObservedAtSeconds]))
  const after = moved.apply(seen.content)
  assert.deepEqual(observed(after), { TOP: 90, JUNGLE: 90, MID: 90, DRAGON: 90, SUPPORT: 90 })
  assert.deepEqual(observed(moved.revert!(after)), { TOP: 60, JUNGLE: 60, MID: 60, DRAGON: 90, SUPPORT: 90 })
})
