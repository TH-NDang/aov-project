import assert from "node:assert/strict"
import { test } from "node:test"
import type { GameContent } from "@aov/community-contracts"
import {
  clearChange,
  clearRefusal,
  endChange,
  lastRecorded,
  lengthRefusal,
  timeChange,
  timeRefusal,
  winnerChange,
  type GameTime,
} from "../src/features/esports/model/game-times"
import { layoutChapters } from "../src/features/esports/model/series-vod"
import { VIDEO, VIDEO_URL, emptyGame, recordedGame, selection } from "./fixtures/esports-desk"
import { view } from "./fixtures/match-records"

const chapterOf = (content: GameContent) => layoutChapters([view("g2", content)], VIDEO)[0]!
const refusal = (content: GameContent, time: GameTime, second: number, next: { from: number } | null = null) =>
  timeRefusal(content, chapterOf(content), time, second, next)

const turn = (order: number, atSecond: number | null) => ({
  order,
  kind: "BAN" as const,
  side: order % 2 ? ("BLUE" as const) : ("RED" as const),
  hero: selection(`Hero ${order}`),
  atSecond,
})
const drafted = recordedGame({
  draft: { startSecond: 3154, lockedSecond: 3490, turns: [turn(1, 3166), turn(2, null), turn(3, 3193)] },
})

test("the draft starts before the lock and the game; an older second on a turn does not hold it", () => {
  assert.equal(refusal(drafted, "draftStart", 3166), null)
  assert.equal(refusal(drafted, "draftStart", 3200), null)
  const untimed = recordedGame()
  assert.match(refusal(untimed, "draftStart", 3491)!, /trước lúc chốt đội hình \(▸58:10\)/)
  const unlocked = recordedGame({ draft: { startSecond: 3154, lockedSecond: null, turns: [] } })
  assert.match(refusal(unlocked, "draftStart", 3719)!, /trước lúc vào trận \(▸1:01:58\)/)
})

test("the lock needs a draft start and lies between it and the game", () => {
  assert.equal(refusal(emptyGame(), "lock", 10), "Đặt lúc bắt đầu cấm chọn trước.")
  assert.equal(refusal(drafted, "lock", 3192), null)
  assert.match(refusal(drafted, "lock", 3719)!, /trước lúc vào trận/)
})

test("a game goes live after its draft, with its length still clear of the next game", () => {
  assert.match(refusal(drafted, "live", 3489)!, /sau màn cấm chọn \(▸58:10\)/)
  assert.equal(refusal(drafted, "live", 3490), null)
  assert.equal(refusal(drafted, "live", 4560, { from: 5363 }), null)
  assert.match(refusal(drafted, "live", 4561, { from: 5363 })!, /Ván dài 13:22 sẽ lấn sang ván sau/)
})

test("a game ends after its 0:00 and after everything recorded, before the next game", () => {
  const moment = recordedGame({
    timeline: { pauses: [], events: [{ id: "o", atSeconds: 794, kind: "OBJECTIVE", side: "RED", objective: "BASE" }] },
  })
  assert.equal(refusal(emptyGame(), "end", 100), "Đặt lúc vào trận trước.")
  assert.match(refusal(moment, "end", 3718)!, /sau lúc vào trận/)
  assert.equal(refusal(moment, "end", 3718 + 793), "Ván đã ghi tới 13:14, sau mốc này.")
  assert.equal(refusal(moment, "end", 3718 + 794), null)
  assert.match(refusal(moment, "end", 5363, { from: 5363 })!, /Ván sau đã bắt đầu ở ▸1:29:23/)
})

test("what a broadcast showed and what a player built count as recorded too", () => {
  const content = recordedGame()
  const participant = content.sides[0]!.participants[0]!
  const withSeat = (change: Partial<typeof participant>) => ({
    ...content,
    sides: [
      {
        ...content.sides[0]!,
        participants: [{ ...participant, ...change }, ...content.sides[0]!.participants.slice(1)],
      },
      content.sides[1]!,
    ],
  })
  assert.equal(lastRecorded(content), 0)
  assert.equal(lastRecorded(withSeat({ spellObservedAtSeconds: 12 })), 12)
  assert.equal(lastRecorded(withSeat({ equipmentSnapshots: [{ atSeconds: 640, slots: [] }] })), 640)
  assert.equal(
    lastRecorded(withSeat({ build: [{ item: selection("Gươm Loki"), place: "KEPT", atSeconds: 700 }] })),
    700,
  )
  assert.match(lengthRefusal(withSeat({ spellObservedAtSeconds: 12 }), 11)!, /Ván đã ghi tới 0:12/)
})

test("a pause of the broadcast counts as recorded too", () => {
  const paused = { ...recordedGame(), timeline: { pauses: [{ atSeconds: 700, durationSeconds: 60 }], events: [] } }
  assert.equal(lastRecorded(paused), 700)
})

