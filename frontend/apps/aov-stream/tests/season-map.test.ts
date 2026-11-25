import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView } from "@aov/community-contracts"
import { championBanners, isLongMap, seasonLanes, shareOfYear } from "../src/lib/season-map.ts"
import { partName, seasonOfYear } from "../src/lib/season-name.ts"
import { competition } from "./fixtures/competition.ts"

const NOW = Date.parse("2026-11-25T00:00:00Z")

/** A finished season of a circuit, won by `winner`. */
const season = (id: string, startsOn: string, endsOn: string, winner = "a", extra: object = {}, plan: object = {}) =>
  competition([{ key: "f", a: winner, b: "z", score: [3, 1] }], {
    id,
    tournament: { name: id, status: "FINISHED", year: 2026, startsOn, endsOn, ...extra },
    plan: { circuit: "Cup", ...plan },
  })
const lanes = (views: CompetitionView[]) => seasonLanes(views, 2026)
const shown = (views: CompetitionView[]) =>
  lanes(views)[0]!.bars.map(({ view, line, parts }) => [view.id, line, parts.map((part) => part.view.id)])

test("a map is long once it has more lanes than a screen holds, however many seasons stand on them", () => {
  const circuits = (count: number) =>
    Array.from({ length: count }, (_, at) =>
      season(`s${at}`, "2026-02-01", "2026-03-01", "a", {}, { circuit: `Cup ${at}` }),
    )
  assert.equal(isLongMap(circuits(6)), false)
  assert.equal(isLongMap(circuits(7)), true)
  assert.equal(isLongMap(Array.from({ length: 9 }, (_, at) => season(`s${at}`, "2026-02-01", "2026-03-01"))), false)
})

test("a day is the share of the year that has passed, and a day outside it is cut at its edge", () => {
  assert.equal(shareOfYear("2026-01-01", 2026), 0)
  assert.equal(shareOfYear("2025-06-01", 2026), 0)
  assert.equal(shareOfYear("2027-02-01", 2026), 1)
  assert.equal(shareOfYear("2026-07-02", 2026).toFixed(2), "0.50")
})

test("seasons apart share a line and seasons whose labels would meet stand under each other", () => {
  assert.deepEqual(
    shown([
      season("winter", "2026-08-29", "2026-11-07"),
      season("spring", "2026-02-28", "2026-05-10"),
      season("show", "2026-03-20", "2026-03-21"),
    ]),
    [
      ["spring", 0, []],
      ["show", 1, []],
      ["winter", 0, []],
    ],
  )
})

test("the parts of a season stand with it, the earliest first", () => {
  assert.deepEqual(
    shown([
      season("main", "2026-06-18", "2026-07-19"),
      season("queens", "2026-07-01", "2026-07-19", "b", { parentTournamentId: "main" }),
      season("wildcard", "2026-05-21", "2026-05-24", "b", { parentTournamentId: "main" }),
    ]),
    [["main", 0, ["wildcard", "queens"]]],
  )
})

test("a season that starts at the end of the year has its label before it", () => {
  const [bar] = lanes([season("late", "2026-12-20", "2026-12-22")])[0]!.bars

  assert.ok(bar!.left < bar!.from)
  assert.equal(bar!.right, 1)
})

test("a lane grows by a row for the names of the parts that do not fit one", () => {
  const parts = Array.from({ length: 12 }, (_, at) =>
    season(`Vòng loại khu vực ${at}`, "2026-01-02", "2026-01-03", "b", { parentTournamentId: "main" }),
  )

  assert.equal(lanes([season("main", "2026-06-18", "2026-07-19"), ...parts])[0]!.tall, 2)
  assert.equal(lanes([season("main", "2026-06-18", "2026-07-19")])[0]!.tall, 0)
})

test("a season without days is listed aside and takes no place in the year", () => {
  const [lane] = lanes([
    competition([], { id: "soon", tournament: { year: 2026, status: "ANNOUNCED" }, plan: { circuit: "Cup" } }),
  ])

  assert.deepEqual(
    lane!.undated.map((view) => view.id),
    ["soon"],
  )
  assert.equal(lane!.bars.length, 0)
})

test("lanes come by the tier of their circuit and competitions outside any close the list", () => {
  const views = [
    season("lone", "2026-02-01", "2026-02-03", "a", {}, { circuit: "" }),
    season("small", "2026-03-01", "2026-03-03", "a", { tier: "B" }, { circuit: "Small" }),
    season("world", "2026-01-01", "2026-01-03", "a", { tier: "S" }, { circuit: "World" }),
  ]

  assert.deepEqual(
    lanes(views).map((lane) => lane.key),
    ["World", "Small", "other"],
  )
})

test("a banner hangs for the latest champion of a circuit, with the titles it has won there", () => {
  const banners = championBanners(
    [
      season("winter", "2026-08-29", "2026-11-07", "a"),
      season("spring", "2026-02-28", "2026-05-10", "b"),
      season("last", "2025-08-29", "2025-11-07", "a"),
    ],
    { now: NOW },
  )

  assert.deepEqual(
    banners.map(({ view, titles }) => [view.id, titles]),
    [["winter", 2]],
  )
})

test("a circuit not played for long hangs no banner", () => {
  assert.deepEqual(championBanners([season("old", "2023-08-29", "2023-11-07")], { now: NOW }), [])
})

test("a banner names the season of its circuit that comes next", () => {
  const next = competition([], {
    id: "next",
    tournament: { name: "next", status: "UPCOMING", startsOn: "2026-12-03" },
    plan: { circuit: "Cup" },
  })
  const [banner] = championBanners([season("winter", "2026-08-29", "2026-11-07"), next], { now: NOW })

  assert.equal(banner!.next!.id, "next")
})

test("on a page of one year a season loses the year and the marks around it", () => {
  assert.equal(seasonOfYear("Mùa Xuân 2026", 2026), "Mùa Xuân")
  assert.equal(seasonOfYear("2026 - Wildcard", 2026), "Wildcard")
  assert.equal(seasonOfYear("2026", 2026), "")
  assert.equal(seasonOfYear("Season 2", 2026), "Season 2")
})

test("a part is named without the season it belongs to", () => {
  assert.equal(partName("APL 2026 - Wildcard", "APL 2026", "APL", 2026), "Wildcard")
  assert.equal(partName("APL Queens 2026", "APL 2026", "APL", 2026), "Queens")
})
