import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildSkillComparison,
  skillComparisonFieldLabel,
  type CuratedHeroChange,
} from "../src/features/publishing/hero-skill-comparison"
import type { HeroComparison } from "../src/features/publishing/publishing-api"
import type { Revision, Skill } from "../src/features/publishing/types"
import { skillFieldLabel } from "@/features/publishing/skill-field-labels"

const skill = (key: string, metadata: Record<string, unknown> = {}, description = "Mô tả kỹ năng"): Skill => ({
  skillKey: key,
  kind: "ACTIVE",
  formKey: null,
  displayOrder: 1,
  iconAssetId: `icon-${key}`,
  translations: [{ locale: "vi-VN", name: "Kỹ năng mẫu", description }],
  effects: [{ effectType: "SOURCE_SNAPSHOT", metadata }],
})
const compare = (before: Skill[], after: Skill[]): HeroComparison => ({
  status: "AVAILABLE",
  from: { id: "previous" } as Revision,
  to: { id: "current" } as Revision,
  before: { skills: { skills: before } },
  after: { skills: { skills: after } },
  changes: [
    { section: "skills", path: "/skills/skill-1-1", kind: "CHANGED", before, after },
    { section: "profile", path: "/summary", kind: "CHANGED", before: "Cũ", after: "Mới" },
  ],
  warnings: [],
})

test("one skill owns one cooldown fact even when top metadata, rank table and description all change", () => {
  const before = skill(
    "skill-1-1",
    {
      cooldown: { display: "Hồi chiêu: 12/11/10 giây" },
      levelTable: {
        column_labels: ["Lv 1", "Lv 2", "Lv 3"],
        rows: [{ label: "Hồi chiêu (giây)", display_values: ["12", "11", "10"] }],
      },
    },
    "Hồi chiêu 12/11/10 giây, gây sát thương.",
  )
  const after = skill(
    "skill-1-1",
    {
      cooldown: { display: "Hồi chiêu: 10/9/8 giây" },
      levelTable: {
        column_labels: ["Lv 1", "Lv 2", "Lv 3"],
        rows: [{ label: "Hồi chiêu", display_values: ["10", "9", "8"] }],
      },
    },
    "Hồi chiêu 10/9/8 giây, gây sát thương.",
  )
  const input = compare([before], [after])
  const result = buildSkillComparison(input, "vi-VN")
  assert.equal(result.skills.length, 1)
  assert.equal(result.skills[0].rows.length, 1)
  assert.equal(result.skills[0].rows[0].label, "Hồi chiêu")
  assert.deepEqual(result.skills[0].rows[0].before, ["Lv 1: 12", "Lv 2: 11", "Lv 3: 10"])
  assert.deepEqual(result.skills[0].rows[0].after, ["Lv 1: 10", "Lv 2: 9", "Lv 3: 8"])
  assert.equal(result.skills[0].descriptions.length, 1)
  assert.deepEqual(result.skills[0].kinds, [])
  assert.equal(result.otherChanges.length, 1)
  assert.equal(result.otherChanges[0], input.changes[1])
})

test("exact curated facts supersede their source copies and merge duplicate records without losing mixed classifications", () => {
  const input = compare(
    [
      skill("skill-1-1", {
        cooldown: { display: "Hồi chiêu: 12 giây" },
        levelTable: { rows: [{ label: "Hồi chiêu (giây)", display_values: ["12 giây"] }] },
      }),
    ],
    [
      skill("skill-1-1", {
        cooldown: { display: "Hồi chiêu: 10 giây" },
        levelTable: { rows: [{ label: "Hồi chiêu (giây)", display_values: ["10 giây"] }] },
      }),
    ],
  )
  const change: CuratedHeroChange = {
    type: "SKILL",
    skillKey: "skill-1-1",
    fieldKey: "skill_1.cooldownSeconds",
    changeKind: "BUFF",
    oldValue: "12 giây",
    newValue: "10 giây",
  }
  const result = buildSkillComparison(input, "vi-VN", [change, { ...change, changeKind: "NERF" }, change])
  assert.equal(result.skills[0].rows.length, 1)
  assert.deepEqual(result.skills[0].rows[0].kinds, ["BUFF", "NERF"])
  assert.deepEqual(result.skills[0].kinds, ["BUFF", "NERF"])
  assert.equal(result.skills[0].rows[0].before, "12 giây")
  assert.equal(result.skills[0].rows[0].after, "10 giây")
  const backendResult = buildSkillComparison(input, "vi-VN", [{ ...change, type: "HERO_SKILL_CHANGE" }])
  assert.equal(backendResult.skills[0].rows.length, 1)
  assert.deepEqual(backendResult.skills[0].kinds, ["BUFF"])
  assert.equal(backendResult.skills[0].rows[0].before, "12 giây")
})

