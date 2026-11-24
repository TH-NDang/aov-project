import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  CompetitionSlot,
  DocumentView,
  GameContent,
  PlannedMatch,
  ResolvedMatch,
  SeriesContent,
} from "@aov/community-contracts"
import {
  filterCounts,
  inferredLinks,
  linkedMatches,
  matchFilterOf,
  numberedRounds,
  pastedLinks,
  pastedScores,
  quickResultProblem,
  scoreFromGames,
  seedsFromTables,
  shiftedTimes,
  spreadTimes,
  stagesByDate,
  type MatchFacts,
} from "../src/features/competition/model/schedule-model"
import { templateStages } from "../src/features/competition/model/stage-templates"
import { layoutBracket } from "../src/features/competition/workspace/model"
import { plannedFromSeries } from "../src/features/competition/workspace/outside-series"

const team = (teamId: string): CompetitionSlot => ({ type: "TEAM", teamId })
const match = (key: string, a: string, b: string, scheduledAt?: string, more: Partial<PlannedMatch> = {}) =>
  ({ key, stageCode: "PO", round: 1, bestOf: 5, a: team(a), b: team(b), scheduledAt, ...more }) satisfies PlannedMatch
const result = (key: string, teamAId: string, teamBId: string, scoreA?: number, scoreB?: number): ResolvedMatch => ({
  key,
  teamAId,
  teamBId,
  scoreA,
  scoreB,
  consistent: true,
})
const byKey = (rows: ResolvedMatch[]) => new Map(rows.map((row) => [row.key, row]))
const view = <T>(id: string, content: T): DocumentView<T> => ({
  id,
  version: 0,
  createdAt: "",
  updatedAt: "",
  content,
  missingFields: [],
})
const series = (more: Partial<SeriesContent> = {}) =>
  view<SeriesContent>("s1", { code: "s1", tournamentId: "t", teamAId: "a", teamBId: "b", bestOf: 5, ...more })
const game = (winner: "BLUE" | "RED" | null, blue = "a", red = "b") =>
  view("g", {
    seriesId: "s1",
    winner,
    sides: [
      { side: "BLUE", teamId: blue, bans: [], participants: [] },
      { side: "RED", teamId: red, bans: [], participants: [] },
    ],
  } as unknown as GameContent)
const standing = (teamId: string, rank: number) => ({
  rank,
  teamId,
  played: 0,
  won: 0,
  lost: 0,
  gameWins: 0,
  gameLosses: 0,
  points: 0,
  tied: false,
  qualified: false,
})
const facts = (more: Partial<MatchFacts>): MatchFacts => ({
  match: match("M1", "a", "b", undefined, { seriesId: "s1" }),
  games: [],
  gamesKnown: true,
  ...more,
})

// A bracket of four as an import leaves it: every match names its teams, out of order, all in round one.
const loose = [
  match("F", "a", "c", "2026-07-03T10:00:00Z"),
  match("S1", "a", "b", "2026-07-01T10:00:00Z"),
  match("S2", "c", "d", "2026-07-02T10:00:00Z"),
  match("P3", "b", "d", "2026-07-03T08:00:00Z"),
]
const played = byKey([
  result("S1", "a", "b", 3, 1),
  result("S2", "c", "d", 3, 0),
  result("P3", "b", "d", 3, 2),
  result("F", "a", "c", 3, 2),
])

test("a loose bracket is linked by who won and who lost the match before", () => {
  const links = inferredLinks({ matches: loose }, "PO", played)

  assert.deepEqual(
    links.map((link) => [link.key, link.side, link.slot.type, link.slot.matchKey]),
    [
      ["P3", "a", "LOSER", "S1"],
      ["P3", "b", "LOSER", "S2"],
      ["F", "a", "WINNER", "S1"],
      ["F", "b", "WINNER", "S2"],
    ],
  )
})

test("linked matches are listed after the matches they wait for, with their depth as the round", () => {
  const links = inferredLinks({ matches: loose }, "PO", played)

  const linked = linkedMatches(loose, "PO", links)

  assert.deepEqual(
    linked.map((row) => [row.key, row.round]),
    [
      ["S1", 1],
      ["S2", 1],
      ["P3", 2],
      ["F", 2],
    ],
  )
  assert.equal(layoutBracket(linked).linked, true)
})

