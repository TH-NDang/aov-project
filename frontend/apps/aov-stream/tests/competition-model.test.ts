import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  CompetitionView,
  PlannedMatch,
  ResolvedMatch,
  TeamContent,
  TournamentContent,
} from "@aov/community-contracts"
import {
  bySoonest,
  champion,
  competitionStatus,
  isElimination,
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

test("a match without a name reads its title in the reader's language", () => {
  const match = planned("m", { label: null, title: { kind: "ROUND_ROBIN", leg: 2, round: 4 } })

  assert.equal(matchRoundLabel(match, { name: "Vòng bảng" }, "vi-VN"), "Lượt 2, Vòng 4")
  assert.equal(matchRoundLabel(match, { name: "Vòng bảng" }, "en-US"), "Leg 2, Round 4")
})

test("a match without a name reads its title, whose number counts the matches of the round", () => {
  const match = planned("m", { label: null, title: { kind: "LOWER_ROUND", round: 1, number: 2 } })
  assert.equal(matchRoundLabel(match, null, "vi-VN"), "Vòng 1 nhánh thua, trận 2")
  assert.equal(matchRoundLabel(match, null, "en-US"), "Lower bracket round 1, match 2")
  assert.equal(matchRoundLabel(planned("m", { label: null }), null), null)
})

test("a round label drops the pairing and the stage name that the row already shows", () => {
  const label = (text: string, stage?: string) =>
    matchRoundLabel(planned("m", { label: text }), stage ? { name: stage } : null)
  assert.equal(label("Vòng 18 · FPL vs SGP", "Vòng bảng"), "Vòng 18")
  assert.equal(label("Playoffs · BAC vs ANK", "Playoffs"), null)
  assert.equal(label("Thi đấu chính · HEV vs BĐ", "Thi đấu chính"), null)
  assert.equal(label("Chung kết tổng", "Playoffs"), "Chung kết tổng")
  assert.equal(label("Vòng 1 nhánh thua · 2", "Playoffs"), "Vòng 1 nhánh thua, trận 2")
  assert.equal(label("Matchweek 2 · A vs. B"), "Tuần 2")
  assert.equal(label("Bye · Vòng 2B (0-1) Matches · HCMUTE vs TMU", "Vòng 1-3"), "Bye, Vòng 2B (0-1)")
  assert.equal(label("Canvas vs Devs"), null, "a label that is only the pairing leaves nothing to show")
  assert.equal(label("Tứ kết · Bảng vsync"), "Tứ kết, Bảng vsync", "'vs' inside a word is not a pairing")
})

test("a name that is a number alone counts no matches of a round", () => {
  assert.equal(matchRoundLabel(planned("m", { label: "12" }), null), "12")
})

test("a stage is a bracket by single and by double elimination", () => {
  const formats = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "ROUND_ROBIN", "CUSTOM"]
  assert.deepEqual(
    formats.filter((format) => isElimination({ format })),
    ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"],
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
