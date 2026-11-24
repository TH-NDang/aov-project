import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView } from "@aov/community-contracts"
import {
  aheadCompetitions,
  circuitChampions,
  circuitGroups,
  circuitYears,
  seasonRows,
} from "../src/lib/directory-model.ts"
import { competition, on } from "./fixtures/competition.ts"

const finished = { status: "FINISHED" }

const event = (id: string, tournament: object, plan: object = {}): CompetitionView =>
  competition([{ key: "f", a: id, b: "z", score: [3, 0] }], { id, tournament, plan })
const ids = (views: CompetitionView[]) => views.map((view) => view.id)

test("what is on leads what is coming, soonest first, and a stale mark of coming is dropped", () => {
  const views = [
    event("later", { status: "UPCOMING", startsOn: "2026-12-20" }),
    event("sooner", { status: "UPCOMING", startsOn: "2026-12-01" }),
    event("stale", { status: "UPCOMING", startsOn: "2026-11-01", endsOn: "2026-11-08" }),
    event("on", { status: "ONGOING", startsOn: "2026-11-10", endsOn: "2026-12-10" }),
    event("over", { status: "FINISHED", startsOn: "2026-01-01" }),
  ]

  assert.deepEqual(ids(aheadCompetitions(views, Date.parse(on(24)))), ["on", "sooner", "later"])
})

test("a season is followed by its parts", () => {
  const rows = seasonRows([
    event("wildcard", { startsOn: "2026-05-01", parentTournamentId: "season" }),
    event("season", { startsOn: "2026-06-01" }),
    event("previous", { startsOn: "2026-05-15" }),
    event("orphan", { startsOn: "2026-01-01", parentTournamentId: "gone" }),
  ])

  assert.deepEqual(
    rows.map(({ view, part }) => [view.id, part]),
    [
      ["season", false],
      ["wildcard", true],
      ["previous", false],
      ["orphan", false],
    ],
  )
})

test("circuits follow their newest season and lone competitions close the list", () => {
  const groups = circuitGroups([
    event("x1", { startsOn: "2024-01-01" }, { circuit: "X" }),
    event("x2", { startsOn: "2023-01-01" }, { circuit: "X" }),
    event("y1", { startsOn: "2026-01-01" }, { circuit: "Y" }),
    event("y2", { startsOn: "2020-01-01" }, { circuit: "Y" }),
    event("alone", { startsOn: "2027-01-01" }, { circuit: "Z" }),
    event("none", { startsOn: "2019-01-01" }),
  ])

  assert.deepEqual(
    groups.map((group) => [group.key, group.rows.map(({ view }) => view.id).join(" ")]),
    [
      ["Y", "y1 y2"],
      ["X", "x1 x2"],
      ["other", "alone none"],
    ],
  )
})

test("a circuit's hall holds its finished seasons with a champion, newest first, and leaves the parts out", () => {
  const won = (name: string) => ({ ...finished, placements: [{ place: "1", teamName: name }] })
  const [group] = circuitGroups([
    event("open", { status: "ONGOING", startsOn: "2026-06-01" }, { circuit: "X" }),
    event("new", { ...won("Blue"), startsOn: "2025-06-01", year: 2025 }, { circuit: "X" }),
    event("old", { ...won("Red"), startsOn: "2020-06-01", year: 2020 }, { circuit: "X" }),
    event("part", { ...won("Green"), startsOn: "2025-05-01", parentTournamentId: "new" }, { circuit: "X" }),
  ])

  assert.deepEqual(ids(circuitChampions(group!)), ["new", "old"])
  assert.equal(circuitYears(group!.rows.map((row) => row.view)), "2020–2026")
  assert.equal(circuitYears([]), "")
})
