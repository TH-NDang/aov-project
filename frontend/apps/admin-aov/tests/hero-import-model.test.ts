import assert from "node:assert/strict"
import { test } from "node:test"
import {
  dataFilePaths,
  defaultFieldMapping,
  defaultIdColumn,
  droppedSource,
  hasChangesToSave,
  imageBaseFolders,
  importColumns,
  isImportable,
  matchesImportFilter,
} from "../src/features/publishing/model/import/hero-import-model"
import type { HeroImportPlan, ImportEntry } from "../src/features/publishing/model/import/hero-import-types"

const plan = (patch: Partial<HeroImportPlan> = {}): HeroImportPlan =>
  ({
    code: "airi",
    revisionId: "draft",
    version: 1,
    before: { portrait: "asset" },
    after: {},
    changed: false,
    classification: "UNCHANGED",
    canApply: true,
    warnings: [],
    ...patch,
  }) as HeroImportPlan
const entry = (patch: Partial<ImportEntry> = {}): ImportEntry => ({
  input: {
    code: "airi",
    rulesetId: "rules",
    contextId: "context",
    mode: "BASELINE",
    locale: "vi-VN",
    values: {},
    policies: {},
  },
  plan: plan(),
  selected: false,
  ...patch,
})
const file = (name: string) => new File(["{}"], name)

test("the importer's own columns are not offered as data", () => {
  assert.deepEqual(importColumns([{ code: "a", __sourceCode: "x" }, { name: "B" }]), ["code", "name"])
})

test("each field maps to the column of the same name", () => {
  const fields = [
    { key: "name", type: "text" },
    { key: "roles", type: "json" },
  ] as Parameters<typeof defaultFieldMapping>[0]

  assert.deepEqual(defaultFieldMapping(fields, ["code", "name"]), { name: "name" })
})

test("heroes are named by their code column, else their id column", () => {
  assert.equal(defaultIdColumn(["id", "code"]), "code")
  assert.equal(defaultIdColumn(["id", "name"]), "id")
  assert.equal(defaultIdColumn(["name"]), "")
})

test("an unchanged row with no picture to write has nothing to save", () => {
  assert.equal(hasChangesToSave(plan(), [], {}, {}), false)
})

test("a picture counts as a change only where the hero has none or the field is overwritten", () => {
  assert.equal(hasChangesToSave(plan(), [], { portrait: "hero.png" }, {}), false)
  assert.equal(hasChangesToSave(plan(), [], { portrait: "hero.png" }, { portrait: "OVERWRITE" }), true)
  assert.equal(hasChangesToSave(plan(), [], { splash: "splash.png" }, {}), true)
})

test("a row whose skills or skins bring pictures has something to save", () => {
  const image = {
    section: "skills",
    index: 0,
    field: "iconAssetId",
    source: "skill.png",
    semanticType: "HERO_SKILL_ICON",
  } as const

  assert.equal(hasChangesToSave(plan(), [image], {}, {}), true)
})

test("a changed row the server accepts can be saved", () => {
  assert.equal(isImportable(entry({ plan: plan({ changed: true }) })), true)
})

test("a row the server refuses, that failed, or that was sent already cannot be saved", () => {
  assert.equal(isImportable(entry({ plan: plan({ changed: true, canApply: false }) })), false)
  assert.equal(isImportable(entry({ plan: plan({ changed: true }), error: "Lỗi" })), false)
  assert.equal(isImportable(entry({ plan: plan({ changed: true }), result: "Đã gửi đến máy chủ" })), false)
  assert.equal(isImportable(entry({ plan: undefined })), false)
})

test("the review filter shows every row, the failed rows, or one classification", () => {
  const changed = entry({ plan: plan({ classification: "CHANGED" }) })
  const failed = entry({ plan: undefined, error: "Lỗi" })

  assert.deepEqual(
    [changed, failed].map((row) => [
      matchesImportFilter(row, "ALL"),
      matchesImportFilter(row, "ERROR"),
      matchesImportFilter(row, "CHANGED"),
    ]),
    [
      [true, false, true],
      [true, true, false],
    ],
  )
})

test("any JSON or CSV file of a bundle may hold the heroes", () => {
  assert.deepEqual(dataFilePaths(["data/heroes.JSON", "data/notes.txt", "rows.csv", "assets/a.png"]), [
    "data/heroes.JSON",
    "rows.csv",
  ])
})

test("picture paths may start from any folder of the bundle", () => {
  assert.deepEqual(imageBaseFolders(["run/assets/a.png", "run/data/heroes.json", "top.json"]), [
    "run",
    "run/assets",
    "run/data",
  ])
})

test("one dropped ZIP or data file is read as it is", () => {
  const zip = file("bundle.zip")
  const data = file("heroes.csv")

  assert.deepEqual(droppedSource(new Map([["bundle.zip", zip]])), { kind: "zip", file: zip })
  assert.deepEqual(droppedSource(new Map([["heroes.csv", data]])), { kind: "data", file: data })
})

test("a dropped folder with a data file is read as a bundle", () => {
  const dropped = new Map([
    ["run/heroes.json", file("heroes.json")],
    ["run/assets/a.png", file("a.png")],
  ])

  assert.deepEqual(droppedSource(dropped), { kind: "bundle" })
})

test("a drop without a data file, or with archives inside, is refused", () => {
  assert.throws(() => droppedSource(new Map([["a.png", file("a.png")]])), /Hãy thả JSON\/CSV/)
  assert.throws(
    () =>
      droppedSource(
        new Map([
          ["heroes.json", file("heroes.json")],
          ["more.zip", file("more.zip")],
        ]),
      ),
    /Hãy thả từng ZIP riêng/,
  )
})