test("arbitrary revision pairs keep rank arrays and never infer buff or nerf from numeric direction", () => {
  const input = compare(
    [skill("skill-1-1", { levelTable: { rows: [{ label: "Sát thương", display_values: ["100", "200"] }] } })],
    [skill("skill-1-1", { levelTable: { rows: [{ label: "Sát thương", display_values: ["120", "180"] }] } })],
  )
  const group = buildSkillComparison(input, "vi-VN").skills[0]
  assert.equal(group.rows.length, 1)
  assert.deepEqual(group.rows[0].before, ["100", "200"])
  assert.deepEqual(group.rows[0].after, ["120", "180"])
  assert.deepEqual(group.rows[0].kinds, [])
  assert.deepEqual(group.kinds, [])
})

test("added and removed skills retain their own artwork, names and descriptions without identity rows", () => {
  const removed = skill("old-form", { energyCost: { value: 60 }, tags: ["Khống chế"] }, "Kỹ năng cũ")
  removed.displayOrder = 1
  const added = skill("new-form", { cooldown: { seconds: 8 }, energyCost: { value: 40 } }, "Kỹ năng mới")
  added.displayOrder = 2
  added.translations.push({ locale: "en-US", name: "New skill", description: "New mechanic" })
  const result = buildSkillComparison(compare([removed], [added]), "en-US")
  assert.equal(result.skills[0].kind, "REMOVED")
  assert.equal(result.skills[0].beforeSkill?.iconAssetId, "icon-old-form")
  assert.equal(result.skills[0].afterSkill, null)
  const group = result.skills[1]
  assert.equal(group.kind, "ADDED")
  assert.equal(group.name, "New skill")
  assert.equal(group.beforeSkill, null)
  assert.equal(group.afterSkill, added)
  assert.equal(group.rows.length, 2)
  assert.ok(group.rows.every((row) => row.before === null))
  assert.equal(group.descriptions[0].locale, "en-US")
  assert.equal(group.descriptions[0].after, "New mechanic")
})

test("capture provenance, raw attributes and flags never become gameplay changes", () => {
  const before = skill("skill-1-1", {
    rawAttributes: { basic: { hp: 3500 } },
    reviewFlags: [{ note: "Prior source" }],
    sourceImageUrl: "https://example.com/old.png",
    completeness: "CAPTURED_ONLY",
  })
  const after = skill("skill-1-1", {
    rawAttributes: { basic: { hp: 4000 } },
    reviewFlags: [{ note: "Reviewed" }],
    sourceImageUrl: "https://example.com/new.png",
    completeness: "NEEDS_REVIEW",
    heroReviewFlags: ["Updated"],
  })
  assert.deepEqual(buildSkillComparison(compare([before], [after]), "vi-VN").skills, [])
})

test("unknown meaningful source fields and structured effects remain readable without raw JSON", () => {
  const before = skill("skill-1-1", { customMechanic: { range: 4, provenance: "old" } })
  const after = skill("skill-1-1", { customMechanic: { range: 6, provenance: "new" } })
  before.effects.push({ effectType: "SLOW", metadata: { duration: 1, strength: [20, 30] } })
  after.effects.push({ effectType: "SLOW", metadata: { duration: 2, strength: [25, 35] } })
  const group = buildSkillComparison(compare([before], [after]), "vi-VN").skills[0]
  assert.equal(group.rows.length, 3)
  assert.ok(group.rows.some((row) => row.label === "Thông số khác · Tầm tác động" && row.after === 6))
  assert.ok(group.rows.some((row) => row.label === "Làm chậm · Thời gian tác dụng" && row.after === 2))
  assert.ok(group.rows.some((row) => Array.isArray(row.after) && row.after.join("/") === "25/35"))
  assert.ok(group.rows.every((row) => typeof row.after !== "object" || Array.isArray(row.after)))
})

