import assert from "node:assert/strict"
import { test } from "node:test"
import type { SeriesContent } from "@aov/community-contracts"
import { broadcastChapters, videoTimelineEvents } from "../src/features/esports/model/broadcast-timeline"
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
import {
  buildBracket,
  computeStandings,
  seriesWinner,
  type SeriesRecord,
} from "../src/features/esports/model/competition"
import { stageInfo } from "../src/features/esports/model/labels"
import { gameStatistics } from "../src/features/esports/model/statistics"
import {
  clusterEvents,
  clusterKills,
  eventSide,
  inventoryAt,
  killScoreAt,
  leadEvent,
  seatStatsAt,
  type TimelineEvent,
} from "../src/features/esports/model/timeline"
import { readTimeline, upsertEvent, withPlayback, writeTimeline } from "../src/features/esports/model/timeline-io"
import {
  formatClock,
  gameToVideo,
  parseClock,
  videoToGame,
  youtubeLinkTime,
  youtubeVideoId,
} from "../src/features/esports/model/vod"

const series = (
  id: string,
  stage: string,
  teamAId: string,
  teamBId: string,
  score?: [number, number],
  bestOf = 5,
): SeriesRecord => ({
  id,
  content: {
    code: id,
    tournamentId: "t",
    stage,
    teamAId,
    teamBId,
    bestOf,
    scheduledAt: `2026-09-${String(10 + Number(id.replace(/\D/g, "") || 0)).padStart(2, "0")}T10:00:00Z`,
    result: score ? { scoreA: score[0], scoreB: score[1], sourceUrl: "https://x", verification: "PRIMARY" } : null,
  } satisfies SeriesContent,
})

test("stage codes map to readable labels and bracket phases; free text is kept", () => {
  assert.equal(stageInfo("REGULAR_SEASON_FIRST_LEG").label, "Vòng bảng · Lượt đi")
  assert.equal(stageInfo("UPPER_BRACKET_SEMIFINAL").label, "Bán kết nhánh thắng")
  assert.equal(stageInfo("LOWER_BRACKET_QUARTERFINAL").phase, "LOWER")
  assert.equal(stageInfo("GRAND_FINAL").phase, "FINAL")
  assert.ok(stageInfo("LOWER_BRACKET_QUARTERFINAL").order < stageInfo("LOWER_BRACKET_FINAL").order)
  assert.deepEqual(stageInfo("Show match"), { code: "Show match", label: "Show match", phase: "OTHER", order: 90 })
})

test("a series is only decided once a team reaches the majority of its best-of", () => {
  assert.equal(seriesWinner(series("1", "X", "a", "b", [3, 1]).content), "A")
  assert.equal(seriesWinner(series("1", "X", "a", "b", [2, 4], 7).content), "B")
  assert.equal(seriesWinner(series("1", "X", "a", "b", [2, 1]).content), null)
  assert.equal(seriesWinner(series("1", "X", "a", "b").content), null)
})

test("standings count series points, then game difference, share ranks on full ties and flag playoff teams", () => {
  const rows = computeStandings([
    series("1", "REGULAR_SEASON_FIRST_LEG", "a", "b", [3, 0]),
    series("2", "REGULAR_SEASON_FIRST_LEG", "c", "a", [3, 2]),
    series("3", "REGULAR_SEASON_FIRST_LEG", "b", "c", [3, 1]),
    series("4", "REGULAR_SEASON_SECOND_LEG", "a", "c"),
    series("5", "UPPER_BRACKET_FINAL", "a", "c", [4, 3], 7),
  ])
  assert.deepEqual(
    rows.map((row) => [row.teamId, row.rank, row.points, row.gameDiff, row.played]),
    [
      ["a", 1, 1, 2, 2],
      ["c", 2, 1, -1, 2],
      ["b", 3, 1, -1, 2],
    ],
  )
  assert.deepEqual(rows[0].form, ["W", "L"])
  assert.equal(rows.find((row) => row.teamId === "b")?.advanced, false)
  assert.equal(rows.find((row) => row.teamId === "a")?.advanced, true)
})

