import assert from "node:assert/strict"
import { test } from "node:test"
import { broadcastChapters, retimeRange, videoTimelineEvents } from "../src/features/esports/model/broadcast-timeline"
import {
  axisLength,
  broadcastEvents,
  chapterAt,
  chapterClock,
  chapterVideo,
  gameLength,
  layoutChapters,
  seriesVideo,
  sourceOf,
  stripRange,
} from "../src/features/esports/model/series-vod"
import { type TimelineEvent } from "../src/features/esports/model/timeline"
import { moveEvent } from "../src/features/esports/model/timeline-io"
import { gameToVideo, videoToGame, youtubeLinkTime, youtubeVideoId } from "../src/features/esports/model/vod"
import { formatClock, parseClock } from "@/lib/clock"
import { completeGame, seat } from "./fixtures/match-records"

test("YouTube links are parsed strictly and keep their start time", () => {
  assert.equal(youtubeVideoId("https://youtu.be/R5rCsGqDJIg?si=abc"), "R5rCsGqDJIg")
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=R5rCsGqDJIg&t=90"), "R5rCsGqDJIg")
  assert.equal(youtubeVideoId("https://www.youtube.com/live/R5rCsGqDJIg"), "R5rCsGqDJIg")
  assert.equal(youtubeVideoId("http://www.youtube.com/watch?v=R5rCsGqDJIg"), null)
  assert.equal(youtubeVideoId("https://evil.example/watch?v=R5rCsGqDJIg"), null)
  assert.equal(youtubeLinkTime("https://youtu.be/R5rCsGqDJIg?t=1h02m03s"), 3723)
  assert.equal(youtubeLinkTime("https://www.youtube.com/watch?v=R5rCsGqDJIg&t=754s"), 754)
  assert.equal(youtubeLinkTime("https://youtu.be/R5rCsGqDJIg"), null)
})

test("broadcast events use absolute video seconds without changing stored game seconds", () => {
  const source: TimelineEvent[] = [
    { id: "before", kind: "NOTE", at: 240, title: "Before pause" },
    { id: "after", kind: "NOTE", at: 640, title: "After pause" },
  ]
  const sync = { url: "", startSecond: 95, pauses: [{ atSeconds: 610, durationSeconds: 95 }] }
  assert.deepEqual(
    videoTimelineEvents(sync, source).map((event) => event.at),
    [335, 830],
  )
  assert.deepEqual(
    source.map((event) => event.at),
    [240, 640],
  )
  assert.deepEqual(videoTimelineEvents({ ...sync, startSecond: null }, source), [])
})

test("broadcast chapters include match and game starts only for the same video", () => {
  const url = "https://youtu.be/R5rCsGqDJIg"
  const games = [
    { id: "g2", content: { number: 2, sourceUrl: url, sourceTimestampSeconds: 1800 } },
    { id: "g1", content: { number: 1, sourceUrl: url, sourceTimestampSeconds: 95 } },
    { id: "g3", content: { number: 3, sourceUrl: "https://youtu.be/abcdefghijk", sourceTimestampSeconds: 3000 } },
    { id: "g4", content: { number: 4, sourceUrl: url } },
  ]
  assert.deepEqual(broadcastChapters("R5rCsGqDJIg", `${url}?t=30`, games), [
    { id: "match-start", at: 30, label: "Bắt đầu trận" },
    { id: "g1", at: 95, label: "Vào trận ván 1" },
    { id: "g2", at: 1800, label: "Vào trận ván 2" },
  ])
  assert.deepEqual(broadcastChapters("R5rCsGqDJIg", url, games), [
    { id: "g1", at: 95, label: "Bắt đầu trận, vào trận ván 1" },
    { id: "g2", at: 1800, label: "Vào trận ván 2" },
  ])
})

test("game and video clocks stay aligned across broadcast pauses", () => {
  const sync = { url: "", startSecond: 3600, pauses: [{ atSeconds: 300, durationSeconds: 120 }] }
  assert.equal(gameToVideo(sync, 0), 3600)
  assert.equal(gameToVideo(sync, 300), 3900)
  assert.equal(gameToVideo(sync, 301), 4021)
  assert.equal(videoToGame(sync, 3500), 0)
  assert.equal(videoToGame(sync, 3950), 300)
  assert.equal(videoToGame(sync, 4021), 301)
  assert.equal(videoToGame({ ...sync, startSecond: null }, 4000), null)
  assert.equal(formatClock(3723), "1:02:03")
  assert.equal(formatClock(75), "1:15")
  assert.equal(parseClock("1:02:03"), 3723)
  assert.equal(parseClock("12:75"), null)
})