test("stable skill keys separate forms with identical names and do not turn reorder into gameplay edits", () => {
  const first = skill("skill-1-form-a", { cooldown: { seconds: 8 } })
  first.formKey = "a"
  const second = skill("skill-1-form-b", { cooldown: { seconds: 10 } })
  second.formKey = "b"
  const input = compare(
    [first, second],
    [
      { ...second, displayOrder: 0 },
      { ...first, displayOrder: 2 },
    ],
  )
  assert.deepEqual(buildSkillComparison(input, "vi-VN").skills, [])
  const changed = structuredClone(second)
  changed.effects[0].metadata.cooldown = { seconds: 9 }
  const result = buildSkillComparison(compare([first, second], [changed, first]), "vi-VN")
  assert.equal(result.skills.length, 1)
  assert.equal(result.skills[0].skillKey, "skill-1-form-b")
})

test("description-only changes have no duplicated fact rows and retain each changed locale", () => {
  const before = skill("skill-1-1", {}, "Gây 120 sát thương")
  before.translations.push({ locale: "en-US", name: "Skill", description: "Deals 120 damage" })
  const after = skill("skill-1-1", {}, "Gây 150 sát thương")
  after.translations.push({ locale: "en-US", name: "Skill", description: "Deals 150 damage" })
  const group = buildSkillComparison(compare([before], [after]), "en-US").skills[0]
  assert.deepEqual(group.rows, [])
  assert.equal(group.descriptions.length, 2)
  assert.equal(group.descriptions[0].locale, "en-US")
  assert.equal(group.descriptions[1].locale, "vi-VN")
  assert.equal(group.descriptions[1].before, "Gây 120 sát thương")
})

test("rank-table ordering and object property ordering do not manufacture differences", () => {
  const before = skill("skill-1-1", {
    levelTable: {
      column_labels: ["Lv 1"],
      rows: [
        { label: "Hồi chiêu (giây)", display_values: ["8"] },
        { label: "Tiêu hao", display_values: ["50"] },
      ],
    },
    extra: { a: 1, b: 2 },
  })
  const after = skill("skill-1-1", {
    extra: { b: 2, a: 1 },
    levelTable: {
      column_labels: ["Lv 1"],
      rows: [
        { label: "Tiêu hao năng lượng", display_values: ["50"] },
        { label: "Hồi chiêu", display_values: ["8"] },
      ],
    },
  })
  assert.deepEqual(buildSkillComparison(compare([before], [after]), "vi-VN").skills, [])
})

test("duplicate source table rows collapse while genuinely different same-label rows stay available", () => {
  const before = skill("skill-1-1", {
    tags: ["Làm chậm", "Sát thương"],
    levelTable: {
      rows: [
        { label: "Sát thương", display_values: ["100", "200"] },
        { label: "Sát thương", display_values: ["100", "200"] },
        { label: "Sát thương", display_values: ["10%", "20%"] },
      ],
    },
  })
  const after = skill("skill-1-1", {
    tags: ["Sát thương", "Làm chậm"],
    levelTable: {
      rows: [
        { label: "Sát thương", display_values: ["150", "250"] },
        { label: "Sát thương", display_values: ["150", "250"] },
        { label: "Sát thương", display_values: ["15%", "25%"] },
      ],
    },
  })
  const group = buildSkillComparison(compare([before], [after]), "vi-VN").skills[0]
  assert.equal(group.rows.length, 2)
  assert.deepEqual(group.rows[0].after, ["150", "250"])
  assert.deepEqual(group.rows[1].after, ["15%", "25%"])
})

test("unknown old values remain unknown and labels cover real imported mechanic identifiers", () => {
  const change: CuratedHeroChange = {
    type: "SKILL",
    skillKey: "skill-4-1",
    fieldKey: "skill_4.cooldownSeconds",
    changeKind: "REWORK",
    oldValue: null,
    newValue: "40 giây",
  }
  const result = buildSkillComparison(compare([], [skill("skill-4-1")]), "vi-VN", [change])
  assert.equal(result.skills[0].rows[0].before, null)
  assert.deepEqual(result.skills[0].kinds, ["REWORK"])
  assert.equal(skillComparisonFieldLabel("skill_3.cannonSeparation"), "Tách Pháo tử quang")
  assert.equal(skillComparisonFieldLabel("skill_4.futureMechanic"), "Thông số khác")
  for (const label of [skillComparisonFieldLabel, skillFieldLabel]) {
    assert.equal(label("passive.stackDecay"), "Giảm tầng cộng dồn")
    assert.equal(label("skill_1.cooldownSeconds"), "Hồi chiêu")
    assert.equal(label("futureMechanic"), "Thông số khác")
    assert.equal(label("Sát thương mỗi tầng"), "Sát thương mỗi tầng")
  }
})