test("the bracket orders rounds and projects the grand final from the upper final winner", () => {
  const bracket = buildBracket([
    series("6", "UPPER_BRACKET_FINAL", "sgp", "fpl", [3, 4], 7),
    series("1", "UPPER_BRACKET_SEMIFINAL", "sgp", "bme", [4, 2], 7),
    series("2", "UPPER_BRACKET_SEMIFINAL", "fpl", "fl", [4, 1], 7),
    series("3", "LOWER_BRACKET_QUARTERFINAL", "bme", "gam", [4, 1], 7),
    series("7", "LOWER_BRACKET_FINAL", "sgp", "bme", undefined, 7),
  ])
  assert.deepEqual(
    bracket.upper.map((round) => [round.label, round.slots.length]),
    [
      ["Bán kết nhánh thắng", 2],
      ["Chung kết nhánh thắng", 1],
    ],
  )
  assert.equal(bracket.lower[0].label, "Tứ kết nhánh thua")
  assert.equal(bracket.final?.slots[0].projected, true)
  assert.equal(bracket.final?.slots[0].teamAId, "fpl")
  assert.equal(bracket.final?.slots[0].teamBId, undefined)
})

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

test("inventory at a moment starts from the latest snapshot and never invents unseen slots", () => {
  const events: TimelineEvent[] = [
    { id: "1", kind: "ITEM", at: 60, seat: "BLUE:MID", action: "BUY", slot: 1, item: { name: "Sách" } },
    { id: "2", kind: "ITEM", at: 400, seat: "BLUE:MID", action: "SELL", slot: 2 },
    { id: "3", kind: "ITEM", at: 500, seat: "RED:MID", action: "BUY", slot: 1, item: { name: "Khác" } },
  ]
  const snapshots = [
    {
      atSeconds: 300,
      slots: [
        { slot: 1, known: true, item: { id: "a", name: "Trượng" } },
        { slot: 2, known: true, item: { id: "b", name: "Giày" } },
        { slot: 3, known: true, item: null },
        { slot: 4, known: false, item: null },
      ],
    },
  ]
  assert.deepEqual(inventoryAt("BLUE:MID", 100, [], events), [
    { name: "Sách" },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ])
  const later = inventoryAt("BLUE:MID", 450, snapshots, events)
  assert.deepEqual(later.slice(0, 4), [{ id: "a", name: "Trượng" }, null, null, undefined])
  assert.equal(
    inventoryAt("BLUE:MID", 450, snapshots, events)[0]?.name,
    "Trượng",
    "events before the snapshot are superseded",
  )
})

test("kill score and KDA only count events up to the playhead", () => {
  const events: TimelineEvent[] = [
    { id: "1", kind: "KILL", at: 100, killer: "BLUE:JUNGLE", victim: "RED:MID", assists: ["BLUE:MID"] },
    { id: "2", kind: "KILL", at: 200, victim: "BLUE:DRAGON", assists: [] },
    { id: "3", kind: "OBJECTIVE", at: 250, side: "RED", objective: "ABYSSAL_DRAGON" },
  ]
  assert.deepEqual(killScoreAt(events, 150), { BLUE: 1, RED: 0 })
  assert.deepEqual(killScoreAt(events, 300), { BLUE: 1, RED: 1 }, "an unknown killer still scores for the other side")
  assert.deepEqual(seatStatsAt(events, 300).get("BLUE:MID"), { kills: 0, deaths: 0, assists: 1 })
  assert.equal(seatStatsAt(events, 150).get("BLUE:DRAGON"), undefined)
})

