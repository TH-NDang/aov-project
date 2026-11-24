import assert from "node:assert/strict"
import { test } from "node:test"
import { competitionProgress, stagePhases } from "../src/lib/stage-phases.ts"
import { competition, on, stage } from "./fixtures/competition.ts"

const finished = { status: "FINISHED" }

test("stages come in play order with their days and how far each has come", () => {
  const view = competition(
    [
      { key: "f", stageCode: "KO", a: "a", b: "b", scheduledAt: on(20) },
      { key: "m1", stageCode: "RR", a: "a", b: "b", score: [3, 0], scheduledAt: on(1) },
      { key: "m2", stageCode: "RR", a: "a", b: "c", scheduledAt: on(5) },
    ],
    { stages: [stage("KO"), stage("RR", { format: "ROUND_ROBIN" })] },
  )

  assert.deepEqual(
    stagePhases(view, Date.parse(on(3))).map(({ stage: item, startsOn, endsOn, played, matches, state }) => [
      item.code,
      startsOn,
      endsOn,
      played,
      matches,
      state,
    ]),
    [
      ["RR", "2026-11-01", "2026-11-05", 1, 2, "NOW"],
      ["KO", "2026-11-20", "2026-11-20", 0, 1, "NEXT"],
    ],
  )
  assert.deepEqual(competitionProgress(view), { played: 1, total: 3 })
})

test("every stage of a finished event is done, even with results never entered", () => {
  const view = competition([{ key: "m", a: "a", b: "b", scheduledAt: on(1) }], { tournament: finished })

  assert.deepEqual(
    stagePhases(view).map((phase) => phase.state),
    ["DONE"],
  )
})
