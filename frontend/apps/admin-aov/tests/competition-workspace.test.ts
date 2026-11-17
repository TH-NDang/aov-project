import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  CompetitionPlan,
  CompetitionSnapshot,
  CompetitionSlot,
  PlannedMatch,
  ResolvedMatch,
  TeamContent,
} from "@aov/community-contracts"
import {
  defaultGroupMode,
  groupMatches,
  layoutBracket,
  pendingChanges,
  resolvedIndex,
  resultProblem,
  rosterBoard,
  seedsFromStandings,
  slotText,
  stepFromParam,
  suggestedPlacements,
  workspaceChecks,
  zonedInputInstant,
  zonedInputTime,
} from "../src/features/competition/workspace/model"

const team = (id: string): CompetitionSlot => ({ type: "TEAM", teamId: id })
const seed = (value: number): CompetitionSlot => ({ type: "SEED", seed: value })
const winner = (key: string): CompetitionSlot => ({ type: "WINNER", matchKey: key })
const loser = (key: string): CompetitionSlot => ({ type: "LOSER", matchKey: key })
const match = (key: string, round: number, a: CompetitionSlot, b: CompetitionSlot, more: Partial<PlannedMatch> = {}) =>
  ({ key, stageCode: "PLAYOFF", round, label: key, bestOf: 7, a, b, ...more }) satisfies PlannedMatch

// The eight matches of the AOG playoff template, in plan order.
const playoffs = [
  match("US1", 1, seed(1), seed(3)),
  match("US2", 1, seed(2), seed(4)),
  match("LQ1", 2, seed(5), loser("US1")),
  match("LQ2", 2, seed(6), loser("US2")),
  match("UF", 2, winner("US1"), winner("US2")),
  match("LS", 3, winner("LQ1"), winner("LQ2")),
  match("LF", 4, loser("UF"), winner("LS")),
  match("GF", 5, winner("UF"), winner("LF")),
]

const teams = Object.fromEntries(
  ["sgp", "fpl", "bme", "fl", "gam", "box", "one"].map((id) => [id, { code: id, name: id.toUpperCase() }]),
) as Record<string, TeamContent>

const plan = (matches: PlannedMatch[], more: Partial<CompetitionPlan> = {}): CompetitionPlan => ({
  circuit: "",
  organizer: "",
  timezone: "Asia/Ho_Chi_Minh",
  prizePool: "",
  currency: "VND",
  sourceUrl: "https://example.org/rules",
  notes: "",
  venues: [],
  entrants: Object.keys(teams).map((teamId) => ({ teamId, status: "REGISTERED", note: "" })),
  stages: [
    {
      code: "GROUP",
      name: "Vòng bảng",
      format: "ROUND_ROBIN",
      bestOf: 5,
      legs: 2,
      winPoints: 1,
      lossPoints: 0,
      advance: 6,
      tieBreakers: [],
      sourceUrl: "",
      patchNote: "",
    },
    {
      code: "PLAYOFF",
      name: "Playoffs",
      format: "DOUBLE_ELIMINATION",
      bestOf: 7,
      legs: 1,
      winPoints: 1,
      lossPoints: 0,
      advance: 1,
      tieBreakers: [],
      sourceUrl: "",
      patchNote: "",
    },
  ],
  playoffSeeds: { 1: "sgp", 2: "fpl", 3: "bme", 4: "fl", 5: "gam", 6: "box" },
  matches,
  ...more,
})

const row = (key: string, a: string | null, b: string | null, scoreA?: number, scoreB?: number): ResolvedMatch => ({
  key,
  teamAId: a,
  teamBId: b,
  scoreA,
  scoreB,
  consistent: true,
})

test("old numeric step links open the step that took over their content", () => {
  assert.equal(stepFromParam(null), "overview")
  assert.equal(stepFromParam("schedule"), "schedule")
  assert.equal(stepFromParam("1"), "teams")
  assert.equal(stepFromParam("2"), "teams")
  assert.equal(stepFromParam("4"), "schedule")
  assert.equal(stepFromParam("5"), "publish")
  assert.equal(stepFromParam("nonsense"), "overview")
})

test("a stage in progress shows the group that needs a score first, then played groups latest first", () => {
  const at = (day: number) => `2026-10-${String(day).padStart(2, "0")}T06:00:00Z`
  const league = [1, 2, 3, 4].map((round) =>
    match(`R${round}`, round, team("sgp"), team("fpl"), { stageCode: "GROUP", scheduledAt: at(round) }),
  )
  const resolved = resolvedIndex([row("R1", "sgp", "fpl", 3, 0), row("R2", "sgp", "fpl", 3, 1)])
  assert.equal(defaultGroupMode(league), "round")
  assert.deepEqual(
    groupMatches(league, "round", "Asia/Ho_Chi_Minh", resolved).map((group) => group.round),
    [3, 4, 2, 1],
  )
  const done = resolvedIndex(league.map((entry) => row(entry.key, "sgp", "fpl", 3, 0)))
  assert.deepEqual(
    groupMatches(league, "round", "Asia/Ho_Chi_Minh", done).map((group) => group.round),
    [4, 3, 2, 1],
  )
})

