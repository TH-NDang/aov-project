import assert from "node:assert/strict"
import { test } from "node:test"
import type { DocumentView, DraftTurn, GameContent } from "@aov/community-contracts"
import { DRAFT_ORDER } from "../src/features/esports/model/draft"
import { buildGameView } from "../src/features/esports/model/game-view"
import { chapterAfter, nextStep, type NextStep, type NextStepInput } from "../src/features/esports/model/next-step"
import { placeAt } from "../src/features/esports/model/playback-place"
import { recordingProgress } from "../src/features/esports/model/recording-progress"
import { layoutChapters } from "../src/features/esports/model/series-vod"
import { completeGame, game, seat, view } from "./fixtures/match-records"

const VIDEO = "R5rCsGqDJIg"
const LENGTH = 13_504

/** Teams as the desk names them: Azure plays blue, Crimson red. */
const teams = [
  view("a", { code: "a", name: "Azure", shortName: "AZU" }),
  view("b", { code: "b", name: "Crimson", shortName: "CRI" }),
] as Parameters<typeof buildGameView>[1]

/** The game on the video of the match, with more of it recorded. */
const on = (entry: DocumentView<GameContent>, change: Partial<GameContent> = {}) => ({
  ...entry,
  content: { ...entry.content, sourceUrl: `https://youtu.be/${VIDEO}`, ...change },
})

/** The first turns of a draft, one every ten seconds. */
const turns = (count: number, start: number): DraftTurn[] =>
  DRAFT_ORDER.slice(0, count).map((turn, index) => ({
    ...turn,
    order: index + 1,
    hero: { id: null, name: `hero ${index}` },
    atSecond: start + (index + 1) * 10,
  }))

type Desk = Partial<Omit<NextStepInput, "place" | "chapters" | "game">> & {
  games: DocumentView<GameContent>[]
  /** Number of the game on the desk; none when a number nobody recorded is. */
  shown?: number
}

function step({ games, shown, at = 0, video = true, ...rest }: Desk) {
  const chapters = layoutChapters(games, video ? VIDEO : null)
  const entry = games.find((candidate) => candidate.content.number === shown)
  const chapter = chapters.find((candidate) => candidate.number === shown)
  return nextStep({
    recording: true,
    busy: false,
    tool: "moments",
    video,
    empty: !games.length,
    at,
    duration: LENGTH,
    place: placeAt(chapters, at),
    chapters,
    missing: null,
    toRecord: null,
    game:
      entry && chapter
        ? { content: entry.content, chapter, progress: recordingProgress(entry), view: buildGameView(entry, teams, []) }
        : null,
    waiting: 0,
    canPublish: true,
    ...rest,
  })
}

/** What the buttons read, with the second one names behind it. */
const words = (found: NextStep | null) =>
  found?.buttons.map(({ label, second }) => (second === null ? label : `${label} ▸${second}`)) ?? null
const refusals = (found: NextStep | null) => found?.buttons.map(({ refusal }) => refusal) ?? null
const actions = (found: NextStep | null) => found?.buttons.map(({ action }) => action) ?? null

const started = on(game(1), { draft: { startSecond: 600, lockedSecond: null, turns: turns(10, 600) } })
const drafted = on(game(1), { draft: { startSecond: 600, lockedSecond: null, turns: turns(18, 600) } })
const locked = on(game(1), { draft: { startSecond: 600, lockedSecond: 800, turns: turns(18, 600) } })
const live = on(locked, { sourceTimestampSeconds: 1000 })
/** Everything is recorded: 0:00 at 1000, the end at 1900. */
const complete = on(completeGame(1, "a"), { sourceTimestampSeconds: 1000, draft: locked.content.draft })

test("viewing has no next step", () => {
  assert.equal(step({ games: [started], shown: 1, recording: false }), null)
})

test("an open form or panel has its own button, so the foot has none", () => {
  assert.equal(step({ games: [started], shown: 1, busy: true }), null)
})

test("a match without a video and without a game asks for nothing in the foot", () => {
  assert.equal(step({ games: [], video: false, toRecord: 1 }), null)
})

test("a match with a video and without a game starts its first draft at the playhead", () => {
  const found = step({ games: [], at: 667, toRecord: 1 })
  assert.deepEqual(words(found), ["Cấm chọn ván 1 ▸667"])
  assert.deepEqual(actions(found), [{ kind: "create", number: 1, second: 667 }])
})

