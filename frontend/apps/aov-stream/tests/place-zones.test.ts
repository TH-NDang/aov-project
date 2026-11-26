import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionSlot, CompetitionView } from "@aov/community-contracts"
import { comparedPlaces, isOut, placesBefore, placeZones } from "../src/lib/place-zones.ts"
import { on, stage, winnerOf, type TestMatch } from "./fixtures/competition.ts"
import { leagueMatches, leagueView } from "./fixtures/league.ts"

// The table of the league reads C and D first, then A, then B.
const playoffs = (later: TestMatch[], extra: object = {}) =>
  leagueView(leagueMatches, {
    extra: { advance: 2, ...extra },
    stages: [stage("KO")],
    later: later.map((match) => ({ stageCode: "KO", ...match })),
  })
const seed = (value: number): CompetitionSlot => ({ type: "SEED", seed: value })
const read = (view: CompetitionView, onlyGroup = true) => {
  const table = view.content.standings[0]!
  return placeZones(view, view.content.plan.stages[0]!, table.rows, true, onlyGroup)
}
const zonesOf = (view: CompetitionView, onlyGroup = true) =>
  read(view, onlyGroup).zones.map(({ from, to, way }) => [
    from,
    to,
    way.kind === "ROUND" ? way.round.lane + way.round.left : way.kind,
  ])

test("places lead to the round their teams first play in", () => {
  const view = playoffs([
    { key: "k1", a: "c", b: "d", score: [3, 1], scheduledAt: on(9) },
    { key: "k2", a: "c", b: "a", score: [3, 1], scheduledAt: on(10) },
  ])
  assert.deepEqual(zonesOf(view), [
    [1, 2, "rounds1"],
    [3, 3, "rounds0"],
    [4, 4, "OUT"],
  ])
})

test("seeds tell where places lead before the teams are known", () => {
  const view = playoffs([
    { key: "k1", a: seed(1), b: seed(2), scheduledAt: on(9) },
    { key: "k2", a: winnerOf("k1"), b: seed(3), scheduledAt: on(10) },
  ])
  assert.deepEqual(zonesOf(view), [
    [1, 2, "rounds1"],
    [3, 3, "rounds0"],
    [4, 4, "OUT"],
  ])
})

test("a team already on its seed keeps its way while the other seeds are open", () => {
  const view = playoffs([
    { key: "k1", a: { ...seed(1), teamId: "c" }, b: seed(2), scheduledAt: on(9) },
    { key: "k2", a: winnerOf("k1"), b: seed(3), scheduledAt: on(10) },
  ])
  assert.deepEqual(zonesOf(view), [
    [1, 2, "rounds1"],
    [3, 3, "rounds0"],
    [4, 4, "OUT"],
  ])
})

test("seeds are no places where the stage has several tables", () => {
  const view = playoffs([
    { key: "k1", a: seed(1), b: seed(2), scheduledAt: on(9) },
    { key: "k2", a: winnerOf("k1"), b: seed(3), scheduledAt: on(10) },
  ])
  assert.deepEqual(zonesOf(view, false), [])
})

test("seeds that would fill every place are none where the stage has several tables", () => {
  const view = playoffs([
    { key: "k1", a: seed(3), b: seed(4), scheduledAt: on(9) },
    { key: "k2", a: winnerOf("k1"), b: seed(2), scheduledAt: on(10) },
    { key: "k3", a: winnerOf("k2"), b: seed(1), scheduledAt: on(11) },
  ])
  assert.equal(zonesOf(view).length, 3)
  assert.deepEqual(zonesOf(view, false), [])
})

test("the place of a seed somebody else took is unknown while other seeds are open", () => {
  // Seed 3 went to a guest who is not in the table; nothing says where A, its third, goes.
  const view = playoffs([
    { key: "k1", a: seed(1), b: seed(2), scheduledAt: on(9) },
    { key: "k2", a: winnerOf("k1"), b: { ...seed(3), teamId: "guest" }, scheduledAt: on(10) },
  ])
  const table = view.content.standings[0]!
  table.rows = table.rows.filter(({ teamId }) => teamId !== "guest")
  assert.deepEqual(zonesOf(view), [])
})

test("nobody is out while a side of the bracket is open that no seed speaks for", () => {
  const view = playoffs([
    { key: "k1", a: "c", b: "d", scheduledAt: on(9) },
    { key: "k2", a: { type: "TBD" }, b: { type: "TBD" }, scheduledAt: on(9) },
  ])
  const { zones, ways } = read(view)
  assert.deepEqual(zones, [])
  assert.deepEqual([...ways.keys()].sort(), ["c", "d"])
})

