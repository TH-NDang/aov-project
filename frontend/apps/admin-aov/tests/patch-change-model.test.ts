import assert from "node:assert/strict"
import { test } from "node:test"
import {
  changePayload,
  duplicateRows,
  emptyRow,
  isHttpUrl,
  rowProblem,
  skillOptions,
  statOptions,
  suggestedRows,
} from "../src/features/publishing/patch-change-model"
import type { Content } from "../src/features/publishing/types"

const content = (
  hp: number,
  roles: Content["PROFILE"] extends infer P ? (P extends { roles: infer R } ? R : never) : never,
  description: string,
): Content => ({
  PROFILE: {
    translations: [{ locale: "vi-VN", name: "Airi", title: null, summary: null, lore: null }],
    roles,
    sources: [],
  },
  OVERVIEW_RATINGS: null,
  COMBAT_STATS: {
    values: [
      { statKey: "HP", baseValue: hp, growthPerLevel: 120, unit: "UNKNOWN" },
      { statKey: "CRITICAL_CHANCE", baseValue: 0, growthPerLevel: null, unit: "PERCENT" },
    ],
    sources: [],
  },
  SKILLS: {
    skills: [
      {
        skillKey: "skill-2",
        kind: "ACTIVE",
        formKey: null,
        displayOrder: 2,
        iconAssetId: null,
        translations: [{ locale: "vi-VN", name: "Phi tiêu", description }],
        effects: [],
      },
      {
        skillKey: "skill-1",
        kind: "PASSIVE",
        formKey: null,
        displayOrder: 1,
        iconAssetId: null,
        translations: [{ locale: "vi-VN", name: "Nội tại", description: "" }],
        effects: [],
      },
    ],
    sources: [],
  },
  SKINS: null,
  MEDIA_BINDINGS: null,
})

test("suggests only the stat, role and skill text that differ between snapshots", () => {
  const rows = suggestedRows(content(3500, ["ASSASSIN"], "Cũ"), content(3600, ["ASSASSIN", "WARRIOR"], "Mới"), "vi-VN")
  assert.deepEqual(
    rows.map((row) => [row.type, row.key, row.oldValue, row.newValue, row.added, row.kind]),
    [
      ["STAT", "HP", "3500", "3600", true, ""],
      ["ROLE", "WARRIOR", "", "", true, ""],
      ["SKILL", "skill-2", "Cũ", "Mới", true, ""],
    ],
  )
  assert.equal(rows[2].field, "description")
})

test("offers the snapshot's stats and skills in display order with readable names", () => {
  const reference = content(3500, ["ASSASSIN"], "")
  assert.deepEqual(
    statOptions(reference).map((option) => [option.key, option.label, option.unit, option.current]),
    [
      ["HP", "Máu", "UNKNOWN", 3500],
      ["CRITICAL_CHANCE", "Tỉ lệ chí mạng", "PERCENT", 0],
    ],
  )
  assert.deepEqual(
    skillOptions(reference, "vi-VN").map((option) => option.label),
    ["Nội tại", "Phi tiêu"],
  )
})

test("patch notes need both values, a kind and a changed value", () => {
  const stat = { ...emptyRow("STAT"), key: "HP", unit: "UNKNOWN", newValue: "3600" }
  assert.equal(rowProblem(stat, "PATCH_NOTES"), "Chọn tính chất thay đổi.")
  assert.match(rowProblem({ ...stat, kind: "BUFF" }, "PATCH_NOTES") ?? "", /trước và sau/)
  assert.equal(rowProblem({ ...stat, kind: "BUFF" }, "SNAPSHOT"), null)
  assert.match(rowProblem({ ...stat, kind: "BUFF", oldValue: "3600" }, "PATCH_NOTES") ?? "", /giống nhau/)
  assert.match(rowProblem({ ...stat, kind: "BUFF", oldValue: "abc" }, "PATCH_NOTES") ?? "", /là số/)
  assert.match(rowProblem({ ...emptyRow("VISUAL"), kind: "OTHER", key: "HEAD" }, "PATCH_NOTES") ?? "", /bản dữ liệu/)
  const skill = {
    ...emptyRow("SKILL"),
    kind: "NERF" as const,
    key: "skill-2",
    field: "cooldown",
    oldValue: "8",
    newValue: "10",
  }
  assert.equal(rowProblem(skill, "PATCH_NOTES"), null)
  assert.match(rowProblem({ ...skill, field: " " }, "PATCH_NOTES") ?? "", /trường/)
})

test("flags repeated stats, skill fields and roles", () => {
  const first = { ...emptyRow("STAT"), key: "HP" }
  const second = { ...emptyRow("STAT"), key: "HP" }
  const field = { ...emptyRow("SKILL"), key: "skill-2", field: "cooldown" }
  const otherField = { ...emptyRow("SKILL"), key: "skill-2", field: "damage" }
  assert.deepEqual([...duplicateRows([first, second, field, otherField])], [second.id])
})

test("builds the API change payload with numbers and trimmed keys", () => {
  assert.deepEqual(
    changePayload({
      ...emptyRow("STAT"),
      kind: "BUFF",
      key: "HP",
      unit: "UNKNOWN",
      oldValue: "3500",
      newValue: "3600,5",
    }),
    { type: "STAT", changeKind: "BUFF", statKey: "HP", unit: "UNKNOWN", oldValue: 3500, newValue: 3600.5 },
  )
  assert.deepEqual(changePayload({ ...emptyRow("ROLE"), kind: "ADJUSTMENT", key: "MAGE", added: false }), {
    type: "ROLE",
    changeKind: "ADJUSTMENT",
    roleCode: "MAGE",
    added: false,
  })
  assert.deepEqual(
    changePayload({
      ...emptyRow("SKILL"),
      kind: "NERF",
      key: "skill-2",
      field: " cooldown ",
      oldValue: "8",
      newValue: "10",
    }),
    {
      type: "SKILL",
      changeKind: "NERF",
      skillKey: "skill-2",
      fieldKey: "cooldown",
      oldValue: "8",
      newValue: "10",
    },
  )
})

test("accepts only http and https source links", () => {
  assert.equal(isHttpUrl("https://lienquan.garena.vn/patch"), true)
  assert.equal(isHttpUrl("ftp://example.org/notes"), false)
  assert.equal(isHttpUrl("ghi chú"), false)
})
