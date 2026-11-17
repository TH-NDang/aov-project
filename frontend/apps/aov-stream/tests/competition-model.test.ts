import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  CompetitionSlot,
  CompetitionView,
  PlannedMatch,
  ResolvedMatch,
  TeamContent,
  TournamentContent,
} from "@aov/community-contracts"
import {
  bracketLanes,
  bySoonest,
  champion,
  competitionStatus,
  matchRoundLabel,
  matchStrip,
  playedOrder,
} from "../src/lib/competition-model.ts"

/** 01:00 on 17 November in Hanoi, still 16 November in UTC. */
const AFTER_HANOI_MIDNIGHT = Date.parse("2026-11-16T18:00:00Z")
const dated = (startsOn: string, endsOn: string, timezone = "Asia/Ho_Chi_Minh", status?: TournamentContent["status"]) =>
  ({
    tournament: { code: "aog", name: "AOG", region: "VN", startsOn, endsOn, status },
    plan: { timezone },
  }) as unknown as CompetitionView["content"]

test("a competition that starts today where it is played is ongoing just after local midnight", () => {
  assert.equal(competitionStatus(dated("2026-11-17", "2026-11-20"), AFTER_HANOI_MIDNIGHT), "ONGOING")
})

test("a competition that ended yesterday where it is played is finished just after local midnight", () => {
  assert.equal(competitionStatus(dated("2026-11-10", "2026-11-16"), AFTER_HANOI_MIDNIGHT), "FINISHED")
})

test("the dates are read on the competition's own calendar, not in UTC", () => {
  assert.equal(
    competitionStatus(dated("2026-11-17", "2026-11-20", "America/Los_Angeles"), AFTER_HANOI_MIDNIGHT),
    "UPCOMING",
  )
})

test("an edited status wins over the dates", () => {
  const edited = dated("2026-11-17", "2026-11-20", "Asia/Ho_Chi_Minh", "FINISHED")

  assert.equal(competitionStatus(edited, AFTER_HANOI_MIDNIGHT), "FINISHED")
})
import { competitionMatches } from "../src/lib/match-model.ts"

const HOUR = 60 * 60 * 1000
const NOW = Date.parse("2026-11-13T12:00:00Z")
const at = (hours: number) => new Date(NOW + hours * HOUR).toISOString()

const team = (teamId: string): CompetitionSlot => ({ type: "TEAM", teamId })
const winner = (matchKey: string): CompetitionSlot => ({ type: "WINNER", matchKey })
const loser = (matchKey: string): CompetitionSlot => ({ type: "LOSER", matchKey })

const planned = (key: string, extra: Partial<PlannedMatch> = {}): PlannedMatch => ({
  key,
  stageCode: "PLAYOFF",
  round: 1,
  label: key,
  bestOf: 5,
  a: { type: "TBD" },
  b: { type: "TBD" },
  ...extra,
})

const entries = (matches: PlannedMatch[], resolved: ResolvedMatch[] = []) =>
  competitionMatches([{ id: "competition", content: { plan: { matches }, resolved } } as CompetitionView])

const scored = (key: string, scoreA: number, scoreB: number): ResolvedMatch => ({
  key,
  scoreA,
  scoreB,
  consistent: true,
})

test("the strip reads from now outward: on now, next soonest first, then results newest first", () => {
  const strip = matchStrip(
    entries(
      [
        planned("old-result", { scheduledAt: at(-72) }),
        planned("later", { scheduledAt: at(48) }),
        planned("new-result", { scheduledAt: at(-24) }),
        planned("underway", { scheduledAt: at(-1) }),
        planned("soon", { scheduledAt: at(2) }),
        planned("no-date"),
        planned("never-entered", { scheduledAt: at(-200) }),
      ],
      [scored("old-result", 3, 1), scored("new-result", 0, 3)],
    ),
    NOW,
  )
  assert.deepEqual(
    strip.map((entry) => entry.match.key),
    ["underway", "soon", "later", "new-result", "old-result"],
    "a match without a date, or one whose result was never entered, is not part of the strip",
  )
})

test("the strip keeps a few of each part, and a match on now takes a place from the coming ones", () => {
  const matches = [
    planned("underway", { scheduledAt: at(-2) }),
    ...[1, 2, 3].map((hours) => planned(`next-${hours}`, { scheduledAt: at(hours) })),
    ...[1, 2, 3].map((days) => planned(`done-${days}`, { scheduledAt: at(-24 * days) })),
  ]
  const results = [1, 2, 3].map((days) => scored(`done-${days}`, 3, 0))
  assert.deepEqual(
    matchStrip(entries(matches, results), NOW, 2, 2).map((entry) => entry.match.key),
    ["underway", "next-1", "done-1", "done-2"],
  )
})

