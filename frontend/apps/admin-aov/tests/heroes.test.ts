import test from "node:test"
import assert from "node:assert/strict"
import type { Hero, Skin } from "../src/lib/api/types.ts"
import { toHeroRow } from "../src/features/heroes/hero-table-model.ts"

const hero = (): Hero => ({
  id: "airi",
  name: "Airi",
  version: 1,
  head: "head.jpg",
  cover: "cover.jpg",
  listHead: "list.jpg",
  portrait: "portrait.jpg",
  portraitAlternates: [],
  forms: [],
  sources: {},
  skins: [],
  skills: [
    {
      slot: 0,
      name: "Passive",
      description: "Description",
      switchMode: "none",
      variants: [{ index: 0, icon: "skill.jpg", sourceUrl: null, video: null }],
    },
  ],
})
const skin = (isDefault: boolean): Skin => ({
  id: isDefault ? "default" : "skin-1",
  sourceSkinId: "1",
  name: "Skin",
  fullName: "Airi Skin",
  isDefault,
  badgeId: null,
  head: null,
  cover: null,
  portrait: null,
  portraitAlternates: [],
})

test("default outfits do not inflate missing skin portrait counts", () => {
  const data = hero()
  data.skins = [skin(true), skin(false)]
  const row = toHeroRow(data)
  assert.equal(row.skins, 1)
  assert.equal(row.missingPortraits, 1)
  assert.deepEqual(row.review, ["skins"])
})

test("review identifies absent portraits, blank descriptions, and missing icons independently", () => {
  const data = hero()
  data.portrait = null
  data.skills[0].description = "  "
  data.skills[0].variants[0].icon = null
  const row = toHeroRow(data)
  assert.equal(row.icons, 0)
  assert.equal(row.expectedIcons, 1)
  assert.equal(row.missingDescriptions, 1)
  assert.deepEqual(row.review, ["portrait", "skills"])
})

test("empty skills are flagged while completed records have a ready state", () => {
  assert.deepEqual(toHeroRow(hero()).review, ["ready"])
  const data = hero()
  data.skills = []
  assert.deepEqual(toHeroRow(data).review, ["skills"])
})

test("hero forms take priority over individual skill variants", () => {
  const data = hero()
  data.skills[0].switchMode = "skill-variant"
  assert.equal(toHeroRow(data).mechanic, "skill-variant")
  data.forms = [{ id: "form", name: "Form", variantBySlot: { "0": 0 } }]
  assert.equal(toHeroRow(data).mechanic, "hero-form")
})
