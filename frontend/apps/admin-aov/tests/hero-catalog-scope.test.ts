import assert from "node:assert/strict"
import { test } from "node:test"
import {
  currentCatalogScope,
  resolveCatalogScope,
  showAllCatalogEntries,
} from "../src/features/publishing/model/catalog/catalog-scope"
import { heroCatalogRows } from "../src/features/publishing/model/catalog/catalog-data"
import { catalogOverview, createHeroCatalogFixture } from "./fixtures/hero-catalog-data"
import type { PublicationOverview } from "../src/features/publishing/api/publication-overview"

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
      sourceUrl: null,
      status: "SCHEDULED",
      phase: "CURRENT",
      effectiveOn: null,
      confirmedAt: null,
    },
  ],
}

test("hero scope opens the current release and preserves explicit historical or draft selections", () => {
  const current = { seasonId: "season-new", variantId: "patch-current" }
  assert.deepEqual(currentCatalogScope(overview), current)
  assert.deepEqual(resolveCatalogScope(overview, { seasonId: "", variantId: "" }), current)
  for (const seasonId of ["season-new", "season-old"]) {
    assert.deepEqual(resolveCatalogScope(overview, { seasonId, variantId: "" }), { seasonId, variantId: "" })
  }
  assert.equal(resolveCatalogScope(overview, { seasonId: "", variantId: "patch-future" }).variantId, "patch-future")
  assert.equal(
    resolveCatalogScope(overview, { seasonId: "season-new", variantId: "patch-early" }).variantId,
    "patch-early",
  )
  assert.equal(showAllCatalogEntries(new URLSearchParams()), true)
  assert.equal(showAllCatalogEntries(new URLSearchParams("show=changes")), false)
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
  assert.equal(rows[0].workingDraft?.id, futureOnly.revisions[0].id)
  const unplaced = { ...futureOnly.revisions[0], effectiveFromPatchVariantId: null }
  const draftOnly = heroCatalogRows(
    [{ ...hero, revisions: [unplaced], gameplayChanges: [] }],
    overview,
    { seasonId: "season-new", variantId: "patch-current" },
    unplaced.rulesetId,
    true,
  )
  assert.equal(draftOnly[0]?.selectedRevision?.id, unplaced.id)
  assert.deepEqual(draftOnly[0]?.changes, [])
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

test("all heroes shows an undated publication until a dated snapshot applies without adding a patch change", () => {
  const hero = createHeroCatalogFixture().heroes.find((entry) => entry.code === "ad-current-change")!
  const future = hero.revisions.find((entry) => entry.effectiveFromPatchVariantId === "patch-future")!
  const undated = {
    ...future,
    id: "published-undated",
    state: "PUBLISHED" as const,
    revisionNo: 8,
    effectiveFromPatchVariantId: null,
  }
  const dated = { ...undated, id: "published-at-patch", effectiveFromPatchVariantId: "patch-current", revisionNo: 2 }
  const atPatch = { seasonId: "season-new", variantId: "patch-current" }
  const observed = { ...hero, revisions: [undated, future], gameplayChanges: [] }
  assert.equal(heroCatalogRows([observed], overview, atPatch, "", true)[0]?.selectedRevision?.id, undated.id)
  assert.deepEqual(heroCatalogRows([observed], overview, atPatch, "", false), [])
  const known = { ...observed, revisions: [undated, dated] }
  assert.equal(heroCatalogRows([known], overview, atPatch, "", true)[0]?.selectedRevision?.id, dated.id)
})
