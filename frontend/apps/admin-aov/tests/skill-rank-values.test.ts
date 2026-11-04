import assert from "node:assert/strict"
import { test } from "node:test"
import {
  compareSkillRanks,
  rankSummary,
  rankValues,
  skillRankCount,
  skillSourceTable,
} from "../src/features/publishing/skill-rank-values"
import { buildSkillComparison } from "../src/features/publishing/hero-skill-comparison"
import type { Skill } from "../src/features/publishing/types"
import type { HeroComparison } from "../src/features/publishing/publishing-api"

const skill = (columns = ["Thông tin công bố"], values = ["8 - 0.3/cấp chiêu"]): Skill => ({
  skillKey: "skill-1-1",
  kind: "ACTIVE",
  formKey: null,
  displayOrder: 1,
  iconAssetId: null,
  translations: [{ locale: "vi-VN", name: "Cú đấm thăng hoa", description: "Mô tả" }],
  effects: [
    {
      effectType: "SOURCE_SNAPSHOT",
      metadata: {
        levelTable: { column_labels: columns, rows: [{ label: "Hồi chiêu (giây)", display_values: values }] },
      },
    },
  ],
})

test("cooldown formulas expand from rank one without floating point residue or source mutation", () => {
  const expected = ["8", "7,7", "7,4", "7,1", "6,8", "6,5"]
  for (const formula of ["8 - 0.3/cấp chiêu", "8 - 0.3*(rank-1)", "8s (-0.3s/cấp chiêu)"])
    assert.deepEqual(rankValues(formula, 6), expected)
  const source = skill()
  const copy = structuredClone(source)
  const table = skillSourceTable(source)
  assert.deepEqual(table.columns, ["Cấp 1", "Cấp 2", "Cấp 3", "Cấp 4", "Cấp 5", "Cấp 6"])
  assert.deepEqual(table.rows[0].values, expected)
  assert.equal(table.rows[0].label, "Hồi chiêu (giây)")
  assert.equal(table.rows[0].summary, "8 - 0.3/cấp chiêu")
  assert.equal(table.derived, true)
  assert.deepEqual(source, copy)
})

test("damage tables evaluate rank scaling but retain unknown combat stats as readable coefficients", () => {
  for (const formula of [
    "450 + 90*(rank-1) + 0.9*magicAttack",
    "450 + 90/cấp chiêu + 0.9 công phép",
    "450 (+90/cấp chiêu) (+90% công phép)",
  ])
    assert.deepEqual(rankValues(formula, 3), [
      "450 + 0,9 × Công phép",
      "540 + 0,9 × Công phép",
      "630 + 0,9 × Công phép",
    ])
  assert.deepEqual(rankValues("100 + 20*(rank-1) + 0.1*maxHealth + 2*heroLevel", 2), [
    "100 + 0,1 × Máu tối đa + 2 × cấp tướng",
    "120 + 0,1 × Máu tối đa + 2 × cấp tướng",
  ])
  for (const invalid of [
    "8 + futureStat*(rank-1)",
    "rank/0",
    "rank/(magicAttack+1)",
    "rank);alert(1)",
    "rank +",
    "8/7/6",
  ])
    assert.equal(rankValues(invalid, 6), null)
})

test("recorded rank summaries infer only complete, uniform series and retain the recorded cells", () => {
  const columns = Array.from({ length: 6 }, (_, i) => `Lv ${i + 1}`)
  const values = ["11", "10.6", "10.2", "9.8", "9.4", "9"]
  for (const [series, summary] of [
    [[125, 150, 175, 200, 225, 250], "125 (+25/cấp chiêu)"],
    [[250, 300, 350, 400, 450, 500], "250 (+50/cấp chiêu)"],
    [[150, 180, 210, 240, 270, 300], "150 (+30/cấp chiêu)"],
    [values, "11 (−0,4/cấp chiêu)"],
  ] as const)
    assert.equal(rankSummary(series, columns), summary)
  const table = skillSourceTable(skill(columns, values))
  assert.equal(table.rows[0].summary, "11 (−0,4/cấp chiêu)")
  assert.deepEqual(table.rows[0].values, values)
  assert.equal(compareSkillRanks(values, values)?.summary.before, table.rows[0].summary)
  assert.equal(rankSummary(["0%", "0%", "0%"]), "0%")
  assert.equal(rankSummary(["10%", "12%", "14%"]), "10% (+2 điểm %/cấp chiêu)")
  assert.equal(rankSummary(["8,5s", "8s", "7,5s"]), "8,5s (−0,5s/cấp chiêu)")
  assert.equal(rankSummary(["10 (+25% Công phép)", "15 (+25% Công phép)"]), "10 (+5/cấp chiêu) (+25% Công phép)")
  assert.equal(rankSummary(["10", "", "20"]), "10 / — / 20")
  assert.equal(rankSummary([10, 15, 25]), "10 / 15 / 25")
  assert.equal(rankSummary(["10s", "12%"]), "10s / 12%")
  assert.equal(rankSummary(["10", "20"], ["Lv 1", "Lv 3"]), "10 / 20")
  assert.equal(rankSummary(["10", "20"], columns), "10 / 20")
})

test("recorded rank counts override standard slots and unknown or passive slots are not guessed", () => {
  assert.equal(skillRankCount(skill(["Lv 1", "Lv 2", "Lv 3", "Lv 4"])), 4)
  assert.equal(skillRankCount({ ...skill(), skillKey: "skill-3-1" }), 3)
  assert.equal(skillRankCount({ ...skill(), kind: "PASSIVE" }), null)
  assert.equal(skillRankCount({ ...skill(), skillKey: "alternate-form" }), null)
  const unknown = skill()
  unknown.effects[0].metadata.levelTable = {
    column_labels: ["Thông tin công bố"],
    rows: [{ label: "Cơ chế", display_values: ["Cộng dồn giảm từng tầng"] }],
  }
  assert.deepEqual(skillSourceTable(unknown).rows[0].values, ["Cộng dồn giảm từng tầng"])
})

test("rank comparison keeps unchanged columns neutral and missing values distinct from zero", () => {
  const result = compareSkillRanks("8 - 0.5*(rank-1)", "8 - 0.3/cấp chiêu", skill(), skill())!
  assert.deepEqual(result.before, ["8", "7,5", "7", "6,5", "6", "5,5"])
  assert.deepEqual(result.after, ["8", "7,7", "7,4", "7,1", "6,8", "6,5"])
  assert.deepEqual(result.changed, [false, true, true, true, true, true])
  assert.deepEqual(compareSkillRanks(["0", "0"], null, skill(), skill())?.after, [null, null])
  assert.equal(compareSkillRanks(["Vật lý", "Làm chậm"], ["Vật lý", "Choáng"], skill(), skill()), null)
  assert.deepEqual(compareSkillRanks(["Lv 1: 8", "Lv 2: 7.7"], ["8", "7,7"], skill(), skill())?.changed, [false, false])
})

test("history suppresses a formula and a rank table that describe identical values", () => {
  const input = {
    before: { skills: { skills: [skill()] } },
    after: {
      skills: {
        skills: [skill(["Lv 1", "Lv 2", "Lv 3", "Lv 4", "Lv 5", "Lv 6"], ["8", "7.7", "7.4", "7.1", "6.8", "6.5"])],
      },
    },
    changes: [],
  } as unknown as HeroComparison
  assert.deepEqual(buildSkillComparison(input, "vi-VN").skills, [])
})
