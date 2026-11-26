import assert from "node:assert/strict"
import { test } from "node:test"
import {
  averageSeconds,
  countGames,
  feedScope,
  gameFeed,
  heroByKey,
  patchLine,
  showsBans,
  sideOf,
  wonBy,
} from "../src/lib/game-feed.ts"
import { labelWeeks, playWeeks } from "../src/lib/play-weeks.ts"
import { on, stage } from "./fixtures/competition.ts"
import { feedOf, five, lineups, roundRobin, roundRobinView, type TestGame } from "./fixtures/lineups.ts"

const game = (id: string, series: string, extra: Partial<TestGame> = {}): TestGame => ({
  id,
  series,
  blue: { team: "x", picks: five("a"), bans: ["k1"] },
  red: { team: "y", picks: five("b"), bans: ["k2"] },
  ...extra,
})

test("days less than three apart make one week", () => {
  const weeks = playWeeks(["2026-09-06", "2026-08-30", "2026-08-29", "2026-09-04", "2026-10-31"])
  assert.deepEqual(
    [...weeks],
    [
      ["2026-08-29", 1],
      ["2026-08-30", 1],
      ["2026-09-04", 2],
      ["2026-09-06", 2],
      ["2026-10-31", 3],
    ],
  )
})

test("a pause of three days starts another week", () => {
  assert.deepEqual([...playWeeks(["2026-09-01", "2026-09-03", "2026-09-06"]).values()], [1, 1, 2])
})

test("a label names its weeks in either language, or none", () => {
  assert.deepEqual(labelWeeks("Tuần 2–4"), [2, 4])
  assert.deepEqual(labelWeeks("Week 1"), [1, 1])
  assert.equal(labelWeeks("Playoffs"), null)
  assert.equal(labelWeeks(null), null)
})

test("a game comes with its match, its stage and the day it was played", () => {
  const [found] = feedOf([game("g1", "s1", { number: 2 })]).games
  assert.equal(found!.entry?.match.key, "m1")
  assert.deepEqual([found!.stage, found!.day, found!.number], ["RR", "2026-11-01", 2])
})

test("a game is played on the day of the calendar where the event is held", () => {
  const view = roundRobinView([{ key: "m1", seriesId: "s1", a: "x", b: "y", scheduledAt: "2026-11-01T20:00:00Z" }])
  assert.equal(feedOf([game("g1", "s1")], view).games[0]!.day, "2026-11-02")
})

test("a game of a match the plan does not name keeps its lineups", () => {
  const [found] = feedOf([game("g1", "elsewhere")]).games
  assert.deepEqual([found!.entry, found!.stage, found!.day], [null, null, null])
  assert.equal(found!.sides.length, 2)
})

test("the game played last comes first", () => {
  const feed = feedOf([game("g1", "s1", { number: 1 }), game("g2", "s1", { number: 2 }), game("g3", "s2")])
  assert.deepEqual(
    feed.games.map(({ id }) => id),
    ["g3", "g2", "g1"],
  )
})

test("of two matches that start together the one the plan has later was played later", () => {
  const view = roundRobinView([
    { key: "final", seriesId: "a-final", a: "x", b: "y", round: 4, scheduledAt: on(1) },
    { key: "semi", seriesId: "b-semi", a: "x", b: "z", round: 3, scheduledAt: on(1) },
  ])
  assert.deepEqual(
    feedOf([game("g1", "b-semi"), game("g2", "a-final")], view).games.map(({ id }) => id),
    ["g2", "g1"],
  )
})

test("of two matches of one round that start together the plan's order decides", () => {
  const view = roundRobinView([
    { key: "first", seriesId: "a", a: "x", b: "y", scheduledAt: on(1) },
    { key: "second", seriesId: "b", a: "x", b: "z", scheduledAt: on(1) },
  ])
  assert.deepEqual(
    feedOf([game("g1", "a"), game("g2", "b")], view).games.map(({ id }) => id),
    ["g2", "g1"],
  )
})

test("a player the roster does not list goes by the name the games give", () => {
  const view = roundRobinView()
  const listed = { ...view, content: { ...view.content, players: { p1: { code: "p1", nickname: "Roster" } } } }
  const played = game("g1", "s1", { blue: { team: "x", picks: five("a"), players: ["p1", "p2"] } })
  const { players } = gameFeed(listed, lineups([played])).view.content
  assert.deepEqual([players.p1?.nickname, players.p2?.nickname], ["Roster", "p2"])
})

test("a competition whose roster lists everybody who played is handed on as it is", () => {
  const listed = roundRobinView()
  listed.content.players = { p1: { code: "p1", nickname: "Roster" } } as typeof listed.content.players
  const played = game("g1", "s1", { blue: { team: "x", picks: five("a"), players: ["p1"] } })
  assert.equal(gameFeed(listed, lineups([played])).view, listed)
})

/** Lineups without a ban, and with the bans of one side alone. */
const unseen = { blue: { team: "x", picks: five("a") }, red: { team: "y", picks: five("b") } }
const halfSeen = { ...unseen, red: { team: "y", picks: five("b"), bans: ["k2"] } }

