import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionStanding } from "@aov/community-contracts"
import {
  allPlayed,
  laterStages,
  meetings,
  standingGroups,
  tableOver,
  teamForm,
  teamRecord,
} from "../src/lib/standings-model.ts"
import { competition, matchesOf, on, stage, type TestMatch } from "./fixtures/competition.ts"
import { leagueMatches, leagueView } from "./fixtures/league.ts"

const league: TestMatch[] = [
  { key: "m1", a: "a", b: "b", score: [3, 1], scheduledAt: on(1) },
  { key: "m2", a: "c", b: "a", score: [3, 0], scheduledAt: on(2) },
  { key: "m3", a: "a", b: "b", score: [2, 3], scheduledAt: on(3) },
  { key: "m4", a: "a", b: "c", scheduledAt: on(9) },
]
const roundRobin = [stage("RR", { format: "ROUND_ROBIN" })]
const row = (teamId: string, rank: number) =>
  ({ rank, teamId, played: 1, won: 0, lost: 0, gameWins: 0, gameLosses: 0, points: 0 }) as CompetitionStanding

test("form lists the last results with the newest at the end", () => {
  const entries = matchesOf(competition(league, { stages: roundRobin }))

  assert.deepEqual(
    teamForm(entries, "a").map((mark) => mark.won),
    [true, false, false],
  )
  assert.deepEqual(
    teamForm(entries, "a", 2).map((mark) => mark.entry.match.key),
    ["m2", "m3"],
  )
})

test("a record counts decided matches and their games from the team's own side", () => {
  const entries = matchesOf(competition(league, { stages: roundRobin }))

  assert.deepEqual(teamRecord(entries, "a"), { played: 3, won: 1, lost: 2, gamesWon: 5, gamesLost: 7 })
})

test("meetings of two teams come newest first", () => {
  const entries = matchesOf(competition(league, { stages: roundRobin }))

  assert.deepEqual(
    meetings(entries, "b", "a").map((entry) => entry.match.key),
    ["m3", "m1"],
  )
})

const groupStage = (label: (group: string) => string): TestMatch[] =>
  ["abc", "def"].flatMap((teams, index) => {
    const [x, y, z] = teams
    const name = label(index ? "B" : "A")
    return [
      { key: `${x}${y}`, a: x, b: y, label: name },
      { key: `${y}${z}`, a: y, b: z, label: name },
    ]
  })
const groupsOf = (matches: TestMatch[], teams: string) => {
  const view = competition(matches, { stages: roundRobin })
  const table = { stageCode: "RR", complete: false, rows: [...teams].map((team, index) => row(team, index + 1)) }
  return standingGroups(view, table).map((group) => [
    group.name,
    group.rows.map((item) => `${item.rank}${item.teamId}`).join(" "),
  ])
}

test("teams that only meet among themselves are a group of their own, ranked from one", () => {
  assert.deepEqual(
    groupsOf(
      groupStage(() => "Ngày 1"),
      "adbecf",
    ),
    [
      ["1", "1a 2b 3c"],
      ["2", "1d 2e 3f"],
    ],
  )
})

test("a group takes the letter its matches carry", () => {
  assert.deepEqual(
    groupsOf(
      groupStage((group) => `Group ${group} Matches`),
      "dadbecf",
    ).map(([name]) => name),
    ["A", "B"],
  )
})

test("separate pairs are no groups", () => {
  const pairs: TestMatch[] = [
    { key: "x", a: "a", b: "b" },
    { key: "y", a: "c", b: "d" },
  ]

  assert.deepEqual(groupsOf(pairs, "abcd"), [[null, "1a 2b 3c 4d"]])
})

test("a team without a match in the stage is left out of its table", () => {
  assert.deepEqual(groupsOf([{ key: "x", a: "a", b: "b" }], "abz"), [[null, "1a 2b"]])
})

const level = (teamId: string, rank: number, gameWins: number, gameLosses: number) =>
  ({ ...row(teamId, rank), tied: rank === 1, points: rank === 1 ? 9 : 8, gameWins, gameLosses }) as CompetitionStanding
const levelTable = {
  stageCode: "RR",
  complete: false,
  rows: [level("a", 1, 30, 19), level("b", 1, 32, 19), level("c", 3, 28, 18)],
}
const placesOf = (tieBreakers: string[]) =>
  standingGroups(competition(league, { stages: [stage("RR", { format: "ROUND_ROBIN", tieBreakers })] }), levelTable)
    .flatMap((group) => group.rows)
    .map(({ teamId, rank, tied }) => [teamId, rank, tied])

test("teams level on points are told apart by their games where the plan records no rule", () => {
  assert.deepEqual(placesOf([]), [
    ["b", 1, false],
    ["a", 2, false],
    ["c", 3, false],
  ])
})

test("teams a recorded rule leaves level stay level", () => {
  assert.deepEqual(placesOf(["GAME_DIFF"]).slice(0, 2), [
    ["a", 1, true],
    ["b", 1, true],
  ])
})

test("places are counted without the teams that are left out", () => {
  // Z stands between the two, but has no match in the stage.
  assert.deepEqual(groupsOf([{ key: "x", a: "a", b: "b" }], "azb"), [[null, "1a 2b"]])
})

