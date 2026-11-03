import assert from "node:assert/strict"
import { test } from "node:test"
import { patchViewAnchors, selectedPatchAnchor, patchViewRequest } from "../src/features/publishing/patch-view-anchor"
import {
  closeHeroLocation,
  heroPageLocation,
  patchHeroLocation,
  switchHeroLocation,
} from "../src/features/publishing/hero-location"
import type { Revision } from "../src/features/publishing/types"
import type { Variant } from "../src/features/publishing/publication-overview"

const variants = [
  { id: "s3", rulesetId: "standard", rulesetOrdinal: 1 },
  { id: "oct15", rulesetId: "standard", rulesetOrdinal: 2 },
  { id: "oct30", rulesetId: "standard", rulesetOrdinal: 3 },
] as Variant[]
const revision = (id: string, patch: string, props: Partial<Revision> = {}): Revision => ({
  id,
  heroId: "keera",
  rulesetId: "standard",
  revisionNo: 1,
  state: "PUBLISHED",
  version: 1,
  cause: "DATA_BASELINE",
  sections: {} as Revision["sections"],
  publishedAt: "2026-11-01T00:00:00Z",
  sourceRevisionId: null,
  effectiveFromPatchVariantId: patch,
  ...props,
})

test("a new published baseline is selected despite older published history; draft OCR is excluded", () => {
  const old = revision("old", "s3")
  const latest = revision("new", "oct30")
  const anchors = patchViewAnchors(
    [
      old,
      latest,
      revision("game-patch", "oct15", { cause: "GAME_PATCH" }),
      revision("draft-ocr", "oct30", { state: "DRAFT", revisionNo: 4 }),
      revision("discarded", "oct30", { state: "DISCARDED" }),
      revision("other-hero", "oct30", { heroId: "erin" }),
      revision("other-ruleset", "oct30", { rulesetId: "other" }),
      revision("unknown-patch", "unknown"),
      revision("undated", "s3", { effectiveFromPatchVariantId: null }),
    ],
    "keera",
    "standard",
    variants,
  )
  assert.deepEqual(
    anchors.map((item) => item.id),
    ["new", "game-patch", "old"],
  )
  assert.equal(selectedPatchAnchor(anchors, null), latest)
  assert.equal(selectedPatchAnchor(anchors, "draft-ocr"), latest)
  assert.equal(selectedPatchAnchor(anchors, "old"), old)
  assert.equal(selectedPatchAnchor(anchors, "auto"), null)
  assert.equal(selectedPatchAnchor([], null), null)
})

test("anchor identity reaches the request and separates cached views for the same patch", () => {
  const automatic = patchViewRequest("keera", "oct15", null)
  const selected = patchViewRequest("keera", "oct15", "baseline")
  assert.notDeepEqual(selected.queryKey, automatic.queryKey)
  const query = new URL(selected.path, "http://localhost").searchParams
  assert.equal(query.get("patchVariantId"), "oct15")
  assert.equal(query.get("anchorRevisionId"), "baseline")
  assert.equal(new URL(automatic.path, "http://localhost").searchParams.has("anchorRevisionId"), false)
})

test("patch navigation preserves the baseline, while changing or closing heroes clears it", () => {
  const params = new URLSearchParams("hero=keera&atPatch=oct30&anchorRevision=baseline&ruleset=standard")
  assert.equal(patchHeroLocation(params, { atPatch: "oct15" }).get("anchorRevision"), "baseline")
  assert.equal(
    new URL(heroPageLocation("keera", params), "http://localhost").searchParams.get("anchorRevision"),
    "baseline",
  )
  assert.equal(switchHeroLocation(params, "erin").get("anchorRevision"), null)
  assert.equal(closeHeroLocation(params).get("anchorRevision"), null)
  assert.equal(params.get("anchorRevision"), "baseline")
})
