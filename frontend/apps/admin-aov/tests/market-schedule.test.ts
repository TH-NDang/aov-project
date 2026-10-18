import assert from "node:assert/strict"
import { test } from "node:test"
import { releaseEnd } from "../src/features/publishing/release-window"
import type { PublicationOverview, Release } from "../src/features/publishing/publication-overview"
const first: Release = {
  id: "r1",
  variantId: "v1",
  regionId: "vn",
  seasonId: null,
  effectiveAt: "2026-10-01T00:00:00Z",
  effectiveOn: null,
  confirmedAt: null,
  sourceUrl: null,
  status: "SCHEDULED",
  phase: "CURRENT",
}
const data: PublicationOverview = {
  asOf: "2026-10-16T00:00:00Z",
  markets: [],
  rulesets: [],
  seasons: [],
  assignments: [],
  variants: [
    { id: "v1", patchId: "p1", patchCode: "first", rulesetId: "shared", rulesetOrdinal: 1, status: "PUBLISHED" },
    { id: "v2", patchId: "p2", patchCode: "next", rulesetId: "shared", rulesetOrdinal: 2, status: "PUBLISHED" },
  ],
  releases: [first],
}
test("patch end follows the next scheduled update in the same market, not another market or a season", () => {
  const next = { ...first, id: "r2", variantId: "v2", effectiveAt: "2026-11-01T00:00:00Z" }
  assert.equal(releaseEnd(first, data), null)
  assert.equal(releaseEnd(first, { ...data, releases: [first, { ...next, regionId: "th" }] }), null)
  assert.equal(releaseEnd(first, { ...data, releases: [first, { ...next, status: "CANCELLED" }] }), null)
  assert.equal(releaseEnd(first, { ...data, releases: [first, next] }), next.effectiveAt)
  assert.equal(
    releaseEnd(first, {
      ...data,
      releases: [first, next],
      assignments: [
        {
          id: "a",
          regionId: "vn",
          rulesetId: "shared",
          validFrom: "2026-01-01T00:00:00Z",
          validTo: "2026-10-20T00:00:00Z",
        },
      ],
    }),
    "2026-10-20T00:00:00Z",
  )
})

test("a confirmed date-only release preserves calendar precision for the preceding patch end", () => {
  const next: Release = {
    ...first,
    id: "r2",
    variantId: "v2",
    effectiveAt: null,
    effectiveOn: "2026-11-01",
    confirmedAt: "2026-11-01T09:00:00Z",
  }
  assert.equal(releaseEnd(first, { ...data, releases: [first, next] }), "2026-11-01")
  assert.equal(releaseEnd(first, { ...data, releases: [first, { ...next, status: "DRAFT" }] }), null)
})