test("a chosen number starts its draft at the playhead", () => {
  assert.deepEqual(words(step({ games: [complete], at: 3154, missing: 3, toRecord: 2 })), ["Cấm chọn ván 3 ▸3154"])
})

test("a draft cannot start inside another game", () => {
  assert.deepEqual(refusals(step({ games: [live], at: 1200, missing: 2, toRecord: 2 })), [
    "Đang trong ván 1: kết thúc ván 1 hoặc tua ra ngoài ván.",
  ])
})

test("without a video a chosen number is added as an empty game", () => {
  const found = step({ games: [completeGame(1, "a")], video: false, missing: 2, toRecord: 2 })
  assert.deepEqual(words(found), ["Thêm ván 2"])
  assert.deepEqual(actions(found), [{ kind: "create", number: 2, second: null }])
})

test("a game without a draft and without heroes starts its draft", () => {
  const found = step({ games: [on(game(1))], shown: 1, at: 667 })
  assert.deepEqual(words(found), ["Bắt đầu cấm chọn ▸667"])
  assert.deepEqual(actions(found), [{ kind: "time", time: "draftStart", second: 667 }])
})

test("a started draft names its next turn and leads to the draft", () => {
  const found = step({ games: [started], shown: 1, at: 720 })
  assert.deepEqual(words(found), ["Lượt 11, CRI cấm"])
  assert.deepEqual(actions(found), [{ kind: "tool", tool: "draft" }])
})

test("while the draft is on the desk its turns need no button, and no later step is offered instead", () => {
  assert.equal(step({ games: [started], shown: 1, at: 720, tool: "draft", waiting: 2 }), null)
})

test("eighteen turns lead to the lock", () => {
  assert.deepEqual(words(step({ games: [drafted], shown: 1, at: 900, tool: "draft" })), ["Chốt đội hình ▸900"])
})

test("the lock is refused before the last turn, and the button says why", () => {
  assert.match(refusals(step({ games: [drafted], shown: 1, at: 700 }))?.[0] ?? "", /sau lượt 18/)
})

test("a locked draft leads to 0:00, refused before the lock", () => {
  assert.deepEqual(words(step({ games: [locked], shown: 1, at: 1000 })), ["Vào trận ván 1 ▸1000"])
  assert.equal(refusals(step({ games: [locked], shown: 1, at: 1000 }))?.[0], null)
  assert.ok(refusals(step({ games: [locked], shown: 1, at: 790 }))?.[0])
})

test("a game whose heroes are known without turns leads to 0:00", () => {
  const imported = on(completeGame(1, "a"), { durationSeconds: null, winner: null })
  assert.deepEqual(words(step({ games: [imported], shown: 1, at: 1000 })), ["Vào trận ván 1 ▸1000"])
})

test("a live game ends with its winner in one press, with the end alone as the step of the key", () => {
  const found = step({ games: [live], shown: 1, at: 1900 })
  assert.deepEqual(words(found), ["AZU thắng", "Kết thúc ▸1900", "CRI thắng"])
  assert.deepEqual(actions(found), [
    { kind: "end", second: 1900, winner: "BLUE" },
    { kind: "end", second: 1900, winner: null },
    { kind: "end", second: 1900, winner: "RED" },
  ])
  assert.deepEqual([found?.outlined, found?.lead], [true, 1])
})

test("a game cannot end before a moment that is recorded in it", () => {
  const late = on(live, {
    timeline: { pauses: [], events: [{ id: "m", kind: "NOTE", atSeconds: 800, title: "late" }] },
  })
  assert.deepEqual(
    refusals(step({ games: [late], shown: 1, at: 1500 }))?.map((why) => !!why),
    [true, true, true],
  )
})

test("a live game whose winner is known asks for its end alone", () => {
  const found = step({ games: [on(live, { winner: "RED" })], shown: 1, at: 1900 })
  assert.deepEqual(words(found), ["Kết thúc ván 1 ▸1900"])
  assert.equal(found?.outlined, false)
})

test("an ended game without a winner asks for it, and the key presses neither answer", () => {
  const found = step({ games: [on(live, { durationSeconds: 900 })], shown: 1, at: 1950 })
  assert.deepEqual(words(found), ["AZU thắng", "CRI thắng"])
  assert.deepEqual(actions(found)?.[1], { kind: "winner", winner: "RED" })
  assert.equal(found?.lead, null)
})

