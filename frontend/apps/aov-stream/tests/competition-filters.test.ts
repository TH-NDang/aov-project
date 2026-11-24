import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionView, TournamentContent } from "@aov/community-contracts"
import {
  competitionKinds,
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

const none: DirectoryFilter = { region: "all", year: "all", status: "all", tier: "all", kind: "all", search: "" }

const aog = view({ code: "aog", name: "Đấu Trường Danh Vọng", region: "VN", year: 2026, tier: "A" }, "AOG")
const aogQualifier = view({
  code: "aog-q",
  name: "Vòng thăng hạng",
  region: "VN",
  year: 2026,
  tier: "B",
  competitionType: "QUALIFIER",
  parentTournamentId: "aog",
})
const rpl = view({ code: "rpl", name: "RoV Pro League", region: "TH", year: 2025, tier: "A" })
const showmatch = view({ code: "show", name: "Show match", region: "TH", year: 2025, competitionType: "SHOWMATCH" })
const items = [aog, aogQualifier, rpl, showmatch]

test("a qualifier of a main event is not a main event, and a show match is neither", () => {
  assert.deepEqual(competitionKinds(aog.content.tournament), ["MAIN"])
  assert.deepEqual(competitionKinds(aogQualifier.content.tournament), ["QUALIFIER"])
  assert.deepEqual(competitionKinds(showmatch.content.tournament), ["SHOWMATCH"])
})

test("filters combine, so a tier and a kind narrow each other", () => {
  const shown = items.filter((item) => passesFilter(item, { ...none, tier: "A", kind: "MAIN" }))
  assert.deepEqual(
    shown.map((item) => item.id),
    ["aog", "rpl"],
  )
})

test("the search reads the circuit as well as the name, without accents", () => {
  assert.ok(passesFilter(aog, { ...none, search: "dau truong" }))
  assert.ok(passesFilter(aog, { ...none, search: "aog" }))
  assert.ok(!passesFilter(rpl, { ...none, search: "aog" }))
})

test("each option counts what it would show with the other filters, not with its own", () => {
  const regions = filterOptions(items, { ...none, region: "TH", tier: "A" }, "region", (a, b) => b[1] - a[1])
  assert.deepEqual(regions, [
    ["VN", 1],
    ["TH", 1],
  ])
})

test("the option in use stays in the list when nothing matches it", () => {
  const tiers = filterOptions(items, { ...none, tier: "S" }, "tier", (a, b) => a[0].localeCompare(b[0]))
  assert.deepEqual(tiers, [
    ["A", 2],
    ["B", 1],
    ["S", 0],
  ])
})

test("regions read as names: a market, an area or a country", () => {
  assert.equal(competitionRegionName("VN", "vi-VN"), "Việt Nam")
  assert.equal(competitionRegionName("SEA", "vi-VN"), "Đông Nam Á")
  assert.equal(competitionRegionName("SEA", "en-US"), "Southeast Asia")
  assert.equal(competitionRegionName("KR", "en-US"), "South Korea")
})
