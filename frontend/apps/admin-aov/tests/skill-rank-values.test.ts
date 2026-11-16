import assert from "node:assert/strict"
import { test } from "node:test"
import {
  compareSkillRanks,
  rankPartLabel,
  rankSummary,
  rankValues,
  skillRankCount,
  skillSourceTable,
  splitSkillRanks,
} from "../src/features/publishing/skill-rank-values"
import { markDescriptionChanges, mechanicSkillKey } from "../src/features/publishing/patch-description-marks"
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
  assert.equal(rankSummary(["15%", "18%", "21%"]), "15% (+3%/cấp chiêu)")
  assert.equal(rankSummary(["21%", "18%", "15%"]), "21% (−3%/cấp chiêu)")
  assert.equal(rankSummary(["8,5s", "8s", "7,5s"]), "8,5s (−0,5s/cấp chiêu)")
  assert.equal(rankSummary(["10 (+25% Công phép)", "15 (+25% Công phép)"]), "10 (+5/cấp chiêu) (+25% Công phép)")
  assert.equal(rankSummary(["10", "", "20"]), "10 / — / 20")
  assert.equal(rankSummary([10, 15, 25]), "10 / 15 / 25")
  assert.equal(rankSummary(["10s", "12%"]), "10s / 12%")
  assert.equal(rankSummary(["10", "20"], ["Lv 1", "Lv 3"]), "10 / 20")
  assert.equal(rankSummary(["10", "20"], columns), "10 / 20")
})

test("summary input round trips percentages, decimal cooldowns, large damage and combat coefficients", () => {
  for (const values of [
    ["1000", "1250", "1500"],
    ["15%", "18%", "21%"],
    ["21%", "18%", "15%"],
    ["8,5s", "8s", "7,5s"],
    ["10 (+25% Công phép)", "15 (+25% Công phép)"],
  ]) {
    const summary = rankSummary(values)!
    assert.deepEqual(rankValues(summary, values.length), rankValues(values, values.length), summary)
  }
  assert.deepEqual(rankValues("315 (+40/cấp chiêu)", 6), ["315", "355", "395", "435", "475", "515"])
  assert.deepEqual(rankValues("11 (-0,4/cấp chiêu)", 6), ["11", "10,6", "10,2", "9,8", "9,4", "9"])
  assert.deepEqual(rankValues("450 + 0,9 × Công phép", 2), ["450 + 0,9 × Công phép", "450 + 0,9 × Công phép"])
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

const shield = {
  oldValue: "350 + 110*(rank-1) + 0.4*magicAttack + 0.04*maxHealth",
  newValue: "500 + 100*(rank-1) + 0.5*magicAttack + 0.05*maxHealth",
}
const damage = {
  oldValue: "450 + 110*(rank-1) + 0.4*magicAttack + 0.04*maxHealth",
  newValue: "500 + 100*(rank-1) + 0.5*magicAttack + 0.05*maxHealth",
}

test("a formula change splits into plain numbers: its base by rank, then each stat share as the game writes it", () => {
  const split = splitSkillRanks(shield.oldValue, shield.newValue, skill(), skill())!
  assert.deepEqual(
    split.parts.map((part) => [rankPartLabel(part.key, "Lá chắn"), part.before, part.after, part.summary]),
    [
      [
        "Lá chắn gốc",
        ["350", "460", "570", "680", "790", "900"],
        ["500", "600", "700", "800", "900", "1000"],
        { before: "350 (+110/cấp chiêu)", after: "500 (+100/cấp chiêu)" },
      ],
      ["Tỷ lệ Công phép", Array(6).fill("40%"), Array(6).fill("50%"), { before: "40%", after: "50%" }],
      ["Tỷ lệ Máu tối đa", Array(6).fill("4%"), Array(6).fill("5%"), { before: "4%", after: "5%" }],
    ],
  )
  assert.deepEqual(splitSkillRanks(damage.oldValue, damage.newValue, skill(), skill())!.parts[0].changed, [
    true,
    true,
    true,
    true,
    true,
    false,
  ])
  // Plain numbers and values without a stat share keep the single comparison.
  assert.equal(splitSkillRanks("8 - 0.5*(rank-1)", "8 - 0.3*(rank-1)", skill(), skill()), null)
  assert.equal(splitSkillRanks("Làm chậm", "Choáng", skill(), skill()), null)
  assert.deepEqual(
    splitSkillRanks("0.8*physicalAttack", "0.9*physicalAttack", skill(), skill())?.parts.map((part) => [
      part.key,
      part.before,
      part.after,
    ]),
    [["physicalAttack", ["80%"], ["90%"]]],
  )
  assert.equal(rankPartLabel("base", "Sát thương gốc"), "Sát thương gốc")
})

test("the description marks each changed number once, in recorded order, and never reads inside markup", () => {
  const description =
    "Chặn 500 <color=#9A71E2>(+50%Công phép)</color> (5% máu tối đa) trong 5 giây. Sau 1.5 giây gây 500 <color=#9A71E2>(+50%Công phép)</color>(+5% máu tối đa), 50% sát thương."
  const { text, marks } = markDescriptionChanges(description, [shield, damage], skill())
  assert.equal(marks, 6)
  assert.equal(
    text,
    "Chặn <muted>350 → </muted><b>500</b> <color=#9A71E2>(+<muted>40% → </muted><b>50%</b>Công phép)</color> (<muted>4% → </muted><b>5%</b> máu tối đa) trong 5 giây. Sau 1.5 giây gây <muted>450 → </muted><b>500</b> <color=#9A71E2>(+<muted>40% → </muted><b>50%</b>Công phép)</color>(+<muted>4% → </muted><b>5%</b> máu tối đa), 50% sát thương.",
  )
  assert.deepEqual(markDescriptionChanges("Hồi 6 giây", [{ oldValue: "6", newValue: "5" }], skill()), {
    text: "Hồi 6 giây",
    marks: 0,
  })
})

test("mechanic notes find their skill by the name the patch notes use", () => {
  const skills = ["skill-0-1", "skill-1-1", "skill-1-2", "skill-2-1"].map((skillKey, displayOrder) => ({
    ...skill(),
    skillKey,
    displayOrder,
  }))
  assert.deepEqual(
    ["Nội tại", "Chiêu 1", "chiêu 2", "skill-1-2", "additional-self-heal"].map((name) =>
      mechanicSkillKey(name, skills),
    ),
    ["skill-0-1", "skill-1-1", "skill-2-1", "skill-1-2", undefined],
  )
})
