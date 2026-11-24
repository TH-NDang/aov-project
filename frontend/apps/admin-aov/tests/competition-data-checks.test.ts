import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  DocumentView,
  GameContent,
  PlayerContent,
  RosterMembershipContent,
  SeriesContent,
  StaffMember,
  TeamContent,
} from "@aov/community-contracts"
import {
  coreTeamName,
  dataIssues,
  staffMovedTo,
  type DataCheckInput,
} from "../src/features/competition/workspace/data-checks"

const view = <T>(id: string, content: T): DocumentView<T> => ({
  id,
  version: 0,
  createdAt: "",
  updatedAt: "",
  content,
  missingFields: [],
})
const roster = (id: string, teamId: string, playerId: string) =>
  view<RosterMembershipContent>(id, { tournamentId: "t", teamId, playerId })
const series = (id: string, teamAId: string, teamBId: string) =>
  view<SeriesContent>(id, { code: id, tournamentId: "t", teamAId, teamBId, bestOf: 5 } as SeriesContent)
const team = (name: string, extra: Partial<TeamContent> = {}): TeamContent => ({ code: name, name, ...extra })
const player = (nickname: string, aliases: string[] = []): PlayerContent => ({ code: nickname, nickname, aliases })
const entrant = (teamId: string) => ({ teamId, status: "REGISTERED", note: "" })
const coach = (teamId: string): StaffMember => ({ teamId, pageId: "davi", role: "COACH" })

const input = (overrides: Partial<DataCheckInput>): DataCheckInput => ({
  plan: { entrants: [entrant("bme"), entrant("fl")] },
  staff: [],
  rosters: [roster("r1", "bme", "anne"), roster("r2", "fl", "julius")],
  series: [series("s1", "bme", "fl")],
  games: [],
  teams: { bme: team("BOOM Esports", { shortName: "BME", aliases: ["boom vn"] }), fl: team("Team Flash") },
  players: new Map([
    ["anne", player("Anne")],
    ["julius", player("Julius")],
  ]),
  ...overrides,
})

test("the core name of a team drops the words that only say what it is or where it plays", () => {
  assert.equal(coreTeamName("BOOM Esports VN"), "boom")
  assert.equal(coreTeamName("Rex Regum Qeon Vietnam"), coreTeamName("Rex Regum Qeon VN"))
  assert.equal(coreTeamName("Saigon Phantom"), "saigonphantom")
})

test("a clean tournament has no issue", () => {
  assert.deepEqual(dataIssues(input({})), [])
})

test("a coach on a team that does not take part is offered the same-named team of the tournament", () => {
  const issues = dataIssues(
    input({
      staff: [coach("boom-vn"), coach("fl")],
      teams: { ...input({}).teams, "boom-vn": team("BOOM Esports VN") },
    }),
  )

  assert.equal(issues.length, 1)
  assert.equal(issues[0]!.kind, "STAFF_OFF_TEAMS")
  assert.equal(issues[0]!.kind === "STAFF_OFF_TEAMS" && issues[0]!.suggestedTeamId, "bme")
})

test("a coach whose team name meets no tournament team gets no suggestion", () => {
  const issues = dataIssues(input({ staff: [coach("x")], teams: { ...input({}).teams, x: team("Unknown Side") } }))

  assert.equal(issues[0]!.kind === "STAFF_OFF_TEAMS" && issues[0]!.suggestedTeamId, undefined)
})

test("two roster lines of one team whose players share a name are the same person", () => {
  const issues = dataIssues(
    input({
      rosters: [
        roster("r1", "bme", "anne"),
        roster("r2", "fl", "julius"),
        roster("r3", "fl", "chu"),
        roster("r4", "fl", "pikachu"),
      ],
      players: new Map([
        ["anne", player("Anne")],
        ["julius", player("Julius")],
        ["chu", player("Chu")],
        ["pikachu", player("Pikachu", ["Chu"])],
      ]),
    }),
  )

  assert.equal(issues.length, 1)
  assert.equal(issues[0]!.kind, "ROSTER_SAME_PERSON")
  assert.deepEqual(issues[0]!.kind === "ROSTER_SAME_PERSON" && issues[0]!.rows.map((row) => row.id), ["r3", "r4"])
})

test("a team that plays without a roster is offered the same-named team that has one and plays nothing", () => {
  const issues = dataIssues(
    input({
      rosters: [roster("r1", "smg-long", "hanzo"), roster("r2", "fl", "julius")],
      series: [series("s1", "smg", "fl")],
      teams: {
        smg: team("Still Moving Under Gunfire", { shortName: "smg" }),
        "smg-long": team("Still Moving Under Gunfire"),
        fl: team("Team Flash"),
      },
    }),
  )

  const issue = issues.find((row) => row.kind === "PLAYS_WITHOUT_ROSTER")
  assert.equal(issue?.kind === "PLAYS_WITHOUT_ROSTER" && issue.rosterTeamId, "smg-long")
  assert.deepEqual(issue?.kind === "PLAYS_WITHOUT_ROSTER" && issue.rosterRows.map((row) => row.id), ["r1"])
})

test("games whose MVP is written but not linked are counted", () => {
  const game = (id: string, note: string, mvpPlayerId?: string) =>
    view<GameContent>(id, { seriesId: "s1", number: 1, region: "VN", locale: "vi-VN", sides: [], note, mvpPlayerId })
  const issues = dataIssues(
    input({ games: [game("g1", "MVP: Anne"), game("g2", "MVP: Anne", "anne"), game("g3", "")] }),
  )

  assert.deepEqual(issues, [{ kind: "UNLINKED_MVP", key: "mvp", games: 1 }])
})

test("moving a staff line keeps the others and drops it when the target team already holds it", () => {
  const staff = [coach("boom-vn"), { teamId: "bme", pageId: "finn", role: "TEAM_ANALYST" as const }]

  assert.deepEqual(staffMovedTo(staff, coach("boom-vn"), "bme"), [coach("bme"), staff[1]])
  assert.deepEqual(staffMovedTo([...staff, coach("bme")], coach("boom-vn"), "bme"), [staff[1], coach("bme")])
})

test("games no patch line covers are counted once the stages have dated lines", () => {
  const plan = {
    entrants: [entrant("bme"), entrant("fl")],
    stages: [
      {
        patches: [
          { label: "Playoffs", releasedOn: "2026-10-15" },
          { label: "Week 1", releasedOn: "2026-08-13" },
        ],
      },
    ],
  } as DataCheckInput["plan"]
  const patchScopes = new Map([
    ["g1", { gameId: "g1", source: "STAGE" as const }],
    ["g2", { gameId: "g2", source: "NONE" as const }],
    ["g3", { gameId: "g3", source: "GAME" as const }],
  ])

  assert.deepEqual(dataIssues(input({ plan, patchScopes })), [
    { kind: "GAMES_OUTSIDE_PATCH_RANGE", key: "patch-range", games: 1, firstLineOn: "2026-08-13" },
  ])
  assert.deepEqual(dataIssues(input({ patchScopes })), [])
})
