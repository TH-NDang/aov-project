import assert from "node:assert/strict"
import { test } from "node:test"
import { shownStages, teamOrder } from "../src/lib/standings-order.ts"
import { competition, on, stage, type TestMatch } from "./fixtures/competition.ts"
import { leagueMatches, leagueView } from "./fixtures/league.ts"

const codes = (view: Parameters<typeof shownStages>[0]) => shownStages(view).map(({ stage: { code } }) => code)
const cup: TestMatch[] = [{ key: "k1", stageCode: "KO", a: "d", b: "c", score: [3, 1], scheduledAt: on(9) }]
const league = leagueView(leagueMatches, { stages: [stage("KO")], later: cup })

test("the stage played last comes first, with the bracket or the table it is", () => {
  assert.deepEqual(
    shownStages(league).map(({ stage: { code }, table, stepped }) => [code, !!table, !!stepped]),
    [
      ["KO", false, false],
      ["RR", true, true],
    ],
  )
})

test("a round robin without a table is not shown", () => {
  const view = leagueView(leagueMatches, { stages: [stage("KO")], later: cup })
  view.content.standings = []
  assert.deepEqual(codes(view), ["KO"])
})

const groups = (bStart: string) =>
  competition(
    [
      { key: "a1", stageCode: "A", a: "a", b: "b", scheduledAt: "2026-11-01T05:00:00Z" },
      { key: "a2", stageCode: "A", a: "a", b: "c", scheduledAt: "2026-11-02T05:00:00Z" },
      { key: "b1", stageCode: "B", a: "d", b: "e", scheduledAt: bStart },
    ],
    { stages: [stage("A"), stage("B")] },
  )

test("stages played beside each other keep the order of the plan", () => {
  assert.deepEqual(codes(groups("2026-11-01T08:00:00Z")), ["A", "B"])
})

test("a stage that begins when the one before it is over comes first", () => {
  assert.deepEqual(codes(groups("2026-11-02T08:00:00Z")), ["B", "A"])
})

test("a stage that begins days into the one before it is no stage beside it", () => {
  const view = competition(
    [
      { key: "a1", stageCode: "A", a: "a", b: "b", scheduledAt: on(1) },
      { key: "a2", stageCode: "A", a: "a", b: "c", scheduledAt: on(9) },
      { key: "b1", stageCode: "B", a: "d", b: "e", scheduledAt: on(5) },
    ],
    { stages: [stage("A"), stage("B")] },
  )
  assert.deepEqual(codes(view), ["B", "A"])
})

test("teams stand where the last stage they played in left them", () => {
  // D won the cup against C; A and B were left in the league.
  assert.deepEqual(teamOrder(league, shownStages(league)), ["d", "c", "a", "b"])
})