test("days follow the tournament's time zone and imports without rounds fall back to days", () => {
  const sameRound = [
    match("A", 1, team("sgp"), team("fpl"), { scheduledAt: "2026-10-17T12:30:00Z" }),
    match("B", 1, team("bme"), team("fl"), { scheduledAt: "2026-10-17T18:30:00Z" }),
  ]
  assert.equal(defaultGroupMode(sameRound), "day")
  // 18:30 UTC is already the 18th in Ho Chi Minh City.
  assert.deepEqual(
    groupMatches(sameRound, "day", "Asia/Ho_Chi_Minh", new Map()).map((group) => group.day),
    ["2026-10-17", "2026-10-18"],
  )
})

test("the AOG template lays out as upper bracket, lower bracket and a final fed by both", () => {
  const layout = layoutBracket(playoffs)
  const node = (key: string) => layout.nodes.find((entry) => entry.match.key === key)!
  assert.equal(layout.linked, true)
  assert.deepEqual(
    layout.nodes.map((entry) => `${entry.match.key}:${entry.lane}:${entry.column}`),
    [
      "US1:upper:0",
      "US2:upper:0",
      "LQ1:lower:0",
      "LQ2:lower:0",
      "UF:upper:1",
      "LS:lower:1",
      "LF:lower:2",
      "GF:final:3",
    ],
  )
  assert.equal(node("UF").y, (node("US1").y + node("US2").y) / 2)
  assert.equal(node("LS").y, (node("LQ1").y + node("LQ2").y) / 2)
  assert.equal(node("GF").y, (node("UF").y + node("LF").y) / 2)
  assert.ok(node("LQ1").y > node("US2").y, "the lower bracket sits below the upper one")
  assert.deepEqual(node("LF").feeds, ["LS"], "a loser dropping in is not drawn as a line")
})

test("matches with fixed teams only are placed by their round, without lines", () => {
  const layout = layoutBracket([
    match("Q1", 1, team("sgp"), team("fpl")),
    match("Q2", 1, team("bme"), team("fl")),
    match("F", 2, team("sgp"), team("bme")),
  ])
  assert.equal(layout.linked, false)
  assert.deepEqual(
    layout.nodes.map((entry) => [entry.column, entry.feeds.length]),
    [
      [0, 0],
      [0, 0],
      [1, 0],
    ],
  )
  assert.deepEqual(layout.lanes, [])
})

test("an unresolved side reads as the seeded team, or as the match it waits for", () => {
  const value = plan(playoffs)
  assert.equal(slotText(seed(1), value, teams), "SGP")
  assert.equal(slotText(seed(9), value, teams), "Hạt giống 9")
  assert.equal(slotText(winner("LF"), value, teams), "Thắng LF")
  assert.equal(slotText(loser("UF"), value, teams), "Thua UF")
})

test("a score must fit the best-of and carry a source", () => {
  const source = "https://example.org/match"
  assert.equal(resultProblem(5, 3, 1, source), null)
  assert.equal(resultProblem(2, 1, 1, source), null)
  assert.match(resultProblem(5, 2, 1, source)!, /thắng 3 ván/)
  assert.match(resultProblem(5, 3, 3, source)!, /thắng 3 ván/)
  assert.match(resultProblem(2, 2, 1, source)!, /đủ 2 ván/)
  assert.match(resultProblem(5, 3, null, source)!, /đủ hai vế/)
  assert.match(resultProblem(5, 3, 1, "liquipedia")!, /link nguồn/)
})

test("seeds come from the table in order", () => {
  const rows = ["sgp", "fpl", "bme"].map((teamId, index) => ({
    rank: index + 1,
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    gameWins: 0,
    gameLosses: 0,
    points: 0,
    tied: false,
    qualified: true,
  }))
  assert.deepEqual(seedsFromStandings(rows, 2), { 1: "sgp", 2: "fpl" })
})

const snapshot = (resolved: ResolvedMatch[], value = plan(playoffs)): CompetitionSnapshot => ({
  tournament: { code: "aog", name: "AOG", region: "VN" },
  plan: value,
  teams,
  players: {},
  series: {},
  rosters: [],
  resolved,
  standings: [],
})

const played = [
  row("US1", "sgp", "bme", 4, 2),
  row("US2", "fpl", "fl", 4, 1),
  row("LQ1", "gam", "bme", 1, 4),
  row("LQ2", "box", "fl", 4, 3),
  row("UF", "sgp", "fpl", 3, 4),
  row("LS", "bme", "box", 4, 3),
  row("LF", "sgp", "bme"),
  row("GF", "fpl", null),
]