test("formatting, whitespace and tag ordering do not create content changes", () => {
  const before = skill(
    "skill-0-1",
    {
      energyCost: { display: "<color=#62A2CC>N.lượng: 0</color>" },
      tags: ["<color=#AA0000>Vật lý</color>", "<color=#00AA00>Tăng ST</color>"],
    },
    "Gây <color=#AA0000>120 sát thương</color>.\nHồi máu.",
  )
  const after = skill(
    "skill-0-1",
    {
      energyCost: { display: "N.lượng: 0" },
      tags: ["Tăng ST", "<color=#BB0000>Vật lý</color>", "Vật lý"],
    },
    "Gây <b>120 sát thương</b>. Hồi máu.",
  )
  const input = compare([before], [after])
  input.changes = [
    { section: "profile", path: "/summary", kind: "CHANGED", before: "<b>Giới thiệu</b>", after: "Giới thiệu" },
  ]
  assert.deepEqual(buildSkillComparison(input, "vi-VN"), { skills: [], otherChanges: [] })

  const changed = structuredClone(after)
  changed.translations[0].description = "Gây <color=#BB0000>150 sát thương</color>. Hồi máu."
  changed.effects[0].metadata.energyCost = { display: "N.lượng: 10" }
  changed.effects[0].metadata.tags = ["<color=#BB0000>Vật lý</color>", "Làm chậm"]
  const group = buildSkillComparison(compare([before], [changed]), "vi-VN").skills[0]
  assert.equal(group.rows.length, 2)
  assert.equal(group.descriptions[0].after, changed.translations[0].description)
  assert.ok(group.rows.some((row) => row.id === "energyCost" && row.after === "N.lượng: 10"))
  assert.ok(
    group.rows.some(
      (row) => row.id === "tags" && Array.isArray(row.after) && row.after.includes("<color=#BB0000>Vật lý</color>"),
    ),
  )
})

test("manual import evidence is hidden while gameplay facts and unrelated edits remain intact", () => {
  const capture = {
    patchCode: "2026-10-30",
    seasonCode: "s4-2026",
    observedAt: "2026-11-01T02:43:42.386Z",
    sourceForm: "default",
    fieldReview: { cooldown: { status: "VERIFIED" } },
    contentReview: {
      file: "content-review.json",
      fields: ["energy_cost"],
      status: "VISUALLY_CHECKED_LISTED_FIELDS_ONLY",
    },
    descriptionReviews: [{ status: "VERIFIED" }],
    fragments: [{ description: "Unreviewed source text" }],
    sourceImages: ["capture.png"],
    sourceArchive: "aov.zip",
    sourceArchiveSha256: "source-hash",
    identityBasis: "portrait",
    heroClassification: { role: "fighter" },
    observedAttributes: { physicalAttack: 160 },
    observedPatchValues: { cooldown: 5 },
    tableObservationStatus: "OBSERVED",
  }
  const before = skill("skill-1-1", { ...capture, cooldown: { seconds: 6 } })
  const after = skill("skill-1-1", { cooldown: { seconds: 5 } })
  const input = compare([before], [after])
  input.changes.push(
    { section: "profile", path: "/metadata/observedAt", kind: "REMOVED", before: capture.observedAt, after: null },
    { section: "profile", path: "/metadata", kind: "REMOVED", before: { capture: [capture] }, after: null },
    {
      section: "profile",
      path: "/extra",
      kind: "CHANGED",
      before: { caption: "Cũ", capture, optional: null },
      after: { caption: "Mới", optional: null },
    },
  )
  const original = structuredClone(input)
  const result = buildSkillComparison(input, "vi-VN")
  assert.deepEqual(result.skills[0].rows, [
    { id: "cooldown", label: "Hồi chiêu", before: "6 giây", after: "5 giây", kinds: [] },
  ])
  assert.deepEqual(
    result.otherChanges.map((change) => change.path),
    ["/summary", "/extra"],
  )
  assert.deepEqual(result.otherChanges[1].before, { caption: "Cũ", optional: null })
  assert.deepEqual(result.otherChanges[1].after, { caption: "Mới", optional: null })
  assert.deepEqual(input, original)
})
