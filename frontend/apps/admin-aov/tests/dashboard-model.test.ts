import assert from "node:assert/strict"
import { test } from "node:test"
import { marketsAwaitingPatch } from "../src/features/dashboard/dashboard-model"

type Overview = Parameters<typeof marketsAwaitingPatch>[0]
type Release = Overview["releases"][number]
type Market = Overview["markets"][number]

const release = (id: string, regionId: string, effectiveOn: string, phase = "AWAITING_CONFIRMATION") =>
  ({ id, regionId, effectiveOn, effectiveAt: null, phase }) as unknown as Release
const market = (id: string, currentReleaseId: string | null, available = true) =>
  ({ id, currentReleaseId, available }) as unknown as Market

test("a market waits on a patch only when a newer one has reached its day", () => {
  const overview: Overview = {
    markets: [market("vn", "current")],
    releases: [
      release("current", "vn", "2026-11-17", "CURRENT"),
      release("history", "vn", "2025-01-01"),
      release("next", "vn", "2026-12-01"),
    ],
  }

  assert.equal(marketsAwaitingPatch(overview, "2026-11-26T04:00:00Z"), 0, "History and future days are not work")
  assert.equal(marketsAwaitingPatch(overview, "2026-12-01T01:00:00Z"), 1)
})

test("markets that are not on the Wiki never wait on a patch", () => {
  const overview: Overview = {
    markets: [market("id", null, false)],
    releases: [release("old", "id", "2021-01-19")],
  }

  assert.equal(marketsAwaitingPatch(overview, "2026-11-26T04:00:00Z"), 0)
})

test("a market counts once however many patches wait", () => {
  const overview: Overview = {
    markets: [market("vn", null)],
    releases: [release("a", "vn", "2026-11-01"), release("b", "vn", "2026-11-17")],
  }

  assert.equal(marketsAwaitingPatch(overview, "2026-11-26T04:00:00Z"), 1)
})