test("a match stops counting as on now three hours after its start", () => {
  const match = [planned("stale", { scheduledAt: at(-3) })]
  assert.deepEqual(matchStrip(entries(match), NOW), [])
  assert.equal(matchStrip(entries(match), NOW - 1).length, 1)
})

test("a round label drops the pairing and the stage name that the row already shows", () => {
  const label = (text: string, stage?: string) =>
    matchRoundLabel(planned("m", { label: text }), stage ? { name: stage } : null)
  assert.equal(label("Vòng 18 · FPL vs SGP", "Vòng bảng"), "Vòng 18")
  assert.equal(label("Playoffs · BAC vs ANK", "Playoffs"), null)
  assert.equal(label("Thi đấu chính · HEV vs BĐ", "Thi đấu chính"), null)
  assert.equal(label("Chung kết tổng", "Playoffs"), "Chung kết tổng")
  assert.equal(label("Vòng 1 nhánh thua · 2", "Playoffs"), "Vòng 1 nhánh thua · 2")
  assert.equal(label("Matchweek 2 · A vs. B"), "Matchweek 2")
  assert.equal(label("Bye · Vòng 2B (0-1) Matches · HCMUTE vs TMU", "Vòng 1-3"), "Bye · Vòng 2B (0-1) Matches")
  assert.equal(label("Canvas vs Devs"), null, "a label that is only the pairing leaves nothing to show")
  assert.equal(label("Tứ kết · Bảng vsync"), "Tứ kết · Bảng vsync", "'vs' inside a word is not a pairing")
})

test("a plan without loser links is one lane laid out by round", () => {
  const lanes = bracketLanes([
    planned("final", { round: 2, a: winner("semi-1"), b: winner("semi-2") }),
    planned("semi-2", { round: 1, a: team("c"), b: team("d") }),
    planned("semi-1", { round: 1, a: team("a"), b: team("b") }),
  ])
  assert.deepEqual(
    lanes.map((lane) => [lane.key, lane.rounds.map((round) => round.matches.map((match) => match.key))]),
    [["rounds", [["semi-2", "semi-1"], ["final"]]]],
  )
})

test("a double elimination splits into the upper lane, the lower lane and the final between them", () => {
  const lanes = bracketLanes([
    planned("upper-1", { round: 1, a: { type: "SEED", seed: 1 }, b: { type: "SEED", seed: 3 } }),
    planned("upper-2", { round: 1, a: { type: "SEED", seed: 2 }, b: { type: "SEED", seed: 4 } }),
    planned("lower-1", { round: 2, a: loser("upper-1"), b: { type: "SEED", seed: 5 } }),
    planned("lower-2", { round: 2, a: loser("upper-2"), b: { type: "SEED", seed: 6 } }),
    planned("upper-final", { round: 2, a: winner("upper-1"), b: winner("upper-2") }),
    planned("lower-semi", { round: 3, a: winner("lower-1"), b: winner("lower-2") }),
    planned("lower-final", { round: 4, a: loser("upper-final"), b: winner("lower-semi") }),
    planned("grand-final", { round: 5, a: winner("upper-final"), b: winner("lower-final") }),
  ])
  const keys = (lane: (typeof lanes)[number]) =>
    lane.rounds.map((round) => [round.round, round.matches.map((match) => match.key)])
  assert.deepEqual(
    lanes.map((lane) => lane.key),
    ["upper", "lower", "final"],
  )
  assert.deepEqual(keys(lanes[0]!), [
    [1, ["upper-1", "upper-2"]],
    [2, ["upper-final"]],
  ])
  assert.deepEqual(
    keys(lanes[1]!),
    [
      [2, ["lower-1", "lower-2"]],
      [3, ["lower-semi"]],
      [4, ["lower-final"]],
    ],
    "a match fed only by lower-lane winners stays in the lower lane",
  )
  assert.deepEqual(keys(lanes[2]!), [[5, ["grand-final"]]])
})

test("a match for third place, fed by losers but leading nowhere, stays in the round layout", () => {
  const lanes = bracketLanes([
    planned("semi-1", { round: 1, a: team("a"), b: team("b") }),
    planned("semi-2", { round: 1, a: team("c"), b: team("d") }),
    planned("third-place", { round: 2, a: loser("semi-1"), b: loser("semi-2") }),
    planned("final", { round: 2, a: winner("semi-1"), b: winner("semi-2") }),
  ])
  assert.deepEqual(
    lanes.map((lane) => [lane.key, lane.rounds.map((round) => round.matches.map((match) => match.key))]),
    [
      [
        "rounds",
        [
          ["semi-1", "semi-2"],
          ["third-place", "final"],
        ],
      ],
    ],
  )
})

