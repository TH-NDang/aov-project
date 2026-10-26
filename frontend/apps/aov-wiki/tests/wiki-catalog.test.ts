import assert from "node:assert/strict"
import { test } from "node:test"
import { supportedWikiLocale, wikiCatalogParameters, wikiScopeHref, wikiScopeKey } from "../src/lib/wiki-catalog.ts"

const scope = { region: "VN", locale: "en-US", seasonId: "s3", patchVariantId: "patch-1", includeUnscoped: true }

test("unsupported locale URL values cannot crash localized prices and stats", () => {
  for (const input of ["en_US", "unknown", "", null, undefined]) {
    const locale = supportedWikiLocale(input)
    assert.equal(locale, "vi-VN")
    assert.doesNotThrow(() => (1000.5).toLocaleString(locale))
  }
  assert.equal(supportedWikiLocale("en-US"), "en-US")
})

test("catalog cache keys isolate country, UI language, season, patch and undated observations", () => {
  const choices = [
    scope,
    { ...scope, region: "TH" },
    { ...scope, locale: "vi-VN" },
    { ...scope, seasonId: "s4" },
    { ...scope, patchVariantId: "patch-2" },
    { ...scope, includeUnscoped: false },
  ]
  assert.equal(new Set(choices.map((value) => JSON.stringify(wikiScopeKey(value)))).size, choices.length)
})

test("season-only requests do not invent a patch and current announcements ignore historical browsing", () => {
  const season = wikiCatalogParameters({ ...scope, patchVariantId: "" })
  assert.equal(season.get("seasonId"), "s3")
  assert.equal(season.has("patchVariantId"), false)
  assert.equal(season.get("includeUnscoped"), "true")
  const current = wikiCatalogParameters(scope, false)
  assert.deepEqual(
    [...current],
    [
      ["region", "VN"],
      ["locale", "en-US"],
    ],
  )
  assert.equal(
    wikiCatalogParameters({ region: "VN", locale: "vi-VN", includeUnscoped: true }).has("includeUnscoped"),
    false,
  )
})

test("reference navigation preserves detail and browsing context while allowing an explicit target patch", () => {
  const link = new URL(
    wikiScopeHref("/warehouse?tab=items&item=sword&patch=patch-2#recipe", scope),
    "https://wiki.invalid",
  )
  assert.equal(link.pathname, "/warehouse")
  assert.equal(link.searchParams.get("tab"), "items")
  assert.equal(link.searchParams.get("item"), "sword")
  assert.equal(link.searchParams.get("patch"), "patch-2")
  assert.equal(link.searchParams.get("season"), "s3")
  assert.equal(link.searchParams.get("locale"), "en-US")
  assert.equal(link.searchParams.get("unscoped"), "1")
  assert.equal(link.hash, "#recipe")
})
