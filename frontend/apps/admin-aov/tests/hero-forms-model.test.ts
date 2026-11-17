import assert from "node:assert/strict"
import { test } from "node:test"
import {
  defaultFormOf,
  formCandidates,
  formKeyFor,
  formsOwnerOf,
  heroFormChoices,
  replaceFormsBody,
  sharedPartRevision,
  sharedTextOf,
  withCardImages,
  withSharedText,
  type HeroForms,
} from "../src/features/publishing/model/hero-forms-model"
import { ROLES, type Profile, type Revision } from "../src/features/publishing/api/types"

const form = (id: string, code: string, roles: string[], name: string, published = true) => ({
  id,
  code,
  formKey: code.slice("flowborn-".length),
  displayOrder: 1,
  names: [{ locale: "vi-VN", name }],
  roles: roles as HeroForms["forms"][number]["roles"],
  published,
  draftOpen: !published,
})

const view: HeroForms = {
  heroId: "ad",
  code: "flowborn-ad",
  holder: { id: "flowborn", code: "flowborn", names: [{ locale: "vi-VN", name: "Flowborn" }] },
  formKey: "ad",
  forms: [
    form("ad", "flowborn-ad", ["MARKSMAN"], "Flowborn Xạ thủ"),
    form("mid", "flowborn-mid", ["MAGE"], "Flowborn Pháp sư", false),
  ],
}

test("the switcher names each form by its first role and has no entry for the shared part", () => {
  const choices = heroFormChoices(view, "vi-VN", ROLES)
  assert.deepEqual(
    choices.map(({ id, label, role }) => ({ id, label, role })),
    [
      { id: "ad", label: "Xạ thủ", role: "MARKSMAN" },
      { id: "mid", label: "Pháp sư", role: "MAGE" },
    ],
  )
  assert.equal(choices[1].form?.published, false)
})

test("forms sharing a role, or without one yet, are named instead", () => {
  const twins: HeroForms = {
    ...view,
    forms: [
      form("ad", "flowborn-ad", ["MARKSMAN"], "Cung"),
      form("bow", "flowborn-bow", ["MARKSMAN"], "Nỏ"),
      form("new", "flowborn-new", [], ""),
    ],
  }
  assert.deepEqual(
    heroFormChoices(twins, "vi-VN", ROLES).map((choice) => choice.label),
    ["Cung", "Nỏ", "flowborn-new"],
  )
  assert.deepEqual(heroFormChoices({ ...view, holder: null, forms: [] }, "vi-VN", ROLES), [])
})

test("a form key is what follows the hero code, and only such heroes can join", () => {
  assert.equal(formKeyFor("flowborn", "flowborn-tank"), "tank")
  assert.equal(formKeyFor("flowborn", "airi"), undefined)
  const rows = [
    { id: "flowborn", code: "flowborn" },
    { id: "tank", code: "flowborn-tank" },
    { id: "ad", code: "flowborn-ad", holderId: "flowborn" },
    { id: "elsewhere", code: "flowborn-x", holderId: "other" },
    { id: "holder", code: "flowborn-holder", formIds: ["z"] },
    { id: "airi", code: "airi" },
  ]
  assert.deepEqual(
    formCandidates({ id: "flowborn", code: "flowborn" }, rows, [{ id: "ad" }]).map((row) => row.id),
    ["tank"],
  )
})

test("saving sends the whole new order, guarded by the list the editor started from", () => {
  assert.deepEqual(
    replaceFormsBody(view, "flowborn", [
      { id: "mid", code: "flowborn-mid" },
      { id: "ad", code: "flowborn-ad" },
    ]),
    {
      expectedForms: ["ad", "mid"],
      forms: [
        { heroId: "mid", formKey: "mid" },
        { heroId: "ad", formKey: "ad" },
      ],
      changeNote: null,
    },
  )
})

test("the hero that holds forms opens on its first form, and its forms are managed from any of them", () => {
  const holderView: HeroForms = { ...view, heroId: "flowborn", code: "flowborn", formKey: null }
  assert.equal(defaultFormOf(holderView, "flowborn"), "ad")
  assert.equal(defaultFormOf(view, "ad"), undefined, "a form stays where it is")
  assert.equal(defaultFormOf({ ...holderView, forms: [] }, "flowborn"), undefined)
  assert.deepEqual(formsOwnerOf(view), view.holder)
  assert.deepEqual(formsOwnerOf({ ...view, holder: null, formKey: null, forms: [] }), { id: "ad", code: "flowborn-ad" })
})

const revision = (id: string, revisionNo: number, state: Revision["state"]) => ({ id, revisionNo, state }) as Revision

test("the shared part is edited on its open draft, otherwise on its newest published revision", () => {
  const published = [revision("r1", 1, "PUBLISHED"), revision("r2", 2, "PUBLISHED"), revision("r0", 3, "DISCARDED")]
  assert.equal(sharedPartRevision(published)?.id, "r2")
  assert.equal(sharedPartRevision([...published, revision("r4", 4, "DRAFT")])?.id, "r4")
  assert.equal(sharedPartRevision([]), undefined)
})

test("saving the shared name and title changes only that language and keeps the rest of the profile", () => {
  const profile: Profile = {
    translations: [
      { locale: "vi-VN", name: "Flowborn", title: "Hậu duệ Khởi Nguyên", summary: null, lore: "Truyện" },
      { locale: "en-US", name: "Flowborn", title: "Heir of Origins", summary: null, lore: null },
    ],
    roles: [],
    positions: [],
    sources: [],
  }
  assert.deepEqual(sharedTextOf(profile, "vi-VN"), { name: "Flowborn", title: "Hậu duệ Khởi Nguyên" })
  const next = withSharedText(profile, "vi-VN", { name: " Flowborn ", title: "Hậu Duệ Khởi Nguyên" })
  assert.deepEqual(next.translations[0], {
    locale: "vi-VN",
    name: "Flowborn",
    title: "Hậu Duệ Khởi Nguyên",
    summary: null,
    lore: "Truyện",
  })
  assert.deepEqual(next.translations[1], profile.translations[1])
  assert.equal(withSharedText(profile, "vi-VN", { name: "Flowborn", title: " " }).translations[0].title, null)
  assert.deepEqual(withSharedText(null, "vi-VN", { name: "Flowborn", title: "" }).translations, [
    { locale: "vi-VN", name: "Flowborn", title: null, summary: null, lore: null },
  ])
})

test("a new card image replaces only its own role and stays among the pictures of that role", () => {
  const bindings = { bindings: { HEAD: "h1", PORTRAIT: "p1", SPLASH: "s1" }, sources: [] }
  const next = withCardImages(bindings, { HEAD: "h2", PORTRAIT: "p1" })
  assert.deepEqual(next.bindings, { HEAD: "h2", PORTRAIT: "p1", SPLASH: "s1" })
  assert.deepEqual(
    next.images?.HEAD?.map((image) => image.assetId),
    ["h1", "h2"],
  )
  assert.equal(next.images?.PORTRAIT, undefined, "an unchanged role keeps its pictures as they were")
  assert.equal(withCardImages(bindings, {}), bindings)
})
