import assert from "node:assert/strict"
import { test } from "node:test"
import {
  currentHeroCatalogScope,
  resolveHeroCatalogScope,
  showAllHeroes,
} from "../src/features/publishing/hero-catalog-scope"
import { heroCatalogRows } from "../src/features/publishing/catalog-data"
import { catalogOverview, createHeroCatalogFixture } from "./fixtures/hero-catalog-data"
import type { PublicationOverview } from "../src/features/publishing/publication-overview"

const overview: PublicationOverview = {
  ...catalogOverview,
  markets: [
    {
      id: "vn",
      code: "VN",
      displayName: "Việt Nam",
      available: true,
      currentReleaseId: "live",
      currentSeasonId: "season-new",
      currentRulesetId: "standard",
    },
  ],
  releases: [
    {
      id: "live",
      variantId: "patch-current",
      regionId: "vn",
      seasonId: "season-new",
      effectiveAt: "2026-10-15T00:00:00Z",
      status: "SCHEDULED",
      phase: "CURRENT",
    },
  ],
}

test("hero scope opens the current release and preserves explicit historical or draft selections", () => {
  const current = { seasonId: "season-new", variantId: "patch-current" }
  assert.deepEqual(currentHeroCatalogScope(overview), current)
  assert.deepEqual(resolveHeroCatalogScope(overview, { seasonId: "", variantId: "" }), current)
  assert.deepEqual(resolveHeroCatalogScope(overview, { seasonId: "season-new", variantId: "" }), current)
  assert.equal(resolveHeroCatalogScope(overview, { seasonId: "season-old", variantId: "" }).variantId, "patch-old")
  assert.equal(resolveHeroCatalogScope(overview, { seasonId: "", variantId: "patch-future" }).variantId, "patch-future")
  assert.equal(
    resolveHeroCatalogScope(overview, { seasonId: "season-new", variantId: "patch-early" }).variantId,
    "patch-early",
  )
  assert.equal(showAllHeroes(new URLSearchParams()), true)
  assert.equal(showAllHeroes(new URLSearchParams("show=changes")), false)
})

test("all heroes keeps identities with no snapshot at the target without substituting future content", () => {
  const hero = createHeroCatalogFixture().heroes.find((entry) => entry.code === "ad-current-change")!
  const futureOnly = {
    ...hero,
    revisions: hero.revisions.filter((entry) => entry.effectiveFromPatchVariantId === "patch-future"),
  }
  const rows = heroCatalogRows([futureOnly], overview, { seasonId: "season-new", variantId: "patch-current" }, "", true)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].selectedRevision, undefined)
  assert.equal(rows[0].changes.length, 1)
  assert.equal(rows[0].changes[0].patchVariantId, "patch-current")
  const notesOnly = {
    ...futureOnly,
    gameplayChanges: futureOnly.gameplayChanges?.map((entry) => ({ ...entry, toHeroRevisionId: null })),
  }
  const changedRows = heroCatalogRows(
    [notesOnly],
    overview,
    { seasonId: "season-new", variantId: "patch-current" },
    "",
    false,
  )
  assert.equal(changedRows.length, 1)
  assert.equal(changedRows[0].selectedRevision, undefined)
  const unchanged = { ...futureOnly, gameplayChanges: [] }
  assert.equal(
    heroCatalogRows([unchanged], overview, { seasonId: "season-new", variantId: "patch-current" }, "", true).length,
    1,
  )
  assert.equal(
    heroCatalogRows([unchanged], overview, { seasonId: "season-new", variantId: "patch-current" }, "", false).length,
    0,
  )
})