const url = "https://youtu.be/R5rCsGqDJIg"
const game = (id: string, number: number, extra: Record<string, unknown>) => ({
  id,
  version: 1,
  createdAt: "",
  updatedAt: "",
  missingFields: [],
  content: { seriesId: "s", number, region: "VN", locale: "vi-VN", sides: [], ...extra },
})

test("games of one broadcast become chapters on the video axis; a game without a place in the video has none", () => {
  const games = [
    game("g2", 2, { sourceUrl: url, sourceTimestampSeconds: 2400, durationSeconds: 900 }),
    game("g1", 1, {
      sourceUrl: url,
      sourceTimestampSeconds: 600,
      durationSeconds: 1200,
      winner: "RED",
      timeline: {
        pauses: [{ atSeconds: 300, durationSeconds: 60 }],
        events: [{ id: "k", atSeconds: 400, kind: "KILL", killer: { side: "RED", lane: "MID" }, assists: [] }],
      },
    }),
    game("g3", 3, { durationSeconds: 1000, sourceUrl: "https://youtu.be/abcdefghijk", sourceTimestampSeconds: 60 }),
  ]
  assert.deepEqual(seriesVideo({ code: "s", tournamentId: "t", teamAId: "a", teamBId: "b", bestOf: 5 }, games), {
    videoId: "R5rCsGqDJIg",
    url,
  })
  const chapters = layoutChapters(games, "R5rCsGqDJIg")
  assert.deepEqual(
    chapters.map((chapter) => [chapter.number, chapter.start, chapter.end, chapter.synced]),
    [
      [1, 600, 1860, true],
      [2, 2400, 3300, true],
      [3, 0, 0, false],
    ],
    "game 1 ends after its pause; game 3 is in another video and has no position in this one",
  )
  assert.deepEqual(
    [chapters[2]!.videoId, chapters[2]!.live, chapters[2]!.sync.startSecond],
    ["abcdefghijk", false, null],
    "it still says which video it is in",
  )
  assert.equal(chapterAt(chapters, 1000)?.number, 1)
  assert.equal(chapterAt(chapters, 2000), null, "the break between games belongs to no game")
  assert.equal(chapterClock(chapters[0], 930), 300, "the game clock holds during the pause")
  assert.equal(chapterClock(chapters[0], 1100), 440)
  assert.equal(chapterVideo(chapters[0], 400), 1060)
  assert.equal(axisLength(chapters, 7200), 7200)
  assert.equal(axisLength(chapters, null), 3420)
  assert.equal(chapterAt(chapters, 30), null, "a game without a place never takes the playhead")

  const copies = broadcastEvents(chapters)
  assert.deepEqual(
    copies.map((event) => [event.id, event.at]),
    [["g1|k", 1060]],
  )
  assert.deepEqual(sourceOf(copies[0].id), { gameId: "g1", id: "k" })
})

test("a live game without an end holds the video until the next game", () => {
  const draft = { startSecond: 3000, lockedSecond: 3200, turns: [] }
  const chapters = layoutChapters(
    [
      game("g1", 1, { sourceUrl: url, sourceTimestampSeconds: 600 }),
      game("g2", 2, { sourceUrl: url, sourceTimestampSeconds: 3400, durationSeconds: 900, draft }),
    ],
    "R5rCsGqDJIg",
  )
  assert.deepEqual([chapters[0]!.ended, chapters[1]!.ended], [false, true])
  assert.equal(chapterAt(chapters, 600 + 25 * 60)?.number, 1, "the estimated fifteen minutes do not end it")
  assert.equal(chapterClock(chapters[0]!, 600 + 25 * 60), 25 * 60, "and its clock runs on")
  assert.equal(chapterVideo(chapters[0]!, 25 * 60), 600 + 25 * 60)
  assert.equal(chapterAt(chapters, 3000)?.number, 2, "the next game takes over at its draft")
  assert.equal(chapterAt(chapters, 4400), null, "a game that ended does not hold the video after it")
  assert.equal(chapterClock(chapters[1]!, 4400), 900, "and its clock stops at the end")
})

test("only moments of a game whose 0:00 is known stand on the axis", () => {
  const events = [{ id: "k", atSeconds: 400, kind: "NOTE", title: "Steal" }]
  const timeline = { pauses: [], events }
  const draft = { startSecond: 100, lockedSecond: null, turns: [] }
  const chapters = layoutChapters(
    [
      game("g1", 1, { sourceUrl: url, draft, timeline }),
      game("g2", 2, { timeline }),
      game("g3", 3, { sourceUrl: url, sourceTimestampSeconds: 3000, durationSeconds: 900, timeline }),
    ],
    "R5rCsGqDJIg",
  )
  assert.deepEqual(
    broadcastEvents(chapters).map((event) => [event.id, event.at]),
    [["g3|k", 3400]],
  )
})

