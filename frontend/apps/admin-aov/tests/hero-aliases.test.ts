import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createEntityIndex,
  parseRichText,
  validateRichTextSettings,
  type EntityReference,
  type RichTextSettings,
} from "@aov/ui/lib/entity-rich-text"
import { mergeReferenceCatalog, mergeReferenceEntry, updateHeroAliases } from "../src/features/terminology/hero-aliases"

const hero: EntityReference = {
  id: "florentino",
  kind: "hero",
  iconAssetId: "current-icon",
  translations: [
    { locale: "vi-VN", name: "Florentino", description: "Mô tả hiện tại", aliases: [] },
    { locale: "en-US", name: "Florentino EN", description: "Current English content", aliases: ["The Gentle Blade"] },
  ],
}
const settings: RichTextSettings = { schemaVersion: 1, autoRecognize: true, fallbackLocale: "vi-VN", entities: [] }

test("hero overlays merge only same-locale aliases and preserve canonical text, locales and artwork", () => {
  const custom: EntityReference = {
    id: hero.id,
    kind: "hero",
    autoMatch: false,
    display: { color: "#123456" },
    translations: [
      { locale: "VI-vn", name: "Stale name", description: "Stale description", aliases: ["flo", " FLO "] },
      {
        locale: "fr-FR",
        name: "Unpublished translation",
        description: "Not a canonical translation",
        aliases: ["French alias"],
      },
    ],
  }
  const merged = mergeReferenceEntry(hero, custom)
  assert.equal(merged.iconAssetId, "current-icon")
  assert.equal(merged.autoMatch, false)
  assert.equal(merged.display?.color, "#123456")
  assert.deepEqual(merged.translations, [{ ...hero.translations[0], aliases: ["flo"] }, hero.translations[1]])
  assert.equal(
    merged.translations.some((text) => text.locale === "fr-FR"),
    false,
  )
})

test("alias-only saves keep schema-required text snapshots without taking ownership of future hero content", () => {
  const saved = updateHeroAliases(settings, hero, [{ locale: "vi-VN", aliases: [" flo ", "FLO"] }])
  assert.deepEqual(validateRichTextSettings(saved).entities[0].translations, [
    { ...hero.translations[0], aliases: ["flo"] },
  ])
  const updatedHero = {
    ...hero,
    translations: [
      { ...hero.translations[0], name: "New canonical name", description: "New canonical description" },
      hero.translations[1],
    ],
  }
  const merged = mergeReferenceCatalog([updatedHero], saved.entities)[0]
  assert.equal(merged.translations[0].name, "New canonical name")
  assert.equal(merged.translations[0].description, "New canonical description")
  assert.deepEqual(merged.translations[0].aliases, ["flo"])
  assert.equal(merged.translations[1].aliases.includes("flo"), false)
})

test("removing supplemental aliases leaves other locales, terms and presentation settings intact", () => {
  const term: EntityReference = {
    id: "term",
    kind: "term",
    translations: [{ locale: "vi-VN", name: "Term", description: "Definition", aliases: [] }],
  }
  const initial = updateHeroAliases({ ...settings, entities: [term] }, hero, [
    { locale: "vi-VN", aliases: ["flo"] },
    { locale: "en-US", aliases: ["english-flo"] },
  ])
  const cleared = updateHeroAliases(initial, hero, [{ locale: "vi-VN", aliases: [] }])
  assert.deepEqual(cleared.entities[0], term)
  assert.deepEqual(
    cleared.entities[1].translations.map((text) => text.locale),
    ["en-US"],
  )
  const removed = updateHeroAliases(cleared, hero, [{ locale: "en-US", aliases: [] }])
  assert.deepEqual(removed.entities, [term])
  const styled = updateHeroAliases(
    { ...initial, entities: [term, { ...initial.entities[1], display: { color: "#123456" } }] },
    hero,
    [
      { locale: "vi-VN", aliases: [] },
      { locale: "en-US", aliases: [] },
    ],
  )
  assert.equal(styled.entities[1].display?.color, "#123456")
  assert.equal(styled.entities[1].translations[0].aliases.length, 0)
})

test("non-hero custom translations retain their existing behavior and invalid alias locales are rejected", () => {
  const item: EntityReference = { ...hero, kind: "item" }
  const custom = {
    ...item,
    translations: [{ locale: "vi-VN", name: "Custom item", aliases: [], description: "Custom item content" }],
  }
  assert.deepEqual(mergeReferenceEntry(item, custom).translations, custom.translations)
  assert.throws(
    () => updateHeroAliases(settings, hero, [{ locale: "fr-FR", aliases: ["flo"] }]),
    /canonical hero catalog/,
  )
  assert.throws(
    () =>
      updateHeroAliases(settings, hero, [
        { locale: "vi-VN", aliases: Array.from({ length: 21 }, (_, index) => `alias-${index}`) },
      ]),
    /Invalid hero aliases/,
  )
})

test("supplemental hero aliases recognize complete words while preserving the writer's label", () => {
  const saved = updateHeroAliases(settings, hero, [{ locale: "vi-VN", aliases: ["flo"] }])
  const entries = mergeReferenceCatalog([hero], saved.entities)
  const nodes = parseRichText("flo và FLO, overflow", createEntityIndex(entries, "vi-VN"), { autoRecognize: true })
  const references = nodes.filter((node) => node.type === "reference")
  assert.deepEqual(
    references.map((node) => node.label),
    ["flo", "FLO"],
  )
  assert.ok(references.every((node) => node.entity.id === hero.id))
})
