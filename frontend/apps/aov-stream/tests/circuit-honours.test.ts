import assert from "node:assert/strict"
import { test } from "node:test"
import { circuitHonours } from "../src/lib/circuit-honours.ts"
import { competition } from "./fixtures/competition.ts"

const season = (id: string, year: number | null, startsOn: string | null, winner: string, extra: object = {}) =>
  competition([{ key: "f", a: winner, b: "z", score: [4, 2] }], {
    id,
    tournament: { name: id, status: "FINISHED", year, startsOn, ...extra },
  })
const views = [
  season("spring25", 2025, "2025-02-22", "a"),
  season("winter26", 2026, "2026-08-29", "b"),
  season("spring26", 2026, "2026-02-28", "a"),
  season("qualifier26", 2026, "2026-08-01", "z", { parentTournamentId: "winter26" }),
]

test("seasons are gathered by year, the newest first, each with its parts", () => {
  assert.deepEqual(
    circuitHonours(views).years.map(({ year, seasons }) => [
      year,
      seasons.map(({ view, parts }) => [view.id, parts.map((part) => part.id)]),
    ]),
    [
      [
        2026,
        [
          ["winter26", ["qualifier26"]],
          ["spring26", []],
        ],
      ],
      [2025, [["spring25", []]]],
    ],
  )
})

test("teams are counted by the seasons they won, and parts crown nobody", () => {
  assert.deepEqual(
    circuitHonours(views).titles.map(({ team, count }) => [team.id, count]),
    [
      ["a", 2],
      ["b", 1],
    ],
  )
})

test("a season still on has no champion", () => {
  const { years, titles } = circuitHonours([season("on", 2026, "2026-11-01", "a", { status: "ONGOING" })])

  assert.equal(years[0]!.seasons[0]!.champion, null)
  assert.deepEqual(titles, [])
})

test("a season whose year is not known comes last", () => {
  assert.deepEqual(
    circuitHonours([season("unknown", null, null, "a"), ...views]).years.map((item) => item.year),
    [2026, 2025, null],
  )
})