test("the strip is cut to the match in a video of a whole day, and only when every game has its place there", () => {
  const placed = (id: string, number: number, start: number) =>
    game(id, number, { sourceUrl: url, sourceTimestampSeconds: start, durationSeconds: 900 })
  const chapters = layoutChapters([placed("g1", 1, 14000), placed("g2", 2, 17000)], "R5rCsGqDJIg")
  assert.deepEqual(stripRange(chapters, 38200), { from: 13100, to: 18800, cut: true })
  const long = layoutChapters([placed("g1", 1, 3000), placed("g2", 2, 17000)], "R5rCsGqDJIg")
  assert.deepEqual(stripRange(long, 18900), { from: 0, to: 18900, cut: false }, "not under half of the video")
  const begun = layoutChapters([placed("g1", 1, 1546)], "R5rCsGqDJIg")
  assert.deepEqual(
    stripRange(begun, 13504),
    { from: 0, to: 13504, cut: false },
    "the first game of a match's own video",
  )
  const missing = layoutChapters([placed("g1", 1, 14000), game("g2", 2, {})], "R5rCsGqDJIg")
  assert.deepEqual(stripRange(missing, 38200), { from: 0, to: 38200, cut: false })
  assert.deepEqual(stripRange([], 38200), { from: 0, to: 38200, cut: false })
})

test("a game's ban/pick phase sits before its start on the video axis and belongs to that game", () => {
  const doc = (extra: Record<string, unknown>) => ({
    id: "g1",
    version: 1,
    createdAt: "",
    updatedAt: "",
    missingFields: [],
    content: {
      seriesId: "s",
      number: 1,
      region: "VN",
      locale: "vi-VN",
      sides: [],
      sourceUrl: "https://youtu.be/R5rCsGqDJIg",
      ...extra,
    },
  })
  const draft = { startSecond: 1500, lockedSecond: 1740, turns: [] }
  const [chapter] = layoutChapters([doc({ durationSeconds: 900, sourceTimestampSeconds: 1800, draft })], "R5rCsGqDJIg")
  assert.equal(chapter!.from, 1500)
  assert.equal(chapter!.start, 1800)
  assert.equal(chapter!.live, true)
  assert.equal(chapterAt([chapter!], 1600)?.gameId, chapter!.gameId, "the draft counts as part of the game")
  assert.equal(chapterClock(chapter!, 1600), 0, "the game clock has not started during the draft")

  // Before the game is marked live the start is only estimated after the draft, and the game clock is not live.
  const [pending] = layoutChapters([doc({ draft: { ...draft, lockedSecond: null } })], "R5rCsGqDJIg")
  assert.equal(pending!.live, false)
  assert.equal(pending!.synced, true)
  assert.equal(pending!.from, 1500)
  assert.ok(pending!.start > 1500)
})

