import assert from "node:assert/strict"
import { test } from "node:test"
import { tournamentRow } from "./fixtures/tournament-list-data"

const { activeTournaments, championName, circuitGroups, foldGroups, groupYears } =
  await import("../src/features/tournaments/model/tournament-groups")
const { facetOptions } = await import("../src/features/tournaments/model/facet-options")

const apl = { id: "apl", name: "APL" }
const ids = (entries: { id: string }[]) => entries.map((entry) => entry.id)

test("tournaments of a circuit stand together, and those alone in theirs close the list in its order", () => {
  const rows = ["a", "b", "c", "d"].map((id) => tournamentRow(id, id))
  const groups = circuitGroups(
    rows,
    new Map([
      ["a", { id: "solo", name: "Solo" }],
      ["b", apl],
      ["d", apl],
    ]),
  )
  assert.deepEqual(
    groups.map((group) => [group.circuit?.name ?? null, ids(group.entries)]),
    [
      ["APL", ["b", "d"]],
      [null, ["a", "c"]],
    ],
  )
})

test("a folded group keeps its newest seasons, and one season left over is shown with them", () => {
  const group = (size: number) => ({
    key: "apl",
    circuit: apl,
    entries: Array.from({ length: size }, (_, index) =>
      tournamentRow(`s${index}`, `S${index}`, { year: 2026 - index }),
    ),
  })
  const [folded] = foldGroups([group(6)], () => false, 3)
  assert.deepEqual([folded!.entries.length, folded!.hidden, folded!.foldable], [3, 3, true])
  assert.equal(foldGroups([group(6)], () => true, 3)[0]!.hidden, 0)
  assert.equal(foldGroups([group(4)], () => false, 3)[0]!.hidden, 0)
  assert.equal(groupYears(group(3)), "2024–2026")
})

test("what is on comes before what is coming up, soonest first, and a past event is neither", () => {
  const rows = [
    tournamentRow("later", "Later", { status: "UPCOMING", startsOn: "2026-12-20" }),
    tournamentRow("soon", "Soon", { status: "UPCOMING", startsOn: "2026-12-03" }),
    tournamentRow("past", "Past", { status: "UPCOMING", startsOn: "2026-11-08", endsOn: "2026-11-08" }),
    tournamentRow("on", "On", { status: "ONGOING", startsOn: "2026-11-20", endsOn: "2026-11-30" }),
    tournamentRow("done", "Done", { status: "FINISHED" }),
  ]
  assert.deepEqual(ids(activeTournaments(rows, new Date("2026-11-24T05:00:00Z"))), ["on", "soon", "later"])
})

test("a champion is read from the final table, or from the result where there is none", () => {
  const result = { winnerName: "MAD Team" } as NonNullable<Parameters<typeof championName>[0]["result"]>
  assert.equal(championName({ placements: [{ place: "1", teamName: "FPT" }], result }), "FPT")
  assert.equal(championName({ result }), "MAD Team")
  assert.equal(championName({}), null)
})

test("a filter offers only values that find something, and keeps the one it is set to", () => {
  const label = (value: string) => `Hạng ${value}`
  assert.deepEqual(facetOptions({ B: 2, A: 3, C: 0 }, "", label, { order: ["S", "A", "B"] }), [
    ["A", "Hạng A (3)"],
    ["B", "Hạng B (2)"],
  ])
  assert.deepEqual(facetOptions({ A: 3 }, "S", label, { order: ["S", "A"] }), [
    ["S", "Hạng S (0)"],
    ["A", "Hạng A (3)"],
  ])
  const newestFirst = { compare: (a: string, b: string) => Number(b) - Number(a) }
  assert.deepEqual(
    facetOptions({ 2024: 1, 2026: 2, 2025: 3 }, "", String, newestFirst).map(([value]) => value),
    ["2026", "2025", "2024"],
  )
  assert.deepEqual(facetOptions(undefined, "S", label), [["S", "Hạng S"]], "no figures before they arrive")
})
