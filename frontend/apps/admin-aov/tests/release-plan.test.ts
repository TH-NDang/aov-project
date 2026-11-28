import assert from "node:assert/strict"
import { test } from "node:test"
import type { Market, Release } from "../src/features/publishing/api/publication-overview"
import {
  daysFromShared,
  draftFromReleases,
  instantOf,
  localMoment,
  planProblem,
  planToRequest,
  wallMoment,
} from "../src/features/publishing/model/setup/release-plan"

const market = (code: string, displayName: string): Market => ({
  id: `region-${code}`,
  code,
  displayName,
  available: code === "VN",
  currentRulesetId: null,
  currentSeasonId: null,
  currentReleaseId: null,
})
const markets = [
  market("VN", "Việt Nam"),
  market("TH", "Thái Lan"),
  market("TW", "Đài Loan"),
  market("ID", "Indonesia"),
]
const release = (code: string, value: { effectiveAt?: string; effectiveOn?: string }): Release => ({
  id: `release-${code}`,
  variantId: "variant",
  regionId: `region-${code}`,
  seasonId: null,
  effectiveAt: value.effectiveAt ?? null,
  effectiveOn: value.effectiveOn ?? null,
  sourceUrl: null,
  status: value.effectiveAt ? "SCHEDULED" : "DRAFT",
  phase: "UPCOMING",
  confirmedAt: null,
})

test("a wall clock and its instant read back the same in each market", () => {
  const instant = instantOf({ date: "2026-09-29", time: "03:30" }, "Asia/Ho_Chi_Minh")
  assert.equal(instant, "2026-09-28T20:30:00.000Z")
  assert.deepEqual(wallMoment(instant!, "Asia/Taipei"), { date: "2026-09-29", time: "04:30" })
})

test("markets that updated together read as one moment, and the one that did not keeps its own", () => {
  const draft = draftFromReleases(
    markets,
    [
      release("VN", { effectiveAt: "2026-09-28T20:30:00Z" }),
      release("TH", { effectiveAt: "2026-09-28T20:30:00Z" }),
      release("TW", { effectiveAt: "2026-09-23T00:00:00Z" }),
    ],
    "variant",
  )
  assert.deepEqual(draft.shared, { date: "2026-09-29", time: "03:30" })
  assert.equal(draft.sharedZoneCode, "VN")
  assert.deepEqual(
    draft.rows.map((row) => row.mode),
    ["shared", "shared", "own", "none"],
  )
  const taiwan = draft.rows[2]
  assert.deepEqual(taiwan.own, { date: "2026-09-23", time: "08:00" })
  assert.equal(daysFromShared(draft, taiwan), -6)
  assert.deepEqual(localMoment(draft, draft.rows[1]), { date: "2026-09-29", time: "03:30" })
})

test("a day-only patch is the same day on every market's calendar", () => {
  const draft = draftFromReleases(markets, [], "variant")
  assert.deepEqual(
    draft.rows.map((row) => row.mode),
    ["shared", "shared", "shared", "shared"],
  )
  assert.equal(planProblem(draft), "Chọn ngày phát hành chung.")
  const dated = { ...draft, shared: { date: "2026-11-26", time: "" } }
  assert.equal(planProblem(dated), null)
  assert.deepEqual(localMoment(dated, dated.rows[2]), { date: "2026-11-26", time: "" })
  const sources = (code: string) => (code === "VN" ? "https://lienquan.garena.vn/26-11" : null)
  assert.deepEqual(planToRequest(dated, sources, []), [
    { regionId: "region-VN", effectiveOn: "2026-11-26", sourceUrl: "https://lienquan.garena.vn/26-11" },
    { regionId: "region-TH", effectiveOn: "2026-11-26" },
    { regionId: "region-TW", effectiveOn: "2026-11-26" },
    { regionId: "region-ID", effectiveOn: "2026-11-26" },
  ])
})

test("a shared hour is sent as one instant, and a market left out is not sent", () => {
  const draft = draftFromReleases(markets, [], "variant")
  const plan = {
    ...draft,
    shared: { date: "2026-09-29", time: "03:30" },
    rows: draft.rows.map((row) =>
      row.code === "ID" ? { ...row, mode: "own" as const, own: { date: "2026-09-18", time: "" } } : row,
    ),
  }
  plan.rows[2] = { ...plan.rows[2], mode: "none" }
  const sent = planToRequest(plan, () => null, [])
  assert.deepEqual(sent, [
    { regionId: "region-VN", effectiveAt: "2026-09-28T20:30:00.000Z" },
    { regionId: "region-TH", effectiveAt: "2026-09-28T20:30:00.000Z" },
    { regionId: "region-ID", effectiveOn: "2026-09-18" },
  ])
})