test("a match without a result leads nowhere", () => {
  const open = byKey([result("S1", "a", "b"), result("S2", "c", "d", 3, 0), result("F", "a", "c")])

  assert.deepEqual(
    inferredLinks({ matches: loose.slice(0, 3) }, "PO", open).map((link) => link.slot.matchKey),
    ["S2"],
  )
})

test("an outcome leads to one match at most", () => {
  const group = [
    match("A", "a", "b", "2026-07-01T10:00:00Z"),
    match("B", "a", "c", "2026-07-02T10:00:00Z", {
      a: { type: "WINNER", matchKey: "A" },
    }),
    match("C", "a", "d", "2026-07-03T10:00:00Z"),
  ]
  const rows = byKey([result("A", "a", "b", 3, 0), result("B", "a", "c"), result("C", "a", "d")])

  assert.deepEqual(inferredLinks({ matches: group }, "PO", rows), [])
})

test("times move together and a match without a time stays without one", () => {
  const moved = shiftedTimes([loose[0]!, match("X", "a", "b")], new Set(["F", "X"]), 90)

  assert.deepEqual(
    moved.map((row) => row.scheduledAt),
    ["2026-07-03T11:30:00.000Z", undefined],
  )
})

test("times spread over days on the wall clock of the tournament's zone", () => {
  const rows = ["1", "2", "3"].map((key) => match(key, "a", "b"))

  const spread = spreadTimes(
    rows,
    ["1", "2", "3"],
    { start: "2026-08-29T14:00", minutesApart: 180, perDay: 2, daysApart: 7 },
    "Asia/Ho_Chi_Minh",
  )

  assert.deepEqual(
    spread.map((row) => row.scheduledAt),
    ["2026-08-29T07:00:00.000Z", "2026-08-29T10:00:00.000Z", "2026-09-05T07:00:00.000Z"],
  )
})

test("rounds are numbered by day, by week, or by one match per team", () => {
  const rows = [
    match("1", "a", "b", "2026-07-04T05:00:00Z"),
    match("2", "c", "d", "2026-07-05T05:00:00Z"),
    match("3", "a", "c", "2026-07-11T05:00:00Z"),
  ]
  const rounds = (rule: "DAY" | "WEEK" | "ONCE_EACH") =>
    numberedRounds(rows, "PO", rule, "Asia/Ho_Chi_Minh", new Map()).map((row) => row.round)

  assert.deepEqual(rounds("DAY"), [1, 2, 3])
  assert.deepEqual(rounds("WEEK"), [1, 1, 2])
  assert.deepEqual(rounds("ONCE_EACH"), [1, 1, 2])
})

test("stages read in the order their first matches were played", () => {
  const stages = templateStages("LEAGUE_KNOCKOUT", "").reverse()
  const matches = [
    match("1", "a", "b", "2026-07-20T05:00:00Z", { stageCode: "PLAYOFF" }),
    match("2", "a", "b", "2026-07-01T05:00:00Z", { stageCode: "GROUP" }),
  ]

  assert.deepEqual(
    stagesByDate({ stages, matches }).map((stage) => stage.code),
    ["GROUP", "PLAYOFF"],
  )
})

test("the recorded games decide a score only when every one of them has a winner", () => {
  const content = series().content

  assert.deepEqual(scoreFromGames(content, [game("BLUE"), game("RED", "b", "a"), game("RED")]), { a: 2, b: 1 })
  assert.equal(scoreFromGames(content, [game("BLUE"), game(null)]), null)
})

