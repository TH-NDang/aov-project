import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionStanding } from "@aov/community-contracts"
import { meetings, standingGroups, teamForm, teamRecord } from "../src/lib/standings-model.ts"
import { competition, matchesOf, on, stage, type TestMatch } from "./fixtures/competition.ts"

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
