import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formCandidates,
  formKeyFor,
  heroFormChoices,
  replaceFormsBody,
  type HeroForms,
} from "../src/features/publishing/hero-forms-model"
import { ROLES } from "../src/features/publishing/types"

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

test("the switcher starts with the shared part, then names each form by its first role", () => {
  const choices = heroFormChoices(view, "vi-VN", ROLES)
  assert.deepEqual(
    choices.map(({ id, label, role }) => ({ id, label, role })),
    [
      { id: "flowborn", label: "Chung", role: undefined },
      { id: "ad", label: "Xạ thủ", role: "MARKSMAN" },
      { id: "mid", label: "Pháp sư", role: "MAGE" },
    ],
  )
  assert.equal(choices[2].form?.published, false)
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
    ["Chung", "Cung", "Nỏ", "flowborn-new"],
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
