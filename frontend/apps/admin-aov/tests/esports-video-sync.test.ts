import assert from "node:assert/strict"
import { test } from "node:test"
import { broadcastChapters, retimeRange, videoTimelineEvents } from "../src/features/esports/model/broadcast-timeline"
import { moveTurn } from "../src/features/esports/model/draft"
import {
  axisLength,
  broadcastEvents,
  chapterAt,
  chapterClock,
  chapterVideo,
  layoutChapters,
  seriesVideo,
  sourceOf,
} from "../src/features/esports/model/series-vod"
import { type TimelineEvent } from "../src/features/esports/model/timeline"
import { moveEvent } from "../src/features/esports/model/timeline-io"
import { gameToVideo, videoToGame, youtubeLinkTime, youtubeVideoId } from "../src/features/esports/model/vod"
import { formatClock, parseClock } from "@/lib/clock"

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
    { id: "g1", at: 95, label: "Bắt đầu ván 1" },
    { id: "g2", at: 1800, label: "Bắt đầu ván 2" },
  ])
  assert.deepEqual(broadcastChapters("R5rCsGqDJIg", url, games), [
    { id: "g1", at: 95, label: "Bắt đầu trận · Ván 1" },
    { id: "g2", at: 1800, label: "Bắt đầu ván 2" },
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

test("games of one broadcast become chapters on the video axis; unsynced games follow in order", () => {
  const url = "https://youtu.be/R5rCsGqDJIg"
  const game = (id: string, number: number, extra: Record<string, unknown>) => ({
    id,
    version: 1,
    createdAt: "",
    updatedAt: "",
    missingFields: [],
    content: { seriesId: "s", number, region: "VN", locale: "vi-VN", sides: [], ...extra },
  })
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
    game("g3", 3, { durationSeconds: 1000 }),
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
      [3, 3600, 4600, false],
    ],
    "game 1 ends after its pause; game 3 has no start in this video and is placed after game 2",
  )
  assert.equal(chapterAt(chapters, 1000)?.number, 1)
  assert.equal(chapterAt(chapters, 2000), null, "the break between games belongs to no game")
  assert.equal(chapterClock(chapters[0], 930), 300, "the game clock holds during the pause")
  assert.equal(chapterClock(chapters[0], 1100), 440)
  assert.equal(chapterVideo(chapters[0], 400), 1060)
  assert.equal(axisLength(chapters, 7200), 7200)
  assert.equal(axisLength(chapters, null), 4720)

  const copies = broadcastEvents(chapters)
  assert.deepEqual(
    copies.map((event) => [event.id, event.at]),
    [["g1|k", 1060]],
  )
  assert.deepEqual(sourceOf(copies[0].id), { gameId: "g1", id: "k" })
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
  const target = (order: number) => ({ kind: "turn" as const, gameId: "g1", order })

  assert.deepEqual(retimeRange(live!, { kind: "event", gameId: "g1", id: "k1" }, 5000), { min: 400, max: 1300 })
  assert.equal(retimeRange(live!, { kind: "event", gameId: "g1", id: item.id }, 5000), null, "equipment has its form")
  assert.equal(retimeRange(live!, { kind: "event", gameId: "g1", id: "gone" }, 5000), null)
  assert.deepEqual(retimeRange(live!, target(2), 5000), { min: 120, max: 200 }, "between its neighbours")
  assert.deepEqual(retimeRange(live!, target(4), 5000), { min: 150, max: 380 }, "the turn without a second is skipped")
  assert.deepEqual(retimeRange(live!, target(1), 5000), { min: 100, max: 150 }, "not before the draft starts")
  assert.equal(retimeRange(live!, target(3), 5000), null, "a turn without a second has no marker to drag")

  // Without a lock the game start bounds the draft; before the game is live only the video does.
  const unlocked = { ...doc, content: { ...doc.content, draft: { ...doc.content.draft, lockedSecond: null } } }
  assert.deepEqual(retimeRange(layoutChapters([unlocked], "R5rCsGqDJIg")[0]!, target(4), 5000), { min: 150, max: 400 })
  const pending = { ...unlocked, content: { ...unlocked.content, sourceTimestampSeconds: undefined } }
  const [open] = layoutChapters([pending], "R5rCsGqDJIg")
  assert.deepEqual(retimeRange(open!, target(4), 5000), { min: 150, max: 5000 })
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

  const turned = moveTurn(doc.content, 2, 171.6)!
  assert.deepEqual(
    turned.draft!.turns.map((entry) => entry.atSecond),
    [120, 172, null, 200],
  )
  assert.equal(turned.sides, doc.content.sides, "line-ups and bans are not rebuilt by a change of second")
  assert.equal(moveTurn(doc.content, 9, 10), null)
})
