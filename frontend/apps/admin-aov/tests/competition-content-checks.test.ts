import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  CompetitionPlan,
  ContentVerification,
  DocumentView,
  PlannedMatch,
  RosterMembershipContent,
  SeriesContent,
  TournamentContent,
} from "@aov/community-contracts"
import {
  canonicalText,
  checkParts,
  checkTotals,
  contentToken,
  partChecks,
  type CheckInput,
} from "../src/features/competition/model/content-checks"

const view = <T>(id: string, content: T): DocumentView<T> => ({
  id,
  version: 0,
  createdAt: "",
  updatedAt: "",
  content,
  missingFields: [],
})
const tournament: TournamentContent = { code: "aic-2026", name: "AIC 2026", region: "VN", startsOn: "2026-11-01" }
const stage = (code: string, name: string) => ({
  code,
  name,
  format: "ROUND_ROBIN",
  bestOf: 3,
  legs: 1,
  winPoints: 1,
  lossPoints: 0,
  advance: 2,
  tieBreakers: [],
  sourceUrl: "",
})
const match = (key: string, stageCode: string, seriesId?: string): PlannedMatch => ({
  key,
  stageCode,
  round: 1,
  bestOf: 3,
  a: { type: "TEAM", teamId: "sgp" },
  b: { type: "TEAM", teamId: "tdt" },
  seriesId,
})
const plan: CompetitionPlan = {
  circuit: "AIC",
  organizer: "",
  timezone: "Asia/Ho_Chi_Minh",
  prizePool: "",
  currency: "",
  sourceUrl: "",
  notes: "",
  venues: [],
  entrants: [
    { teamId: "sgp", status: "REGISTERED", note: "" },
    { teamId: "tdt", status: "REGISTERED", note: "" },
  ],
  stages: [stage("GROUPS", "Vòng bảng"), stage("PLAYOFFS", "Vòng chung kết")],
  playoffSeeds: {},
  matches: [match("g1", "GROUPS", "s1")],
}
const roster = (playerId: string, extra: Partial<RosterMembershipContent> = {}): RosterMembershipContent => ({
  tournamentId: "t",
  teamId: "sgp",
  playerId,
  lane: "MID",
  ...extra,
})
const series = view<SeriesContent>("s1", {
  code: "s1",
  tournamentId: "t",
  teamAId: "sgp",
  teamBId: "tdt",
  bestOf: 3,
  result: { scoreA: 2, scoreB: 1, sourceUrl: "https://example.org", verification: "PRIMARY" },
})
const names: Record<string, string> = { sgp: "Saigon Phantom", tdt: "Team Flash" }
const input = (overrides: Partial<CheckInput> = {}): CheckInput => ({
  tournament,
  plan,
  rosters: [roster("lai-bang"), roster("ma-quoc", { lane: "JUNGLE" })],
  series: [series],
  teamName: (id) => names[id] ?? id,
  ...overrides,
})
const token = (parts: ReturnType<typeof checkParts>, part: string) => parts.find((row) => row.part === part)?.token
const mark = (part: string, contentToken: string, verifiedAt = "2026-11-28T03:00:00Z"): ContentVerification => ({
  id: `${part}-${contentToken}`,
  part,
  contentToken,
  verifiedAt,
  verifiedByName: "ndang",
})

test("a tournament is checked part by part, in the order of the steps", () => {
  const parts = checkParts(input())

  assert.deepEqual(
    parts.map((row) => [row.part, row.label, row.step]),
    [
      ["INFO", "Thông tin giải", "overview"],
      ["TEAM:sgp", "Saigon Phantom", "teams"],
      ["TEAM:tdt", "Team Flash", "teams"],
      ["FORMAT", "Thể thức", "format"],
      ["SCHEDULE:GROUPS", "Lịch & kết quả · Vòng bảng", "schedule"],
    ],
  )
  assert.deepEqual(parts.find((row) => row.part === "SCHEDULE:GROUPS")?.focus, { stage: "GROUPS" })
  assert.match(parts[0]!.token, /^fp1:[0-9a-f]{32}$/)
})

