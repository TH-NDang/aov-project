import assert from "node:assert/strict"
import { test } from "node:test"
import {
  selectCatalogRevisions,
  translationCoverage,
  appliedMarkets,
  targetVariants,
} from "../src/features/publishing/catalog-data"
import type { PublicationOverview } from "../src/features/publishing/publication-overview"
import type { Content, Revision } from "../src/features/publishing/types"
const overview: PublicationOverview = {
  asOf: "2026-10-16T00:00:00Z",
  rulesets: [],
  assignments: [],
  markets: [
    {
      id: "vn",
      code: "VN",
      displayName: "Vietnam",
      available: true,
      currentRulesetId: "shared",
      currentSeasonId: "s4",
      currentReleaseId: "r1",
    },
    {
      id: "th",
      code: "TH",
      displayName: "Thailand",
      available: true,
      currentRulesetId: "shared",
      currentSeasonId: null,
      currentReleaseId: null,
    },
  ],
  seasons: [
    {
      id: "s4",
      regionId: "vn",
      code: "s4",
      displayName: "S4",
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2027-01-01T00:00:00Z",
      phase: "CURRENT",
    },
  ],
  variants: [
    {
      id: "v1",
      patchId: "p1",
      patchCode: "first",
      rulesetId: "shared",
      rulesetOrdinal: 1,
      seasonId: "s4",
      status: "PUBLISHED",
    },
    {
      id: "v2",
      patchId: "p2",
      patchCode: "next",
      rulesetId: "shared",
      rulesetOrdinal: 2,
      seasonId: "s4",
      status: "PUBLISHED",
    },
  ],
  releases: [
    {
      id: "r1",
      variantId: "v1",
      regionId: "vn",
      seasonId: "s4",
      effectiveAt: "2026-10-01T00:00:00Z",
      sourceUrl: null,
      status: "SCHEDULED",
      phase: "CURRENT",
    },
    {
      id: "r2",
      variantId: "v2",
      regionId: "vn",
      seasonId: "s4",
      effectiveAt: "2026-12-01T00:00:00Z",
      sourceUrl: null,
      status: "SCHEDULED",
      phase: "UPCOMING",
    },
  ],
}
function revision(id: string, variant: string, revisionNo: number, state: Revision["state"] = "PUBLISHED"): Revision {
  return {
    id,
    heroId: "hero",
    rulesetId: "shared",
    revisionNo,
    state,
    version: 1,
    cause: "DATA_BASELINE",
    sections: {} as Revision["sections"],
    publishedAt: "2026-10-01T00:00:00Z",
    sourceRevisionId: null,
    effectiveFromPatchVariantId: variant,
  }
}
test("catalog selects gameplay order rather than import order and respects historical filters", () => {
  const old = revision("old", "v1", 8)
  const current = revision("new", "v2", 2)
  assert.equal(selectCatalogRevisions([old, current], overview, { seasonId: "", variantId: "" })[0]?.id, "new")
  assert.equal(selectCatalogRevisions([old, current], overview, { seasonId: "", variantId: "v1" })[0]?.id, "old")
  assert.equal(selectCatalogRevisions([old], overview, { seasonId: "s4", variantId: "v2" })[0]?.id, "old")
  assert.deepEqual(selectCatalogRevisions([old], overview, { seasonId: "missing", variantId: "" }), [])
  assert.equal(targetVariants(overview, { seasonId: "s4", variantId: "" })[0]?.id, "v2")
})
test("market badges only identify the published snapshot currently served", () => {
  const old = revision("old", "v1", 1)
  const future = revision("future", "v2", 2)
  assert.deepEqual(
    appliedMarkets([old, future], old, overview).map((r) => r.market.code),
    ["VN"],
  )
  assert.deepEqual(appliedMarkets([old, future], future, overview), [])
  assert.deepEqual(appliedMarkets([old], { ...old, state: "DRAFT" }, overview), [])
})
test("translation completeness includes skills, skins and optional fields with source content", () => {
  const content: Content = {
    PROFILE: {
      translations: [
        { locale: "vi-VN", name: "Airi", title: null, summary: "Source", lore: null },
        { locale: "en-US", name: "Airi", title: null, summary: null, lore: null },
      ],
      roles: [],
      sources: [],
    },
    SKILLS: {
      skills: [
        {
          skillKey: "passive",
          kind: "PASSIVE",
          formKey: null,
          displayOrder: 0,
          iconAssetId: null,
          effects: [],
          translations: [
            { locale: "vi-VN", name: "Skill", description: "Description" },
            { locale: "en-US", name: "Skill", description: " " },
          ],
        },
      ],
      sources: [],
    },
    SKINS: {
      skins: [
        {
          skinKey: "default",
          displayOrder: 0,
          artAssetId: null,
          rarityCode: null,
          translations: [{ locale: "vi-VN", name: "Default", description: null, acquisitionNote: null }],
        },
      ],
      sources: [],
    },
    OVERVIEW_RATINGS: null,
    COMBAT_STATS: null,
    MEDIA_BINDINGS: null,
  }
  const [vi, en, th] = translationCoverage(content, ["vi-VN", "en-US", "th-TH"])
  assert.equal(vi?.complete, true)
  assert.equal(vi?.total, 5)
  assert.equal(en?.completed, 2)
  assert.equal(en?.complete, false)
  assert.equal(th?.completed, 0)
})