test("a marker can only be dragged where the service would accept it", () => {
  const turn = (order: number, atSecond: number | null) => ({
    order,
    kind: "BAN" as const,
    side: "BLUE" as const,
    hero: { id: null, name: `Hero ${order}` },
    atSecond,
  })
  const doc = {
    id: "g1",
    version: 1,
    createdAt: "",
    updatedAt: "",
    missingFields: [],
    content: {
      seriesId: "s",
      number: 1,
      region: "VN",
      locale: "vi-VN",
      sides: [
        {
          side: "BLUE" as const,
          teamId: "a",
          bans: [],
          participants: [
            {
              lane: "MID" as const,
              hero: { id: null, name: "Mid" },
              spell: {},
              arcana: { status: "UNKNOWN" as const, entries: [] },
              enchantments: { status: "UNKNOWN" as const, entries: [] },
              equipmentSnapshots: [],
              equipmentEvents: [{ atSeconds: 90, type: "BUY" as const, item: { id: null, name: "Boots" }, toSlot: 1 }],
            },
          ],
        },
      ],
      sourceUrl: "https://youtu.be/R5rCsGqDJIg",
      durationSeconds: 900,
      sourceTimestampSeconds: 400,
      draft: { startSecond: 100, lockedSecond: 380, turns: [turn(1, 120), turn(2, 150), turn(3, null), turn(4, 200)] },
      timeline: { pauses: [], events: [{ id: "k1", kind: "KILL" as const, atSeconds: 60 }] },
    },
  }
  const [live] = layoutChapters([doc], "R5rCsGqDJIg")
  const item = live!.events.find((event) => event.kind === "ITEM")!
  const start = { kind: "draftStart" as const, gameId: "g1" }
  const lock = { kind: "draftLock" as const, gameId: "g1" }

  assert.deepEqual(retimeRange(live!, { kind: "event", gameId: "g1", id: "k1" }, 5000), { min: 400, max: 1300 })
  assert.equal(retimeRange(live!, { kind: "event", gameId: "g1", id: item.id }, 5000), null, "equipment has its form")
  assert.equal(retimeRange(live!, { kind: "event", gameId: "g1", id: "gone" }, 5000), null)
  // The seconds older turns hold bound neither edge of the draft: the write that moves an edge drops them.
  assert.deepEqual(retimeRange(live!, start, 5000), { min: 0, max: 380 }, "not after the lock")
  assert.deepEqual(retimeRange(live!, lock, 5000), { min: 100, max: 400 }, "between the start and 0:00")

  // Without a lock the game start bounds the draft; before the game is live only the video does.
  const unlocked = { ...doc, content: { ...doc.content, draft: { ...doc.content.draft, lockedSecond: null } } }
  const [free] = layoutChapters([unlocked], "R5rCsGqDJIg")
  assert.deepEqual(retimeRange(free!, start, 5000), { min: 0, max: 400 })
  assert.equal(retimeRange(free!, lock, 5000), null, "no lock, nothing to drag")
  const pending = { ...unlocked, content: { ...unlocked.content, sourceTimestampSeconds: undefined } }
  const [open] = layoutChapters([pending], "R5rCsGqDJIg")
  assert.deepEqual(retimeRange(open!, start, 5000), { min: 0, max: 5000 })
  assert.equal(retimeRange(open!, { kind: "event", gameId: "g1", id: "k1" }, 5000), null, "no game clock yet")

  const moved = moveEvent(doc.content, "k1", 420.4)!
  assert.deepEqual(
    moved.timeline!.events.map((event) => [event.id, event.atSeconds]),
    [["k1", 420]],
  )
  assert.equal(
    JSON.stringify(moved.sides[0]!.participants[0]!.equipmentEvents),
    JSON.stringify(doc.content.sides[0]!.participants[0]!.equipmentEvents),
    "equipment keeps its own seconds",
  )
  assert.equal(moveEvent(doc.content, "gone", 10), null)
})

test("a game whose length is not recorded lasts a minute past its last moment, and at least fifteen minutes", () => {
  const { content } = game("g1", 1, {})
  const late: TimelineEvent[] = [{ id: "n", kind: "NOTE", at: 1200, title: "Late" }]
  assert.equal(gameLength(content, late), 1260)
  assert.equal(gameLength(content, []), 900)
})

test("a video whose length is known ends the axis, though a game ends at its very end", () => {
  const last = game("g1", 1, { sourceUrl: url, sourceTimestampSeconds: 2400, durationSeconds: 900 })
  assert.equal(axisLength(layoutChapters([last], "R5rCsGqDJIg"), 3300), 3300)
})

test("a loadout mark of a game without its end may go up to the next game, not past it", () => {
  const shown = seat(completeGame(1, "a"), "BLUE", "MID", { spellObservedAtSeconds: 30 })
  const content = { ...shown.content, sourceUrl: url, sourceTimestampSeconds: 1000, durationSeconds: null }
  const [running] = layoutChapters([{ ...shown, content }], "R5rCsGqDJIg")
  const mark = { kind: "mark" as const, gameId: "g1", side: "BLUE" as const, part: "spell" as const, at: 30 }
  assert.deepEqual(retimeRange(running!, mark, 5000, { nextFrom: 4000 }), { min: 1000, max: 3999 })
})

test("the ban/pick marks of a game that is not live yet stay before the next game", () => {
  const turn = (order: number, atSecond: number) => ({
    order,
    kind: "BAN" as const,
    side: "BLUE" as const,
    hero: { id: null, name: `Hero ${order}` },
    atSecond,
  })
  const drafting = (lockedSecond: number | null) => {
    const draft = { startSecond: 100, lockedSecond, turns: [turn(1, 120), turn(2, 150)] }
    return layoutChapters([game("g1", 1, { sourceUrl: url, draft })], "R5rCsGqDJIg")[0]!
  }
  const next = { nextFrom: 3000 }
  assert.deepEqual(retimeRange(drafting(380), { kind: "draftLock", gameId: "g1" }, 5000, next), { min: 100, max: 2999 })
  assert.deepEqual(retimeRange(drafting(null), { kind: "draftStart", gameId: "g1" }, 5000, next), {
    min: 0,
    max: 2999,
  })
})