test("a stage without matches and a tournament without final standings have nothing to check", () => {
  const parts = checkParts(input())
  assert.equal(token(parts, "SCHEDULE:PLAYOFFS"), undefined)
  assert.equal(token(parts, "FINAL"), undefined)

  const finished = checkParts(input({ tournament: { ...tournament, awards: [], links: [{ label: "VOD", url: "x" }] } }))
  assert.ok(token(finished, "FINAL"))
})

test("the token stays while only the order of fields or an empty value changes", () => {
  assert.equal(contentToken({ a: 1, b: "x" }), contentToken({ b: "x", a: 1 }))
  assert.equal(contentToken({ a: 1, note: "" }), contentToken({ a: 1, note: null }))
  assert.equal(contentToken({ a: 1, list: [] }), contentToken({ a: 1 }))
  assert.equal(contentToken({ captain: false }), contentToken({}))
  assert.equal(canonicalText({ name: " Sài Gòn " }), canonicalText({ name: "Sài Gòn".normalize("NFD") }))
  assert.notEqual(contentToken({ a: 1 }), contentToken({ a: 2 }))
  assert.notEqual(contentToken(["x", "y"]), contentToken(["y", "x"]))
})

test("a change of a team's roster changes only that team's part", () => {
  const before = checkParts(input())
  const after = checkParts(input({ rosters: [roster("lai-bang", { lane: "DRAGON" }), roster("ma-quoc")] }))

  assert.notEqual(token(after, "TEAM:sgp"), token(before, "TEAM:sgp"))
  for (const part of ["INFO", "TEAM:tdt", "FORMAT", "SCHEDULE:GROUPS"])
    assert.equal(token(after, part), token(before, part))
})

test("a roster read in another order is the same roster", () => {
  const before = checkParts(input())
  const after = checkParts(input({ rosters: [roster("ma-quoc", { lane: "JUNGLE" }), roster("lai-bang")] }))
  assert.equal(token(after, "TEAM:sgp"), token(before, "TEAM:sgp"))
})

test("a new score changes the schedule of its stage, and a tournament field the information", () => {
  const before = checkParts(input())
  const scored = view<SeriesContent>("s1", {
    ...series.content,
    result: { ...series.content.result!, scoreB: 2, scoreA: 1 },
  })
  assert.notEqual(token(checkParts(input({ series: [scored] })), "SCHEDULE:GROUPS"), token(before, "SCHEDULE:GROUPS"))
  assert.notEqual(
    token(checkParts(input({ tournament: { ...tournament, endsOn: "2026-12-01" } })), "INFO"),
    token(before, "INFO"),
  )
  assert.equal(
    token(checkParts(input({ tournament: { ...tournament, status: "FINISHED" } })), "INFO"),
    token(before, "INFO"),
    "the status follows the dates and is no fact to check",
  )
})

test("a part reads as checked, changed since its check, or unchecked", () => {
  const parts = checkParts(input())
  const info = token(parts, "INFO")!
  const checks = partChecks(parts, [
    mark("INFO", info),
    mark("TEAM:sgp", "fp1:older", "2026-11-28T04:00:00Z"),
    mark("TEAM:sgp", "fp1:oldest", "2026-11-27T04:00:00Z"),
  ])

  const of = (part: string) => checks.find((row) => row.part === part)!
  assert.equal(of("INFO").state, "checked")
  assert.equal(of("INFO").mark?.contentToken, info)
  assert.equal(of("TEAM:sgp").state, "changed")
  assert.equal(of("TEAM:sgp").mark?.contentToken, "fp1:older", "the newest older check")
  assert.equal(of("TEAM:sgp").marks.length, 2)
  assert.equal(of("TEAM:tdt").state, "unchecked")
  assert.deepEqual(checkTotals(checks), { total: 5, checked: 1, changed: 1 })
})