test("a first mark is said as what happened, a moved one with both its seconds", () => {
  const empty = emptyGame()
  assert.equal(timeChange(empty, chapterOf(empty), "draftStart", 3154).text, "Ván 2 bắt đầu cấm chọn lúc ▸52:34")
  assert.equal(timeChange(drafted, chapterOf(drafted), "lock", 3500).text, "Đã dời lúc chốt đội hình: ▸58:10 → ▸58:20")
  const ready = recordedGame({ sourceTimestampSeconds: undefined, durationSeconds: null })
  assert.equal(timeChange(ready, chapterOf(ready), "live", 3718).text, "Ván 2 vào trận lúc ▸1:01:58")
})

test("moving 0:00 says that the moments of the game go with it", () => {
  const content = recordedGame({
    timeline: { pauses: [], events: [{ id: "o", atSeconds: 10, kind: "OBJECTIVE", side: "RED", objective: "TURRET" }] },
  })
  assert.equal(
    timeChange(content, chapterOf(content), "live", 3720).text,
    "Đã dời lúc vào trận: ▸1:01:58 → ▸1:02:00, diễn biến của ván dời theo",
  )
})

test("a mark taken back leaves the game as it was", () => {
  for (const [time, second] of [
    ["draftStart", 3150],
    ["lock", 3500],
    ["live", 3720],
    ["end", 4500],
  ] as const) {
    const change = timeChange(drafted, chapterOf(drafted), time, second)
    const back = change.revert!(change.apply(drafted))
    assert.equal(back.draft?.startSecond, 3154, time)
    assert.equal(back.draft?.lockedSecond, 3490, time)
    assert.equal(back.sourceTimestampSeconds, 3718, time)
    assert.equal(back.durationSeconds, 802, time)
  }
})

test("a game without a video takes the link of the video its mark was read from, and gives it back", () => {
  const empty = emptyGame({ sourceUrl: "https://example.test/match" })
  const change = timeChange(empty, chapterOf(empty), "draftStart", 3154, VIDEO_URL)
  const next = change.apply(empty)
  assert.equal(next.sourceUrl, VIDEO_URL)
  assert.equal(change.revert!(next).sourceUrl, "https://example.test/match")
})

test("a game that has a video keeps it", () => {
  const change = timeChange(drafted, chapterOf(drafted), "lock", 3500, "https://youtu.be/R5rCsGqDJIg")
  assert.equal(change.apply(drafted).sourceUrl, VIDEO_URL)
})

test("the end of a game writes its length on the game clock, and the winner pressed with it", () => {
  const open = recordedGame({
    durationSeconds: null,
    winner: null,
    timeline: { pauses: [{ atSeconds: 300, durationSeconds: 60 }], events: [] },
  })
  const chapter = chapterOf(open)
  const change = endChange(open, chapter, 3718 + 860, "RED", (side) => (side === "RED" ? "BME" : "SGP"))
  assert.equal(change.text, "Ván 2 kết thúc, BME thắng, dài 13:20")
  const next = change.apply(open)
  assert.deepEqual([next.durationSeconds, next.winner], [800, "RED"], "a minute of it was a pause")
  const back = change.revert!(next)
  assert.deepEqual([back.durationSeconds, back.winner], [null, null])
})

test("ending a game leaves a winner recorded before alone", () => {
  const open = recordedGame({ durationSeconds: null })
  const change = endChange(open, chapterOf(open), 4520, null)
  assert.equal(change.text, "Ván 2 kết thúc, bên đỏ thắng, dài 13:22")
  const next = change.apply(open)
  assert.equal(change.revert!({ ...next, winner: "BLUE" }).winner, "BLUE", "another change of the winner stays")
})

test("a winner can be set, taken off and put back", () => {
  const content = recordedGame()
  const set = winnerChange(content, "BLUE", (side) => (side === "BLUE" ? "SGP" : "BME"))
  assert.equal(set.text, "SGP thắng ván 2")
  assert.equal(set.revert!(set.apply(content)).winner, "RED")
  const off = winnerChange(content, null)
  assert.equal(off.text, "Đã bỏ đội thắng ván 2")
  assert.equal(off.apply(content).winner, null)
})

test("the draft start stays while the lock hangs on it", () => {
  assert.equal(clearRefusal(drafted, "draftStart"), "Bỏ mốc chốt đội hình trước.")
  const unlocked = { ...drafted, draft: { ...drafted.draft!, lockedSecond: null } }
  assert.equal(clearRefusal(unlocked, "draftStart"), null)
  assert.equal(
    clearRefusal(recordedGame({ draft: { startSecond: 5, lockedSecond: null, turns: [] } }), "draftStart"),
    null,
  )
})

test("a mark taken away can be put back", () => {
  const read = (content: GameContent) => [
    content.draft?.startSecond,
    content.draft?.lockedSecond,
    content.sourceTimestampSeconds,
    content.durationSeconds,
  ]
  for (const time of ["draftStart", "lock", "live", "end"] as const) {
    const change = clearChange(drafted, time)
    const cleared = change.apply(drafted)
    assert.equal(read(cleared).filter((value) => value == null).length, 1, time)
    assert.deepEqual(read(change.revert!(cleared)), read(drafted), time)
  }
})