test("only what readers would see differently is listed before publishing again", () => {
  const live = snapshot(played)
  assert.deepEqual(pendingChanges(live, live), [])

  const next = played.map((entry) => (entry.key === "LF" ? row("LF", "sgp", "bme", 4, 2) : entry))
  assert.deepEqual(pendingChanges(snapshot(next), live), [{ kind: "score", text: "Tỷ số mới: SGP – BME 4 : 2" }])

  const corrected = played.map((entry) => (entry.key === "US1" ? row("US1", "sgp", "bme", 4, 3) : entry))
  assert.deepEqual(pendingChanges(snapshot(corrected), live), [
    { kind: "score", text: "Đổi tỷ số: SGP – BME 4 : 2 → 4 : 3" },
  ])

  const moved = plan(
    playoffs.map((entry) => (entry.key === "GF" ? { ...entry, scheduledAt: "2026-11-08T05:00:00Z" } : entry)),
  )
  assert.deepEqual(pendingChanges(snapshot(played, moved), live), [{ kind: "schedule", text: "Đổi giờ đấu 1 trận" }])
})

test("final places follow the bracket and wait for matches that are not played", () => {
  const standings = [
    {
      stageCode: "GROUP",
      complete: true,
      rows: Object.keys(teams).map((teamId, index) => ({
        rank: index + 1,
        teamId,
        played: 12,
        won: 0,
        lost: 0,
        gameWins: 0,
        gameLosses: 0,
        points: 0,
        tied: false,
        qualified: index < 6,
      })),
    },
  ]
  const lines = suggestedPlacements(plan(playoffs), played, standings, teams)
  assert.deepEqual(
    lines.map((line) => `${line.place}|${line.teamName}`),
    ["1|", "2|", "3|", "4|BOX", "5-6|GAM", "5-6|FL", "7|ONE"],
  )
  assert.equal(lines[2]!.reason, "Chờ LF")
  assert.equal(lines[3]!.reason, "Thua LS · 3–4")

  const finished = played.map((entry) =>
    entry.key === "LF" ? row("LF", "sgp", "bme", 4, 1) : entry.key === "GF" ? row("GF", "fpl", "sgp", 2, 4) : entry,
  )
  assert.deepEqual(
    suggestedPlacements(plan(playoffs), finished, standings, teams)
      .slice(0, 3)
      .map((line) => `${line.place}|${line.teamName}`),
    ["1|SGP", "2|FPL", "3|BME"],
  )
})

test("only required checks block publishing, and final places wait until the last match", () => {
  const checks = workspaceChecks({
    plan: plan(playoffs),
    resolved: played,
    rosters: [],
    placements: 0,
    now: Date.parse("2026-11-12T00:00:00Z"),
  })
  const state = (id: string) => checks.find((check) => check.id === id)!
  assert.deepEqual(
    checks.filter((check) => check.required).map((check) => [check.id, check.state]),
    [
      ["source", "ok"],
      ["entrants", "ok"],
      ["stages", "ok"],
    ],
  )
  assert.equal(state("organizer").required, false)
  assert.equal(state("rosters").state, "todo")
  assert.equal(state("placements").state, "waiting")
  assert.equal(state("placements").detail, "Chờ giải kết thúc")
})

test("a roster reads as five positions, then the bench, then who left", () => {
  const member = (playerId: string, status: string, lane: string | null) =>
    ({ tournamentId: "t", teamId: "sgp", playerId, status, lane }) as never
  const board = rosterBoard([
    member("sup", "ACTIVE", "SUPPORT"),
    member("mid-new", "ACTIVE", "MID"),
    member("top", "ACTIVE", "TOP"),
    member("mid-old", "INACTIVE", "MID"),
    member("bench", "SUBSTITUTE", "JUNGLE"),
    member("trial", "ACTIVE", null),
    member("unsure", undefined as never, null),
  ])
  assert.deepEqual(
    board.lanes.map((cell) => `${cell.lane}:${cell.players.map((row) => row.playerId).join("+")}`),
    ["TOP:top", "JUNGLE:", "MID:mid-new", "DRAGON:", "SUPPORT:sup"],
  )
  assert.deepEqual(
    [board.unplaced, board.bench, board.left, board.unknown].map((rows) => rows.map((row) => row.playerId)),
    [["trial"], ["bench"], ["mid-old"], ["unsure"]],
  )
})

test("a match time is typed on the wall clock of the tournament, whatever the zone of the machine", () => {
  assert.equal(zonedInputInstant("2026-11-20T19:30", "Asia/Ho_Chi_Minh"), "2026-11-20T12:30:00.000Z")
  assert.equal(zonedInputTime("2026-11-20T12:30:00.000Z", "Asia/Ho_Chi_Minh"), "2026-11-20T19:30")
  assert.equal(zonedInputTime("2026-11-20T12:30:00.000Z", "Europe/Berlin"), "2026-11-20T13:30")
  assert.equal(zonedInputInstant("", "Asia/Ho_Chi_Minh"), null)
  assert.equal(zonedInputTime(null, "Asia/Ho_Chi_Minh"), "")
})

test("a match time next to a clock change keeps the offset of its own day", () => {
  // New York leaves summer time on 1 November 2026: 09:00 that morning is UTC-5, the evening before UTC-4.
  assert.equal(zonedInputInstant("2026-11-01T09:00", "America/New_York"), "2026-11-01T14:00:00.000Z")
  assert.equal(zonedInputInstant("2026-10-31T21:00", "America/New_York"), "2026-11-01T01:00:00.000Z")
})