test("hero statistics count presence from picks and bans and win rate per side", () => {
  const side = (code: "BLUE" | "RED", hero: string, ban: string) => ({
    side: code,
    teamId: code,
    bans: [{ id: ban, name: ban }],
    participants: [
      {
        lane: "MID" as const,
        hero: { id: hero, name: hero },
        spell: {},
        arcana: { status: "UNKNOWN" as const, entries: [] },
        enchantments: { status: "UNKNOWN" as const, entries: [] },
        equipmentSnapshots: [],
        equipmentEvents: [],
      },
    ],
  })
  const game = (winner: "BLUE" | "RED" | null, duration: number) => ({
    seriesId: "s",
    number: 1,
    region: "VN",
    locale: "vi-VN",
    winner,
    durationSeconds: duration,
    sides: [side("BLUE", "airi", "elsu"), side("RED", "elsu", "airi")],
  })
  const stats = gameStatistics([game("BLUE", 900), game("RED", 1200), game(null, 0)])
  const airi = stats.heroes.find((hero) => hero.key === "airi")!
  assert.equal(airi.picks, 3)
  assert.equal(airi.bans, 3)
  assert.equal(airi.wins, 1)
  assert.deepEqual(airi.blue, { picks: 3, wins: 1 })
  assert.deepEqual(stats.sideWins, { BLUE: 1, RED: 1 })
  assert.equal(stats.shortest?.seconds, 900)
  assert.equal(stats.averageSeconds, 1050)
})

test("timeline moments round-trip through the API shape: items on participants, the rest in timeline", () => {
  const participant = (lane: "MID" | "JUNGLE") => ({
    lane,
    hero: { id: null, name: lane },
    spell: {},
    arcana: { status: "UNKNOWN" as const, entries: [] },
    enchantments: { status: "UNKNOWN" as const, entries: [] },
    equipmentSnapshots: [],
    equipmentEvents: [{ atSeconds: 50, type: "BUY" as const, item: { id: null, name: "Old" }, toSlot: 1 }],
  })
  const content = {
    seriesId: "s",
    number: 1,
    region: "VN",
    locale: "vi-VN",
    sides: [
      { side: "BLUE" as const, teamId: "a", bans: [], participants: [participant("MID")] },
      { side: "RED" as const, teamId: "b", bans: [], participants: [participant("JUNGLE")] },
    ],
    timeline: { pauses: [{ atSeconds: 300, durationSeconds: 60 }], events: [] },
  }
  const moments: TimelineEvent[] = [
    { id: "kill-1", kind: "KILL", at: 120, killer: "RED:JUNGLE", victim: "BLUE:MID", assists: [] },
    { id: "sell-1", kind: "ITEM", at: 400, seat: "BLUE:MID", action: "SELL", slot: 1, item: { name: "Old" } },
    {
      id: "buy-1",
      kind: "ITEM",
      at: 30,
      seat: "BLUE:MID",
      action: "BUY",
      slot: 2,
      item: { id: "boots", name: "Boots" },
    },
    { id: "note-1", kind: "NOTE", at: 200, title: "Gank", side: "RED" },
  ]

  const written = writeTimeline(content, upsertEvent(readTimeline(content), moments[0]))
  const full = writeTimeline(written, [...readTimeline(written), ...moments.slice(1)])
  const blue = full.sides[0].participants[0].equipmentEvents
  assert.deepEqual(
    blue.map((event) => [event.atSeconds, event.type, event.toSlot ?? event.fromSlot, event.item?.name]),
    [
      [30, "BUY", 2, "Boots"],
      [50, "BUY", 1, "Old"],
      [400, "SELL", 1, "Old"],
    ],
    "equipment events are stored time-ordered on their participant",
  )
  assert.deepEqual(full.sides[1].participants[0].equipmentEvents.length, 1)
  assert.deepEqual(
    full.timeline?.events.map((event) => [event.id, event.kind, event.atSeconds]),
    [
      ["kill-1", "KILL", 120],
      ["note-1", "NOTE", 200],
    ],
  )
  assert.deepEqual(full.timeline?.events[0].killer, { side: "RED", lane: "JUNGLE" })
  assert.deepEqual(full.timeline?.pauses, [{ atSeconds: 300, durationSeconds: 60 }], "pauses survive event edits")
  assert.equal(readTimeline(full).filter((event) => event.kind === "ITEM").length, 4)

  const replayed = withPlayback(full, { url: "https://youtu.be/R5rCsGqDJIg", startSecond: 95, pauses: [] })
  assert.equal(replayed.sourceTimestampSeconds, 95)
  assert.deepEqual(replayed.timeline?.pauses, [])
  assert.equal(replayed.timeline?.events.length, 2, "playback changes keep recorded moments")
})