test("a game without a single ban is one whose bans nobody wrote down", () => {
  const [seen, open] = feedOf([game("g1", "s2"), game("g2", "s1", unseen)]).games
  assert.deepEqual([showsBans(seen!), showsBans(open!)], [true, false])
})

test("a game that names the bans of one side shows its bans", () => {
  assert.equal(showsBans(feedOf([game("g1", "s1", halfSeen)]).games[0]!), true)
})

test("the games counted are told apart by whether they show their bans", () => {
  const { games } = feedOf([game("g1", "s1"), game("g2", "s1", unseen), game("g3", "s1", halfSeen)])
  assert.deepEqual(countGames(games), { games: 3, shown: 2 })
})

test("an average length is that of the games whose length is known", () => {
  const { games } = feedOf([game("g1", "s1", { seconds: 371 }), game("g2", "s1", { seconds: 490 }), game("g3", "s1")])
  assert.equal(averageSeconds(games), 431)
})

test("games whose length nobody knows have no average", () => {
  assert.equal(averageSeconds(feedOf([game("g1", "s1")]).games), null)
})

test("a side knows whether it won, and nothing while no winner is recorded", () => {
  const [decided, open] = feedOf([game("g1", "s2", { winner: "RED" }), game("g2", "s1", { winner: null })]).games
  assert.equal(wonBy(decided!, sideOf(decided!, "y")!), true)
  assert.equal(wonBy(decided!, sideOf(decided!, "x")!), false)
  assert.equal(wonBy(open!, open!.sides[0]!), null)
})

test("a hero is found by its code, its id and its name", () => {
  const feed = feedOf([game("g1", "s1")])
  for (const key of ["a1", "id-a1", "A1"]) assert.equal(heroByKey(feed, key)?.key, "a1")
  assert.equal(heroByKey(feed, "nobody"), null)
  assert.equal(heroByKey(feed, null), null)
})

const patches = [
  { label: "Tuần 1", releasedOn: "2026-10-01" },
  { label: "Tuần 2", releasedOn: "2026-10-20" },
]

test("the weeks a label names decide the patch before its release day does", () => {
  assert.equal(patchLine(patches, "2026-11-01", 1), 1)
  assert.equal(patchLine(patches, "2026-11-09", 2), 2)
  assert.equal(patchLine(patches, "2026-11-20", 3), null)
})

test("without weeks the patch released last by that day is the one", () => {
  const lines = [{ releasedOn: "2026-10-01" }, { releasedOn: "2026-10-20" }]
  assert.equal(patchLine(lines, "2026-10-19", 1), 1)
  assert.equal(patchLine(lines, "2026-10-20", 1), 2)
  assert.equal(patchLine(lines, "2026-09-30", 1), null)
  assert.equal(patchLine([{ name: "One" }], null, null), 1)
  assert.equal(patchLine([], "2026-10-20", 1), null)
})

test("where a label names no weeks the release days decide for all of them", () => {
  const lines = [
    { label: "Tuần 1", releasedOn: "2026-10-01" },
    { label: "Sau nghỉ", releasedOn: "2026-10-20" },
  ]
  assert.equal(patchLine(lines, "2026-10-25", 1), 2)
})

const patched = roundRobinView(roundRobin, {
  stages: [stage("RR", { format: "ROUND_ROBIN", winPoints: 1, lossPoints: 0, patches })],
})

test("a stage with several patches is offered whole and patch by patch", () => {
  const feed = feedOf([game("g1", "s1"), game("g2", "s2"), game("g3", "s3")], patched)
  assert.deepEqual(
    feed.periods.map(({ key, games }) => [key, games]),
    [
      ["RR", 3],
      ["RR.1", 2],
      ["RR.2", 1],
    ],
  )
})

test("a stage whose games fall under a single patch is offered whole alone", () => {
  const feed = feedOf([game("g1", "s1"), game("g2", "s2")], patched)
  assert.deepEqual(
    feed.periods.map(({ key }) => key),
    ["RR"],
  )
})

test("a scope keeps the games of its period, and an unknown one keeps them all", () => {
  const feed = feedOf([game("g1", "s1"), game("g2", "s2"), game("g3", "s3")], patched)
  assert.deepEqual(
    feedScope(feed, "RR.2").feed.games.map(({ id }) => id),
    ["g3"],
  )
  assert.equal(feedScope(feed, "RR").feed.games.length, 3)
  const unknown = feedScope(feed, "KO")
  assert.equal(unknown.feed, feed)
  assert.equal(unknown.period, null)
})

test("a stage without games is no period", () => {
  const view = roundRobinView(roundRobin, {
    stages: [stage("RR", { format: "ROUND_ROBIN", winPoints: 1, lossPoints: 0 }), stage("KO")],
  })
  assert.deepEqual(
    feedOf([game("g1", "s1")], view).periods.map(({ key }) => key),
    ["RR"],
  )
})

test("a match without a day leaves its games without one", () => {
  const view = roundRobinView([{ key: "m1", seriesId: "s1", a: "x", b: "y" }])
  const [found] = feedOf([game("g1", "s1")], view).games
  assert.deepEqual([found!.day, found!.at, found!.week], [null, 0, null])
})
