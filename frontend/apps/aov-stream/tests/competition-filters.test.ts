import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView, TournamentContent } from "@aov/community-contracts"
import {
  competitionRegionName,
  filterOptions,
  passesFilter,
  type DirectoryFilter,
} from "../src/lib/competition-filters.ts"

const view = (tournament: Partial<TournamentContent>, circuit = "") =>
  ({
    id: tournament.code,
    content: {
      tournament: { code: "x", name: "X", region: "VN", status: "FINISHED", ...tournament },
      plan: { circuit, organizer: "", timezone: "Asia/Ho_Chi_Minh" },
    },
  }) as unknown as CompetitionView

const none: DirectoryFilter = { region: "all", year: "all", search: "" }

const aog = view({ code: "aog", name: "Đấu Trường Danh Vọng", region: "VN", year: 2026 }, "AOG")
const aogBefore = view({ code: "aog-2025", name: "Đấu Trường Danh Vọng", region: "VN", year: 2025 }, "AOG")
const rpl = view({ code: "rpl", name: "RoV Pro League", region: "TH", year: 2025 })
const world = view({ code: "awc", name: "World Cup", region: undefined, year: undefined })
const items = [aog, aogBefore, rpl, world]

test("filters combine, so a region and a year narrow each other", () => {
  const shown = items.filter((item) => passesFilter(item, { ...none, region: "VN", year: "2025" }))
  assert.deepEqual(
    shown.map((item) => item.id),
    ["aog-2025"],
  )
})

test("a competition without a region or a year passes only while that filter is off", () => {
  assert.ok(passesFilter(world, none))
  assert.ok(!passesFilter(world, { ...none, region: "VN" }))
  assert.ok(!passesFilter(world, { ...none, year: "2026" }))
})

test("the search reads the circuit as well as the name, without accents", () => {
  assert.ok(passesFilter(aog, { ...none, search: "dau truong" }))
  assert.ok(passesFilter(aog, { ...none, search: "aog" }))
  assert.ok(!passesFilter(rpl, { ...none, search: "aog" }))
})

test("each option counts what it would show with the other filters, not with its own", () => {
  const regions = filterOptions(items, { ...none, region: "TH", year: "2025" }, "region", (a, b) => b[1] - a[1])
  assert.deepEqual(regions, [
    ["VN", 1],
    ["TH", 1],
  ])
})

test("the option in use stays in the list when nothing matches it", () => {
  const years = filterOptions(items, { ...none, year: "2019" }, "year", (a, b) => Number(b[0]) - Number(a[0]))
  assert.deepEqual(years, [
    ["2026", 1],
    ["2025", 2],
    ["2019", 0],
  ])
})

test("regions read as names: a market, an area or a country", () => {
  assert.equal(competitionRegionName("VN", "vi-VN"), "Việt Nam")
  assert.equal(competitionRegionName("SEA", "vi-VN"), "Đông Nam Á")
  assert.equal(competitionRegionName("SEA", "en-US"), "Southeast Asia")
  assert.equal(competitionRegionName("KR", "en-US"), "South Korea")
})