test("a place leads to the round the bracket has first, whatever the hours of its matches", () => {
  // The final is planned for an hour before the semifinal it follows.
  const view = playoffs([
    { key: "k1", a: "c", b: "d", score: [3, 1], scheduledAt: on(10) },
    { key: "k2", a: winnerOf("k1"), b: "a", scheduledAt: on(9) },
  ])
  assert.deepEqual(zonesOf(view)[0], [1, 2, "rounds1"])
})

test("a place leads to the first of the stages its team plays in", () => {
  const view = leagueView(leagueMatches, {
    stages: [stage("SEMI"), stage("FINAL")],
    later: [
      { key: "s1", stageCode: "SEMI", a: "c", b: "d", score: [3, 1], scheduledAt: on(9) },
      { key: "f1", stageCode: "FINAL", a: "c", b: "a", scheduledAt: on(12) },
    ],
  })
  const stages = read(view).zones.map(({ way }) =>
    way.kind === "STAGE" || way.kind === "ROUND" ? way.stage.code : way.kind,
  )
  assert.deepEqual(stages, ["SEMI", "FINAL", "OUT"])
})

test("without a later match the number of teams sent on makes two zones", () => {
  assert.deepEqual(zonesOf(playoffs([])), [
    [1, 2, "ON"],
    [3, 4, "OUT"],
  ])
})

test("a stage that says nothing about its places has no zones", () => {
  assert.deepEqual(zonesOf(playoffs([], { advance: 0 })), [])
})

test("a stage that sends every team on has no zones", () => {
  assert.deepEqual(zonesOf(playoffs([], { advance: 4 })), [])
})

test("a heading over every place of a table would say nothing", () => {
  const view = playoffs([
    { key: "k1", a: "c", b: "d", scheduledAt: on(9) },
    { key: "k2", a: "a", b: "b", scheduledAt: on(9) },
  ])
  assert.deepEqual(zonesOf(view), [])
})

test("ways that are mixed make no zones and stay with their teams", () => {
  const view = playoffs([
    { key: "k1", a: "c", b: "a", score: [3, 1], scheduledAt: on(9) },
    { key: "k2", a: winnerOf("k1"), b: "d", score: [3, 1], scheduledAt: on(10) },
  ])
  const { zones, ways } = read(view)
  assert.deepEqual(zones, [])
  assert.deepEqual([...ways.keys()].sort(), ["a", "c", "d"])
})

/** The teams of a table drawn as out. The first two go on; `played` of the matches have their result. */
const outOf = (played: number, final = false) => {
  const matches = leagueMatches.map((match, index) => (index < played ? match : { ...match, score: undefined }))
  const view = leagueView(matches, { extra: { advance: 2 }, complete: false })
  const { rows } = view.content.standings[0]!
  const { zones } = placeZones(view, view.content.plan.stages[0]!, rows, final, true)
  return zones.flatMap((zone) =>
    rows.slice(zone.from - 1, zone.to).flatMap((row) => (isOut(zone, row, final) ? [row.teamId] : [])),
  )
}

test("a place of a zone that leads out is out", () => {
  assert.deepEqual(outOf(leagueMatches.length, true), ["a", "b"])
})

test("a team level with one above a border is not out while the table can change", () => {
  // After A won the only match C and D are level behind it, on both sides of the border.
  assert.deepEqual(outOf(1), ["b"])
})

test("once a table is final a team under the border is out, whatever it is level with", () => {
  assert.equal(outOf(1, true).length, 2)
})

test("the teams of a bracket bring the place of the final table before it", () => {
  const view = playoffs([{ key: "k1", a: "c", b: "a", score: [3, 1], scheduledAt: on(9) }])
  assert.deepEqual(
    placesBefore(view, "KO"),
    new Map([
      ["c", { place: 1, group: null }],
      ["a", { place: 3, group: null }],
    ]),
  )
})

/** A league whose A and C met once more, in a second table that A won, before the bracket the two go on to. */
const twoTables = () => {
  const view = leagueView(leagueMatches, {
    stages: [stage("RR2", { format: "ROUND_ROBIN" }), stage("KO")],
    later: [
      { key: "r1", stageCode: "RR2", a: "a", b: "c", score: [2, 0], scheduledAt: on(6) },
      { key: "k1", stageCode: "KO", a: "c", b: "a", scheduledAt: on(9) },
    ],
  })
  const [first] = view.content.standings
  const row = (teamId: string) => first!.rows.find((item) => item.teamId === teamId)!
  const rows = [
    { ...row("a"), rank: 1, played: 1 },
    { ...row("c"), rank: 2, played: 1 },
  ]
  view.content.standings = [first!, { stageCode: "RR2", complete: true, rows }]
  return view
}