test("the break after a game is skipped while a game is still to be recorded", () => {
  const found = step({ games: [complete], shown: 1, at: 1900, toRecord: 2 })
  assert.deepEqual(words(found), ["Bỏ qua 6 phút nghỉ ▸2260"])
  assert.deepEqual(actions(found), [{ kind: "skip", second: 2260 }])
})

test("the break is offered for a minute, then the draft of the next game", () => {
  assert.deepEqual(words(step({ games: [complete], shown: 1, at: 1960, toRecord: 2 })), ["Bỏ qua 6 phút nghỉ ▸2260"])
  assert.deepEqual(words(step({ games: [complete], shown: 1, at: 1961, toRecord: 2 })), ["Cấm chọn ván 2 ▸1961"])
})

test("a break that would run past the video is not skipped", () => {
  const found = step({ games: [complete], shown: 1, at: 1910, toRecord: 2, duration: 2200 })
  assert.deepEqual(words(found), ["Cấm chọn ván 2 ▸1910"])
})

test("a break is not skipped into a game that is recorded", () => {
  const next = on(game(3), { sourceTimestampSeconds: 2100, durationSeconds: 600 })
  const found = step({ games: [complete, next], shown: 1, at: 1910, toRecord: 2 })
  assert.deepEqual(words(found), ["Cấm chọn ván 2 ▸1910"])
})

test("inside a game that lacks nothing the next game is not offered", () => {
  assert.equal(step({ games: [complete], shown: 1, at: 1500, toRecord: 2 }), null)
})

test("the game after one without a place is the first that begins after the playhead, not one that begins on it", () => {
  const placed = (number: number, start: number) =>
    on(game(number), { sourceTimestampSeconds: start, durationSeconds: 600 })
  const chapters = layoutChapters([on(game(2)), placed(3, 2100), placed(4, 3000)], VIDEO)
  const unplaced = chapters.find((chapter) => chapter.number === 2)!
  assert.equal(chapterAfter(chapters, unplaced, 2099)?.number, 3)
  assert.equal(chapterAfter(chapters, unplaced, 2100)?.number, 4)
})

test("what the game on the desk lacks leads to the part that records it", () => {
  const withoutSpell = seat(complete, "RED", "TOP", { spell: { id: null, name: null } })
  const found = step({ games: [withoutSpell], shown: 1, at: 1500 })
  assert.deepEqual(words(found), ["Phụ trợ 9/10"])
  assert.deepEqual(actions(found), [{ kind: "tool", tool: "lineup", target: { part: "spell" } }])
})

test("a gap has no button while the part that records it is on the desk", () => {
  const withoutSpell = seat(complete, "RED", "TOP", { spell: { id: null, name: null } })
  assert.equal(step({ games: [withoutSpell], shown: 1, at: 1500, tool: "lineup", waiting: 2 }), null)
})

test("missing players lead to the line-ups, not to the draft", () => {
  const withoutPlayer = seat(complete, "RED", "TOP", { playerId: null })
  assert.deepEqual(actions(step({ games: [withoutPlayer], shown: 1, at: 1500 })), [
    { kind: "tool", tool: "lineup", target: undefined },
  ])
})

const publishedAt = "2026-09-02T00:00:00Z"
const published = { ...on(completeGame(1, "a")), publishedAt, updatedAt: publishedAt }

test("a published game that is unchanged is never asked for its times", () => {
  assert.equal(step({ games: [published], shown: 1, at: 1000 }), null)
})

test("a published game is still asked for what it lacks", () => {
  const lacking = { ...seat(published, "RED", "TOP", { spell: { id: null, name: null } }), publishedAt }
  assert.deepEqual(words(step({ games: [lacking], shown: 1, at: 1000 })), ["Phụ trợ 9/10"])
})

test("without a video the next game is added once the one on the desk lacks nothing", () => {
  assert.deepEqual(words(step({ games: [completeGame(1, "a")], shown: 1, video: false, toRecord: 2 })), ["Thêm ván 2"])
})

test("games that wait are published last, by an account that may publish", () => {
  const found = step({ games: [complete], shown: 1, at: 1500, waiting: 6 })
  assert.deepEqual(words(found), ["Xuất bản 6 ván"])
  assert.deepEqual(actions(found), [{ kind: "publish" }])
  assert.equal(step({ games: [complete], shown: 1, at: 1500, waiting: 6, canPublish: false }), null)
})

test("a match that lacks nothing has no next step", () => {
  assert.equal(step({ games: [complete], shown: 1, at: 1500 }), null)
})