test("a list narrows to what still needs work", () => {
  const scored = result("M1", "a", "b", 3, 1)
  const counts = filterCounts([
    facts({
      row: scored,
      series: series(),
      games: [game("BLUE"), game("BLUE"), game("RED"), game("RED"), game("RED")],
    }),
    facts({ match: match("M2", "a", "b", undefined, { seriesId: null }), row: result("M2", "a", "b") }),
    facts({
      match: match("M3", "a", "b", "2026-07-01T05:00:00Z", { seriesId: "s3" }),
      row: { ...scored, key: "M3", consistent: false },
    }),
  ])

  assert.deepEqual(
    [counts.NO_SCORE, counts.NOT_OPEN, counts.SCORE_DIFFERS, counts.MISMATCH, counts.GAMES_MISSING, counts.NO_TIME],
    [1, 1, 1, 1, 1, 2],
  )
})

test("a match whose games leave seats without a player is found by its own filter", () => {
  const counts = filterCounts([facts({ games: [game("BLUE")] }), facts({})])

  assert.equal(counts.PLAYERS_MISSING, 1)
})

test("games count as missing only once they were read", () => {
  const row = result("M1", "a", "b", 3, 1)

  assert.equal(filterCounts([facts({ row, gamesKnown: false })]).GAMES_MISSING, 0)
})

test("an unknown filter in a link shows every match", () => {
  assert.equal(matchFilterOf("SOMETHING"), "ALL")
})

test("pasted scores and links fill the rows they stand in", () => {
  assert.deepEqual(pastedScores("3-1\nno score\n2 : 3\n0\t3\n"), [
    { a: "3", b: "1" },
    null,
    { a: "2", b: "3" },
    { a: "0", b: "3" },
  ])
  assert.deepEqual(pastedLinks("Day 1 https://youtu.be/abc\n\nhttps://youtu.be/def"), [
    "https://youtu.be/abc",
    "",
    "https://youtu.be/def",
  ])
})

test("a quick result keeps the score rules of its BO and cannot clear a score", () => {
  const before = { scoreA: "", scoreB: "", video: "" }

  assert.equal(quickResultProblem(5, { ...before, scoreA: "3", scoreB: "2" }, before, "https://example.org"), null)
  assert.match(quickResultProblem(5, { ...before, scoreA: "2", scoreB: "2" }, before, "https://example.org")!, /BO5/)
  assert.match(quickResultProblem(5, before, { ...before, scoreA: "3", scoreB: "1" }, "https://example.org")!, /Xóa/)
  assert.match(quickResultProblem(5, { ...before, video: "abc" }, before, "")!, /https/)
})

test("a single table gives its teams the seeds in order", () => {
  const rows = ["sgp", "fpl", "bme"].map((teamId, index) => standing(teamId, index + 1))

  assert.deepEqual(
    seedsFromTables(
      templateStages("LEAGUE_KNOCKOUT", ""),
      [{ stageCode: "GROUP", complete: true, rows }],
      "PLAYOFF",
      2,
    ),
    { 1: "sgp", 2: "fpl" },
  )
})

test("two groups give their winners the first seeds", () => {
  const stages = templateStages("GROUPS_KNOCKOUT", "").map((stage) =>
    stage.code.startsWith("GROUP") ? { ...stage, teamIds: ["x"] } : stage,
  )
  const table = (stageCode: string, ids: string[]) => ({
    stageCode,
    complete: true,
    rows: ids.map((teamId, index) => standing(teamId, index + 1)),
  })
  const standings = [table("GROUP_A", ["a1", "a2"]), table("GROUP_B", ["b1", "b2"])]

  assert.deepEqual(seedsFromTables(stages, standings, "PLAYOFF", 4), { 1: "a1", 2: "b1", 3: "a2", 4: "b2" })
  assert.equal(seedsFromTables(stages, standings, "PLAYOFF", 6), null)
})

test("series outside the schedule become planned matches of the stage they name", () => {
  const plan = {
    stages: templateStages("LEAGUE_KNOCKOUT", ""),
    entrants: ["a", "b"].map((teamId) => ({ teamId, status: "REGISTERED", note: "" })),
    matches: [],
  }

  const [planned] = plannedFromSeries(plan, [series({ stage: "PLAYOFF" })])!

  assert.deepEqual([planned!.stageCode, planned!.seriesId, planned!.a.teamId], ["PLAYOFF", "s1", "a"])
  assert.equal(plannedFromSeries(plan, [series({ teamBId: "stranger" })]), null)
})
