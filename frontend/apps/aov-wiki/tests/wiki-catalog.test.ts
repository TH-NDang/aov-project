import assert from "node:assert/strict"
import { test } from "node:test"
import {
  legacyWarehouseTarget,
  supportedWikiLocale,
  warehouseListPath,
  warehousePath,
  wikiCatalogParameters,
  wikiScopeHref,
  wikiScopeKey,
  wikiScrollKey,
  wikiSection,
} from "../src/lib/wiki-catalog.ts"

const scope = { region: "VN", locale: "en-US", seasonId: "s3", patchVariantId: "patch-1", includeUnscoped: true }

test("armory tabs and entries live in the path and older query links open the same view", () => {
  assert.equal(warehousePath("items"), "/warehouse/items")
  assert.equal(warehousePath("arcana", "do 1"), "/warehouse/arcana/do%201")
  assert.equal(warehouseListPath("/warehouse/items/ao-choang"), "/warehouse/items")
  assert.equal(warehouseListPath("/warehouse/items"), "/warehouse/items")
  assert.equal(warehouseListPath("/hero/airi"), "/hero/airi")

  assert.equal(legacyWarehouseTarget(""), "/warehouse/items")
  assert.equal(legacyWarehouseTarget("?tab=unknown"), "/warehouse/items")
  assert.equal(legacyWarehouseTarget("?tab=arcana"), "/warehouse/arcana")
  assert.equal(
    legacyWarehouseTarget("?tab=spells&item=boc-pha&q=x&region=VN&locale=en-US"),
    "/warehouse/spells/boc-pha?q=x&region=VN&locale=en-US",
  )
})

test("each armory tab is its own catalog section, whichever form its address takes", () => {
  assert.equal(wikiSection("/warehouse", null), "warehouse/items")
  assert.equal(wikiSection("/warehouse/", "spells"), "warehouse/spells")
  assert.equal(wikiSection("/warehouse/arcana", null), "warehouse/arcana")
  assert.equal(wikiSection("/warehouse/arcana/do-1", null), "warehouse/arcana")
  assert.equal(wikiSection("/hero/dolia", null), "hero")
  assert.equal(wikiSection("/", null), "")
})

test("opening armory entries keeps the scroll position while other pages start at the top", () => {
  assert.equal(wikiScrollKey("/warehouse/items"), wikiScrollKey("/warehouse/items/ao-choang"))
  assert.equal(wikiScrollKey("/warehouse/items"), wikiScrollKey("/warehouse/arcana"))
  assert.notEqual(wikiScrollKey("/hero/airi"), wikiScrollKey("/hero/alice"))
})

test("switching public catalogs returns to the market's current patch while same-section details retain their scope", () => {
  const fromHero = { ...scope, section: wikiSection("/hero/dolia", null) }
  const fromItems = { ...scope, section: wikiSection("/warehouse", null) }
  const target = (path: string, from: typeof fromHero) =>
    new URL(wikiScopeHref(path, from), "https://wiki.invalid").searchParams
  for (const [path, from] of [
    ["/warehouse?tab=items", fromHero],
    ["/warehouse?tab=spells", fromItems],
    ["/skins", fromHero],
  ] as const) {
    const params = target(path, from)
    assert.equal(params.get("patch"), null)
    assert.equal(params.get("season"), null)
    assert.equal(params.get("unscoped"), null)
    assert.equal(params.get("region"), "VN")
    assert.equal(params.get("locale"), "en-US")
  }
  assert.equal(target("/hero/dolia", fromHero).get("patch"), "patch-1")
  assert.equal(target("/warehouse?tab=items&item=sword", fromItems).get("season"), "s3")
  assert.equal(target("/skins?patch=explicit", fromHero).get("patch"), "explicit")
})

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