test("a loser coming from another stage does not make a lower lane", () => {
  const lanes = bracketLanes([
    planned("decider", { round: 1, a: loser("group-final"), b: team("c") }),
    planned("final", { round: 2, a: winner("decider"), b: team("d") }),
  ])
  assert.deepEqual(
    lanes.map((lane) => lane.key),
    ["rounds"],
  )
})

test("a lower lane without a deciding match has no final lane", () => {
  const lanes = bracketLanes([
    planned("upper-1", { round: 1, a: team("a"), b: team("b") }),
    planned("upper-2", { round: 1, a: team("c"), b: team("d") }),
    planned("upper-final", { round: 2, a: winner("upper-1"), b: winner("upper-2") }),
    planned("lower-1", { round: 2, a: loser("upper-1"), b: loser("upper-2") }),
    planned("lower-final", { round: 3, a: winner("lower-1"), b: loser("upper-final") }),
  ])
  assert.deepEqual(
    lanes.map((lane) => lane.key),
    ["upper", "lower"],
  )
})

const teams: Record<string, TeamContent> = {
  fpl: { code: "fpl", name: "FPT Polytechnic", shortName: "FPL", logoUrl: "fpl.png" },
  bme: { code: "bme", name: "BOOM Esports", shortName: "BME" },
}
const tournament = (result?: Partial<NonNullable<TournamentContent["result"]>> | null) =>
  ({
    code: "aog",
    name: "Đấu Trường Danh Vọng",
    region: "VN",
    result: result && { sourceUrl: "", verification: "PRIMARY", ...result },
  }) as TournamentContent

test("a competition without a final table or a recorded champion has no champion", () => {
  assert.equal(champion(tournament(), teams), null)
  assert.equal(champion(tournament(null), teams), null)
  assert.equal(champion(tournament({ winnerName: "", runnerUpName: "BOOM Esports" }), teams), null)
})

test("the champion saved in the final table is matched to its team by id", () => {
  const finished = {
    ...tournament(),
    placements: [
      { place: "1", teamId: "fpl", teamName: "FPT Polytechnic", lastOpponent: "BOOM Esports", lastScore: "4-2" },
      { place: "2", teamId: "bme", teamName: "BOOM Esports" },
    ],
  }

  const won = champion(finished, teams)

  assert.equal(won?.winner, teams.fpl)
  assert.equal(won?.runnerUp, teams.bme)
  assert.equal(won?.score, "4–2")
})

test("the champion and the runner-up are matched to their teams by full or short name", () => {
  const won = champion(
    tournament({ winnerName: "FPT Polytechnic", runnerUpName: "BME", winnerScore: 4, runnerUpScore: 2 }),
    teams,
  )
  assert.equal(won?.winner, teams.fpl)
  assert.equal(won?.runnerUp, teams.bme)
  assert.equal(won?.score, "4–2")
})

test("a champion outside the team list keeps its recorded name, and a missing score stays empty", () => {
  const won = champion(tournament({ winnerName: "Team Flash", runnerUpName: "", winnerScore: 3 }), teams)
  assert.deepEqual(won?.winner, { code: "", name: "Team Flash" })
  assert.equal(won?.runnerUp, null)
  assert.equal(won?.score, null)
})

test("stages follow their earliest dated match, and stages without dates keep the plan's order after them", () => {
  const stages = [
    { code: "playoffs" },
    { code: "round-4" },
    { code: "later" },
    { code: "rounds-1-3" },
    { code: "draft" },
  ]
  const order = playedOrder(stages, [
    planned("p1", { stageCode: "playoffs", scheduledAt: "2026-11-08T10:00:00+07:00" }),
    planned("r4", { stageCode: "round-4", scheduledAt: "2026-10-19T10:00:00+07:00" }),
    planned("r1", { stageCode: "rounds-1-3", scheduledAt: "2026-09-28T10:00:00+07:00" }),
    planned("r1b", { stageCode: "rounds-1-3", scheduledAt: "2026-10-05T10:00:00+07:00" }),
    planned("x", { stageCode: "later" }),
  ])
  assert.deepEqual(
    order.map((stage) => stage.code),
    ["rounds-1-3", "round-4", "playoffs", "later", "draft"],
  )
})

test("coming competitions sort soonest first, with undated ones last", () => {
  const view = (startsOn?: string) => ({ content: { tournament: { startsOn } } }) as CompetitionView
  const list = [view("2026-12-03"), view(), view("2026-11-16"), view("2026-11-08")].sort(bySoonest)
  assert.deepEqual(
    list.map((entry) => entry.content.tournament.startsOn),
    ["2026-11-08", "2026-11-16", "2026-12-03", undefined],
  )
})