test("teams level in the table stay level in their group", () => {
  const view = competition(
    groupStage(() => "Ngày 1"),
    { stages: [stage("RR", { format: "ROUND_ROBIN", tieBreakers: ["GAME_DIFF"] })] },
  )
  const rows = [row("a", 1), row("b", 2), row("c", 2), row("d", 4), row("e", 5), row("f", 6)]
  const [first] = standingGroups(view, { stageCode: "RR", complete: false, rows })
  assert.deepEqual(
    first!.rows.map(({ teamId, rank, tied }) => [teamId, rank, tied]),
    [
      ["a", 1, false],
      ["b", 2, true],
      ["c", 2, true],
    ],
  )
})

const open = leagueMatches.map((match, index) => (index < 5 ? match : { ...match, score: undefined }))
const over = (view: ReturnType<typeof leagueView>) => tableOver(view, view.content.standings[0]!)

test("a table is final once every match has its result", () => {
  assert.equal(over(leagueView(leagueMatches, { complete: false })), true)
  assert.equal(over(leagueView(open, { complete: false })), false)
})

test("a drawn match is played once all its games were", () => {
  const drawn = (bestOf: number) => leagueView([{ ...leagueMatches[0]!, bestOf, score: [1, 1] }], { complete: false })
  const played = (view: ReturnType<typeof leagueView>) => allPlayed(view, view.content.standings[0]!)
  assert.equal(played(drawn(2)), true)
  assert.equal(played(drawn(3)), false)
})

/** A league of one drawn match whose table holds it as the given number of losses for both teams. */
const drawnLeague = (lost: number) => {
  const view = leagueView([{ ...leagueMatches[0]!, bestOf: 2, score: [1, 1] }])
  const table = view.content.standings[0]!
  table.rows = table.rows.map((item) => ({ ...item, lost }))
  return standingGroups(view, table).flatMap(({ rows }) => rows)
}

test("drawn matches stand apart in a table published before they were counted", () => {
  assert.deepEqual(
    drawnLeague(1).map(({ played, won, lost }) => [played, won, lost]),
    [
      [1, 0, 0],
      [1, 0, 0],
    ],
  )
})

test("a table that counts its drawn matches is left as it is", () => {
  const view = leagueView([
    { ...leagueMatches[0]!, bestOf: 2, score: [1, 1] },
    { key: "m7", a: "a", b: "b", score: [2, 0], scheduledAt: on(5) },
  ])
  assert.deepEqual(
    standingGroups(view, view.content.standings[0]!)
      .flatMap(({ rows }) => rows)
      .map(({ teamId, played, won, lost }) => [teamId, played, won, lost]),
    [
      ["a", 2, 1, 0],
      ["b", 2, 0, 1],
    ],
  )
})

test("a draw whose score contradicts its games is none", () => {
  const view = leagueView([
    { ...leagueMatches[0]!, score: [2, 0] },
    { key: "m7", a: "a", b: "b", score: [1, 1], scheduledAt: on(5) },
  ])
  view.content.resolved = view.content.resolved.map((result) =>
    result.key === "m7" ? { ...result, consistent: false } : result,
  )
  const [table] = view.content.standings
  table!.rows = table!.rows.map((row) => ({
    ...row,
    played: 1,
    won: Number(row.teamId === "a"),
    lost: Number(row.teamId === "b"),
  }))
  assert.deepEqual(
    standingGroups(view, table!)
      .flatMap(({ rows }) => rows)
      .map(({ teamId, lost }) => [teamId, lost]),
    [
      ["a", 0],
      ["b", 1],
    ],
  )
})

test("a table is final when the event is over, whatever was never played", () => {
  assert.equal(over(leagueView(open, { complete: false, tournament: { status: "FINISHED" } })), true)
})

test("a table nobody played in is not final", () => {
  const unplayed = leagueMatches.map(({ score: _, ...match }) => match)
  assert.equal(over(leagueView(unplayed, { complete: false, tournament: { status: "FINISHED" } })), false)
})

test("a table is final once a later stage with only some of its teams has begun", () => {
  const cup = (score?: [number, number]) =>
    leagueView(open, {
      complete: false,
      stages: [stage("KO")],
      later: [{ key: "k", stageCode: "KO", a: "c", b: "d", score, scheduledAt: on(9) }],
    })
  assert.equal(over(cup([3, 1])), true)
  assert.equal(over(cup()), false)
})

test("a second leg of the same teams does not close the table of the first", () => {
  const second = leagueMatches.map((match) => ({
    ...match,
    key: `${match.key}-2`,
    stageCode: "TWO",
    scheduledAt: on(9),
  }))
  const view = leagueView(open, {
    complete: false,
    stages: [stage("TWO", { format: "ROUND_ROBIN" })],
    later: second,
  })
  assert.equal(over(view), false)
})

test("the stages after one come in the order they are played", () => {
  const view = leagueView(leagueMatches, {
    stages: [stage("FINAL"), stage("SEMI")],
    later: [
      { key: "f", stageCode: "FINAL", a: "c", b: "d", scheduledAt: on(12) },
      { key: "s", stageCode: "SEMI", a: "c", b: "a", scheduledAt: on(9) },
    ],
  })
  assert.deepEqual(
    laterStages(view, "RR").map(({ code }) => code),
    ["SEMI", "FINAL"],
  )
  assert.deepEqual(laterStages(view, "FINAL"), [])
})
