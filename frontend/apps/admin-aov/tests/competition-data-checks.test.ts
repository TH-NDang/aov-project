import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  CompetitionPlan,
  DocumentView,
  GameContent,
  PlannedMatch,
  PlayerContent,
  ResolvedMatch,
  RosterMembershipContent,
  SeriesContent,
  StaffMember,
  TeamContent,
  TournamentContent,
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

const planned = (key: string, seriesId: string, scheduledAt: string, stageCode = "GROUP"): PlannedMatch => ({
  key,
  stageCode,
  round: 1,
  bestOf: 5,
  scheduledAt,
  a: { type: "TEAM", teamId: "bme" },
  b: { type: "TEAM", teamId: "fl" },
  seriesId,
})
const resolvedAs = (key: string, scoreA?: number, scoreB?: number): [string, ResolvedMatch] => [
  key,
  { key, teamAId: "bme", teamBId: "fl", scoreA, scoreB, consistent: true },
]
const won = (id: string, seriesId: string, teamId: string) =>
  view<GameContent>(id, {
    seriesId,
    winner: "BLUE",
    sides: [
      { side: "BLUE", teamId, bans: [], participants: [] },
      { side: "RED", teamId: "other", bans: [], participants: [] },
    ],
  } as unknown as GameContent)
const kinds = (overrides: Partial<DataCheckInput>) => dataIssues(input(overrides)).map((issue) => issue.kind)

test("a score the recorded games contradict is pointed out, and so is one nobody entered", () => {
  const matches = [planned("M1", "s1", "2026-09-01T05:00:00Z"), planned("M2", "s2", "2026-09-02T05:00:00Z")]
  const games = ["s1", "s2"].flatMap((id) => [1, 2, 3].map((n) => won(`${id}-${n}`, id, "bme")))

  assert.deepEqual(
    kinds({
      plan: { entrants: [entrant("bme"), entrant("fl")], matches },
      series: [series("s1", "bme", "fl"), series("s2", "bme", "fl")],
      games,
      resolved: new Map([resolvedAs("M1", 1, 3), resolvedAs("M2")]),
    }),
    ["SCORE_DIFFERS", "SCORE_UNREAD"],
  )
})

test("a full roster with two starters in one lane is pointed out", () => {
  const rows = (["TOP", "TOP", "MID", "DRAGON", "SUPPORT"] as const).map((lane, index) => {
    const row = roster(`r${index}`, "bme", `p${index}`)
    return { ...row, content: { ...row.content, lane, status: "ACTIVE" as const } }
  })

  const issue = dataIssues(input({ rosters: [...rows, roster("r9", "fl", "julius")] })).find(
    (entry) => entry.kind === "ROSTER_LANES",
  )

  assert.deepEqual(issue && "crowded" in issue && [issue.crowded, issue.empty], [["TOP"], ["JUNGLE"]])
})

test("a player who starts for two teams is pointed out", () => {
  const starts = (id: string, teamId: string) => {
    const row = roster(id, teamId, "anne")
    return { ...row, content: { ...row.content, status: "ACTIVE" as const } }
  }

  assert.deepEqual(kinds({ rosters: [starts("r1", "bme"), starts("r2", "fl")] }), ["PLAYER_TWO_TEAMS"])
})

test("stages out of order, matches outside the plan and one team at two places at once are pointed out", () => {
  const stage = (code: string) =>
    ({ code, name: code, format: "ROUND_ROBIN", patches: [] }) as unknown as CompetitionPlan["stages"][number]
  const matches = [
    planned("P", "s1", "2026-09-20T05:00:00Z", "PLAYOFF"),
    planned("G", "s2", "2026-09-01T05:00:00Z"),
    planned("H", "s3", "2026-09-01T05:00:00Z"),
  ]

  const found = kinds({
    plan: { entrants: [entrant("bme"), entrant("fl")], stages: [stage("PLAYOFF"), stage("GROUP")], matches },
    series: ["s1", "s2", "s3", "s4"].map((id) => series(id, "bme", "fl")),
    resolved: new Map([resolvedAs("P"), resolvedAs("G"), resolvedAs("H")]),
  })

  assert.deepEqual(found, ["SERIES_OUTSIDE_PLAN", "STAGE_ORDER", "TEAM_TWICE", "TEAM_TWICE"])
})

test("matches outside the tournament's dates widen them, and a status the dates contradict is pointed out", () => {
  const tournament = {
    code: "t",
    name: "T",
    region: "VN",
    startsOn: "2026-09-02",
    endsOn: "2026-09-10",
    status: "UPCOMING",
  } as TournamentContent

  const found = dataIssues(
    input({
      plan: {
        entrants: [entrant("bme"), entrant("fl")],
        timezone: "Asia/Ho_Chi_Minh",
        matches: [planned("M1", "s1", "2026-09-01T05:00:00Z")],
      },
      resolved: new Map([resolvedAs("M1")]),
      tournament,
    }),
  )

  assert.deepEqual(
    found.map((issue) =>
      issue.kind === "OUTSIDE_DATES"
        ? [issue.kind, issue.from, issue.to]
        : issue.kind === "STATUS_STALE" && issue.status,
    ),
    [["OUTSIDE_DATES", "2026-09-01", "2026-09-10"], "FINISHED"],
  )
})