test("moments a few seconds apart form one teamfight, and per-side clustering keeps lanes apart", () => {
  const fight: TimelineEvent[] = [
    { id: "a", kind: "KILL", at: 455, killer: "BLUE:JUNGLE", victim: "RED:SUPPORT", assists: [] },
    { id: "b", kind: "ITEM", at: 456, seat: "RED:DRAGON", action: "SELL", slot: 2, item: { name: "Cung" } },
    { id: "c", kind: "KILL", at: 458, killer: "RED:MID", victim: "BLUE:TOP", assists: [] },
    { id: "d", kind: "KILL", at: 462, killer: "BLUE:DRAGON", victim: "RED:JUNGLE", assists: [] },
    { id: "e", kind: "OBJECTIVE", at: 540, side: "RED", objective: "TURRET" },
  ]
  const groups = clusterEvents(fight, 5)
  assert.deepEqual(
    groups.map((group) => group.events.map((event) => event.id)),
    [["a", "b", "c", "d"], ["e"]],
  )
  assert.deepEqual(clusterKills(groups[0]), { BLUE: 2, RED: 1 })
  assert.equal(groups[0].side, null, "a mixed fight has no single side")
  assert.equal(leadEvent(groups[0]).kind, "KILL")

  const lanes = clusterEvents(fight, 5, (event) => (event.kind === "OBJECTIVE" ? "MID" : (eventSide(event) ?? "MID")))
  assert.deepEqual(
    lanes.map((group) => [group.side, group.events.map((event) => event.id).join("")]),
    [
      ["BLUE", "a"],
      ["RED", "bc"],
      ["BLUE", "d"],
      ["RED", "e"],
    ],
  )
  assert.equal(lanes.at(-1)?.lane, "MID", "objectives get their own row")
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

const draftGame = (
  number: number,
  blue: { teamId: string; picks: (string | null)[]; bans?: string[] },
  red: { teamId: string; picks: (string | null)[]; bans?: string[] },
) => {
  const side = (code: "BLUE" | "RED", entry: typeof blue) => ({
    side: code,
    teamId: entry.teamId,
    bans: [0, 1, 2, 3].map((index) => ({ id: null, name: entry.bans?.[index] ?? null })),
    participants: (["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const).map((lane, index) => ({
      lane,
      hero: { id: null, name: entry.picks[index] ?? null },
      spell: { id: null, name: null },
      arcana: { status: "UNKNOWN" as const, entries: [] },
      enchantments: { status: "UNKNOWN" as const, entries: [] },
      equipmentSnapshots: [],
      equipmentEvents: [],
    })),
  })
  return {
    content: {
      seriesId: "s",
      number,
      region: "VN",
      locale: "vi-VN",
      sides: [side("BLUE", blue), side("RED", red)],
    },
  }
}

test("a team cannot pick again what it played earlier in the series, until the last game of the BO", async () => {
  const { draftUnavailable, seriesLocks, unavailableReason, allowedOptions } =
    await import("../src/features/esports/model/series-rules")
  const games = [
    draftGame(1, { teamId: "a", picks: ["Florentino", "Nakroth"], bans: ["Aoi"] }, { teamId: "b", picks: ["Lauriel"] }),
    // Teams swap sides in game 2; the rule follows the team, not the side.
    draftGame(2, { teamId: "b", picks: ["Capheny"] }, { teamId: "a", picks: ["Ẻlsu"] }),
  ]
  const locks = seriesLocks(games, 3, 5)
  assert.equal(locks.decider, false)
  assert.deepEqual(
    locks.byTeam.get("a")!.map((use) => [use.gameNumber, use.hero.name]),
    [
      [1, "Florentino"],
      [1, "Nakroth"],
      [2, "Ẻlsu"],
    ],
  )
  assert.deepEqual(
    locks.byTeam.get("b")!.map((use) => use.hero.name),
    ["Lauriel", "Capheny"],
  )

  const game3 = draftGame(3, { teamId: "a", picks: [null, "Murad"], bans: ["Lauriel"] }, { teamId: "b", picks: [] })
  const name = (id: string) => (id === "a" ? "AZT" : "EMW")
  const pickA = draftUnavailable(game3.content, { side: "BLUE", kind: "pick", index: 0 }, locks, name)
  assert.equal(
    unavailableReason(pickA, { name: "florentino" }),
    "AZT đã dùng ở ván 1",
    "names match case-insensitively",
  )
  assert.equal(unavailableReason(pickA, { name: "Elsu" }), "AZT đã dùng ở ván 2", "and without accents")
  assert.equal(unavailableReason(pickA, { name: "Lauriel" }), "Đã bị cấm ở ván này")
  assert.equal(unavailableReason(pickA, { name: "Murad" }), "AZT đã chọn ở ván này")
  assert.equal(unavailableReason(pickA, { name: "Aoi" }), null, "a ban from an earlier game no longer applies")
  assert.equal(unavailableReason(pickA, { name: "Capheny" }), null, "the other team's earlier picks stay open")

  const pickB = draftUnavailable(game3.content, { side: "RED", kind: "pick", index: 0 }, locks, name)
  assert.equal(unavailableReason(pickB, { name: "Florentino" }), null)
  assert.equal(unavailableReason(pickB, { name: "Capheny" }), "EMW đã dùng ở ván 2")

  const ban = draftUnavailable(game3.content, { side: "RED", kind: "ban", index: 0 }, locks, name)
  assert.equal(unavailableReason(ban, { name: "Florentino" }), null, "bans may target heroes locked for a team")
  assert.equal(unavailableReason(ban, { name: "Murad" }), "AZT đã chọn ở ván này")

  const own = draftUnavailable(game3.content, { side: "BLUE", kind: "pick", index: 1 }, locks, name)
  assert.equal(unavailableReason(own, { name: "Murad" }), null, "a slot can keep its own hero")
  const catalog = ["Florentino", "Murad", "Aoi", "Lauriel"].map((hero) => ({ id: hero.toLowerCase(), name: hero }))
  assert.deepEqual(
    allowedOptions(catalog, pickA).map((hero) => hero.name),
    ["Aoi"],
  )

  const decider = seriesLocks(
    [...games, draftGame(3, { teamId: "a", picks: ["Murad"] }, { teamId: "b", picks: [] })],
    5,
    5,
  )
  assert.equal(decider.decider, true)
  assert.equal(decider.byTeam.size, 0, "the last game of the BO opens every hero again")
  assert.equal(seriesLocks(games, 1, 5).byTeam.size, 0, "game 1 has nothing before it")
})

test("draft turns build bans and provisional line-ups, and teammates swap heroes without leaving the team", async () => {
  const { assignHero, earliestLive, withTurns } = await import("../src/features/esports/model/draft")
  const base = draftGame(2, { teamId: "a", picks: [] }, { teamId: "b", picks: [] }).content as Parameters<
    typeof withTurns
  >[0]
  const turn = (order: number, kind: "BAN" | "PICK", side: "BLUE" | "RED", name: string, atSecond?: number) => ({
    order,
    kind,
    side,
    hero: { id: null, name },
    atSecond,
  })
  const drafted = withTurns(base, [
    turn(1, "BAN", "BLUE", "Aoi", 110),
    turn(2, "PICK", "BLUE", "Murad", 120),
    turn(3, "PICK", "RED", "Lauriel", 125),
    turn(4, "PICK", "BLUE", "Omen", 130),
  ])
  assert.deepEqual(
    drafted.sides[0]!.bans.map((ban) => ban.name),
    ["Aoi", null, null, null],
  )
  assert.deepEqual(
    drafted.sides[0]!.participants.map((participant) => participant.hero.name),
    ["Murad", "Omen", null, null, null],
    "picks fill empty lanes in pick order",
  )

  // Omen goes top: the top laner's Murad moves to jungle, where Omen was.
  const swapped = assignHero(drafted, "BLUE", 0, { id: null, name: "Omen" })
  assert.deepEqual(
    swapped.sides[0]!.participants.map((participant) => participant.hero.name),
    ["Omen", "Murad", null, null, null],
  )
  // Undoing the last pick removes it from the line-up and keeps the swap of the rest.
  const undone = withTurns(swapped, swapped.draft!.turns.slice(0, -1))
  assert.deepEqual(
    undone.sides[0]!.participants.map((participant) => participant.hero.name),
    [null, "Murad", null, null, null],
  )
  assert.equal(earliestLive({ startSecond: 100, lockedSecond: 140, turns: drafted.draft!.turns }), 140)
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

test("recording progress separates required data, source-dependent loadouts and the confirmed state", async () => {
  const { recordingProgress } = await import("../src/features/esports/model/recording-progress")
  const pick = (name: string) => ({ id: null, name })
  const seat = (lane: string, index: number, extra: Record<string, unknown> = {}) => ({
    playerId: `p${index}`,
    lane,
    hero: pick(`Hero ${index}`),
    spell: pick("Tốc biến"),
    arcana: { status: "UNKNOWN", entries: [] },
    enchantments: { status: "UNKNOWN", entries: [] },
    equipmentSnapshots: [],
    equipmentEvents: [],
    ...extra,
  })
  const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
  const side = (code: string, offset: number) => ({
    side: code,
    teamId: code,
    bans: [0, 1, 2, 3].map((index) => pick(`Ban ${offset + index}`)),
    participants: lanes.map((lane, index) => seat(lane, offset + index)),
  })
  const content = {
    seriesId: "s",
    number: 1,
    region: "VN",
    locale: "vi-VN",
    winner: "BLUE",
    durationSeconds: 1122,
    sides: [side("BLUE", 0), side("RED", 5)],
  }
  const entry = (extra: Record<string, unknown> = {}, patch: Record<string, unknown> = {}) =>
    ({
      id: "g",
      version: 3,
      createdAt: "2026-10-29T00:00:00Z",
      updatedAt: "2026-10-29T01:00:00Z",
      missingFields: [],
      content: { ...content, ...patch },
      ...extra,
    }) as Parameters<typeof recordingProgress>[0]

  const ready = recordingProgress(entry())
  assert.equal(ready.state, "ready", "loadouts that the source never showed do not block confirmation")
  assert.equal(ready.done, ready.total)
  assert.equal(ready.steps.find((step) => step.id === "arcana")?.status, "todo")
  assert.equal(ready.steps.find((step) => step.id === "arcana")?.required, false)

  const blue = content.sides[0]!
  const partial = recordingProgress(
    entry(
      { missingFields: ["sides[1].participants[0].spell"] },
      {
        winner: null,
        sides: [
          {
            ...blue,
            participants: blue.participants.map((participant, index) => ({
              ...participant,
              arcana:
                index === 0
                  ? { status: "PARTIAL", entries: [{ selection: {}, count: 10, color: "RED" }], observedAtSeconds: 27 }
                  : { status: "NOT_SHOWN", entries: [] },
            })),
          },
          content.sides[1],
        ],
      },
    ),
  )
  assert.equal(partial.state, "recording")
  assert.equal(partial.steps.find((step) => step.id === "result")?.status, "partial")
  assert.equal(partial.steps.find((step) => step.id === "checks")?.status, "todo")
  assert.equal(
    partial.steps.find((step) => step.id === "arcana")?.detail,
    "1 một phần · 4 không hiển thị · 5 chưa ghi · 1 có mốc",
  )

  assert.equal(recordingProgress(entry({ publishedAt: "2026-10-29T01:00:00Z" })).state, "confirmed")
  assert.equal(
    recordingProgress(entry({ publishedAt: "2026-10-29T00:30:00Z" })).state,
    "changed",
    "edits after confirming wait for a new confirmation",
  )
})

test("a match lists what it still needs: score, missing games, video and each game's gaps", async () => {
  const { matchRecording } = await import("../src/features/esports/model/match-recording")
  const pick = (name: string) => ({ id: null, name })
  const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
  const side = (code: string, spells: boolean) => ({
    side: code,
    teamId: code,
    bans: [0, 1, 2, 3].map((index) => pick(`${code} ban ${index}`)),
    participants: lanes.map((lane, index) => ({
      playerId: `${code}${index}`,
      lane,
      hero: pick(`${code} hero ${index}`),
      spell: spells ? pick("Tốc biến") : { id: null, name: null },
      arcana: { status: "UNKNOWN", entries: [] },
      enchantments: { status: "UNKNOWN", entries: [] },
      equipmentSnapshots: [],
      equipmentEvents: [],
    })),
  })
  const game = (number: number, extra: Record<string, unknown> = {}, spells = true) =>
    ({
      id: `g${number}`,
      version: 1,
      createdAt: "2026-10-29T00:00:00Z",
      updatedAt: "2026-10-29T01:00:00Z",
      missingFields: [],
      content: {
        seriesId: "s",
        number,
        region: "VN",
        locale: "vi-VN",
        winner: "BLUE",
        durationSeconds: 900,
        sourceUrl: "https://youtu.be/R5rCsGqDJIg",
        sides: [side("BLUE", spells), side("RED", spells)],
      },
      ...extra,
    }) as Parameters<typeof matchRecording>[1][number]
  const series = (extra: Record<string, unknown> = {}) => ({
    code: "s",
    tournamentId: "t",
    teamAId: "a",
    teamBId: "b",
    bestOf: 5,
    ...extra,
  })

  const later = matchRecording(series({ scheduledAt: "2026-12-01T10:00:00Z" }), [], Date.parse("2026-10-29T00:00:00Z"))
  assert.equal(later.state, "upcoming")
  assert.deepEqual(later.gaps, [])

  const played = matchRecording(series({ result: { scoreA: 3, scoreB: 1 } }), [
    game(1, { publishedAt: "2026-10-29T01:00:00Z" }),
    game(2, {}, false),
  ])
  assert.equal(played.state, "missing")
  assert.equal(played.expected, 4)
  assert.equal(played.confirmed, 1)
  assert.deepEqual(
    played.gaps.map((gap) => gap.text),
    ["Thiếu 2/4 ván", "Ván 2: thiếu phụ trợ"],
  )
  assert.equal(played.gaps[1]!.gameId, "g2", "a game's gap opens that game")

  const waiting = matchRecording(series({ result: { scoreA: 1, scoreB: 0 }, bestOf: 1 }), [game(1)])
  assert.equal(waiting.state, "unconfirmed")
  assert.deepEqual(
    waiting.gaps.map((gap) => gap.text),
    ["Ván 1 chờ xác nhận"],
  )

  const done = matchRecording(series({ result: { scoreA: 1, scoreB: 0 }, bestOf: 1 }), [
    game(1, { publishedAt: "2026-10-29T01:00:00Z" }),
  ])
  assert.equal(done.state, "complete")

  const noScore = matchRecording(
    series({ scheduledAt: "2026-10-01T10:00:00Z" }),
    [],
    Date.parse("2026-10-29T00:00:00Z"),
  )
  assert.deepEqual(
    noScore.gaps.map((gap) => gap.text),
    ["Chưa có tỉ số trận", "Chưa gắn video"],
    "a match that should have been played asks for its score and video",
  )
})

test("dates near today read as words and keep the exact date for tooltips", async () => {
  const { exactDate, relativeDay } = await import("../src/features/esports/model/labels")
  const now = new Date(2026, 9, 29, 9, 0)
  assert.equal(relativeDay("2026-10-29T18:00:00", now), "Hôm nay")
  assert.equal(relativeDay("2026-10-28T23:30:00", now), "Hôm qua", "calendar days, not 24-hour spans")
  assert.equal(relativeDay("2026-10-30", now), "Ngày mai")
  assert.equal(relativeDay("2026-10-25T18:00:00", now), "4 ngày trước")
  assert.equal(relativeDay("2026-11-02T18:00:00", now), "4 ngày nữa")
  assert.match(relativeDay("2026-10-01T18:00:00", now), /01\/10/, "older dates fall back to the short date")
  assert.match(relativeDay("2025-10-01", now), /2025/, "another year shows the year")
  assert.equal(relativeDay(null, now), "")
  assert.match(exactDate("2026-10-28T18:00:00"), /28 tháng 10.*2026.*18:00/)
  assert.doesNotMatch(exactDate("2026-10-28T18:00:00", false), /18:00/)
  assert.doesNotMatch(exactDate("2026-10-28"), /:/, "a date-only value has no time")
})