test("a team brings the place of the nearest table before its bracket", () => {
  const places = placesBefore(twoTables(), "KO")
  assert.deepEqual([places.get("a")!.place, places.get("c")!.place], [1, 2])
})

test("a team brings no place of a table it did not play in", () => {
  const view = twoTables()
  const second = view.content.standings[1]!
  second.rows = second.rows.map((row) => (row.teamId === "c" ? { ...row, played: 0 } : row))
  // C was first of the first table.
  assert.equal(placesBefore(view, "KO").get("c")!.place, 1)
})

test("two teams of a match compare by the table of its own stage", () => {
  const view = twoTables()
  assert.deepEqual(comparedPlaces(view, "RR", "a", "c"), { a: 3, b: 1 })
  assert.deepEqual(comparedPlaces(view, "RR2", "a", "c"), { a: 1, b: 2 })
})

test("two teams of a bracket compare by the places it says they bring", () => {
  const view = twoTables()
  const brought = placesBefore(view, "KO")
  assert.deepEqual(comparedPlaces(view, "KO", "c", "a"), { a: brought.get("c")!.place, b: brought.get("a")!.place })
  assert.deepEqual(comparedPlaces(view, "KO", "c", "a"), { a: 2, b: 1 })
})

/** The same competition before anybody has played in its second table. */
const secondUnplayed = () => {
  const view = twoTables()
  const second = view.content.standings[1]!
  second.rows = second.rows.map((row) => ({ ...row, played: 0 }))
  return view
}

test("while nobody has played in the table of its stage a match is compared by the table before", () => {
  assert.deepEqual(comparedPlaces(secondUnplayed(), "RR2", "a", "c"), { a: 3, b: 1 })
})

test("teams that bring places of two tables do not compare by them", () => {
  const view = twoTables()
  const second = view.content.standings[1]!
  second.rows = second.rows.map((row) => (row.teamId === "c" ? { ...row, played: 0 } : row))
  assert.equal(comparedPlaces(view, "KO", "a", "c"), null)
})

test("while no table before a bracket is final its teams compare by the table as it stands", () => {
  const open = leagueMatches.map((match, index) => (index < 5 ? match : { ...match, score: undefined }))
  const view = leagueView(open, {
    complete: false,
    stages: [stage("KO")],
    later: [{ key: "k1", stageCode: "KO", a: "d", b: "c", scheduledAt: on(9) }],
  })
  const rankOf = (team: string) => view.content.standings[0]!.rows.find(({ teamId }) => teamId === team)!.rank
  assert.deepEqual(comparedPlaces(view, "KO", "d", "c"), { a: rankOf("d"), b: rankOf("c") })
})

/** Two groups of three in one stage, and a bracket in which their first teams meet. */
const twoGroups = (label: (group: string) => string) => {
  const groups = ["abc", "def"].flatMap((teams, index): TestMatch[] => {
    const name = label(index ? "B" : "A")
    const [x, y, z] = [...teams]
    return [
      { key: `${x}${y}`, a: x, b: y, score: [2, 0], label: name, scheduledAt: on(1) },
      { key: `${y}${z}`, a: y, b: z, score: [2, 0], label: name, scheduledAt: on(2) },
      { key: `${x}${z}`, a: x, b: z, score: [2, 0], label: name, scheduledAt: on(3) },
    ]
  })
  return leagueView(groups, {
    stages: [stage("KO")],
    later: [{ key: "k1", stageCode: "KO", a: "a", b: "d", scheduledAt: on(9) }],
  })
}

test("teams of two groups do not compare by their places in them", () => {
  const view = twoGroups((group) => `Group ${group} Matches`)
  assert.equal(comparedPlaces(view, "KO", "a", "d"), null)
  assert.deepEqual(comparedPlaces(view, "RR", "a", "b"), { a: 1, b: 2 })
})

test("a place in a group carries the letter of the group, and nothing where groups have numbers", () => {
  const groupsOf = (label: (group: string) => string) => [...placesBefore(twoGroups(label), "KO").values()]
  assert.deepEqual(
    groupsOf((group) => `Group ${group} Matches`).map(({ group }) => group),
    ["A", "B"],
  )
  assert.deepEqual(
    groupsOf(() => "Ngày 1").map(({ group }) => group),
    [null, null],
  )
})

test("a table that can still change gives nobody a place to bring", () => {
  const open = leagueMatches.map((match, index) => (index < 5 ? match : { ...match, score: undefined }))
  const view = leagueView(open, {
    complete: false,
    stages: [stage("KO")],
    later: [{ key: "k1", stageCode: "KO", a: "c", b: "a", scheduledAt: on(9) }],
  })
  assert.equal(placesBefore(view, "KO").size, 0)
})
