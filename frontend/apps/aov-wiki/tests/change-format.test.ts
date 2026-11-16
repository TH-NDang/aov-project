import assert from "node:assert/strict"
import test from "node:test"
import {
  changeFieldLabel,
  changeSetKind,
  changeSkillLabel,
  formatChangeValue,
  parseChangeSummary,
} from "../src/lib/wiki-change-format.ts"

test("change formulas read as ranks and stat percentages", () => {
  assert.equal(
    formatChangeValue("105 + 21*(rank-1) + 0.2*physicalAttack", "vi-VN"),
    "105 + 21 mỗi cấp + 20% Công vật lý",
  )
  assert.equal(
    formatChangeValue("500 + 100*(rank-1) + 0.5*magicAttack + 0.05*maxHealth", "en-US"),
    "500 + 100 per level + 50% Ability Power + 5% Max HP",
  )
  assert.equal(formatChangeValue("0.07*bonusPhysicalAttack", "vi-VN"), "7% Công vật lý cộng thêm")
  assert.equal(formatChangeValue("50 - 5*(rank-1)", "vi-VN"), "50 − 5 mỗi cấp")
})

test("values the formatter does not understand stay as published", () => {
  assert.equal(formatChangeValue("12", "vi-VN"), "12")
  assert.equal(formatChangeValue("3 + 0.2*unknownStat", "vi-VN"), "3 + 0.2*unknownStat")
  assert.equal(formatChangeValue("Hất tung 1 giây", "vi-VN"), "Hất tung 1 giây")
  assert.equal(formatChangeValue(null, "vi-VN"), "—")
})

test("skill keys and field keys become labels with a readable fallback", () => {
  assert.equal(changeSkillLabel("skill-0-1", "vi-VN"), "Nội tại")
  assert.equal(changeSkillLabel("skill-2-1", "en-US"), "Ability 2")
  assert.equal(changeSkillLabel("capture-1", "vi-VN"), null)
  assert.equal(changeFieldLabel("trueDamage", "vi-VN"), "Sát thương chuẩn")
  assert.equal(changeFieldLabel("slowDurationSeconds", "en-US"), "Slow duration seconds")
  assert.equal(changeFieldLabel(null, "vi-VN"), "Thay đổi")
  assert.equal(changeFieldLabel("passive.empoweredPhysicalDamage", "vi-VN"), "Sát thương vật lý cường hóa")
  assert.equal(changeFieldLabel("skill_2.magicDamage", "vi-VN"), "Sát thương phép")
  assert.equal(changeFieldLabel("skill_2.skill_1InnerAreaLink", "vi-VN"), "Thông số")
})

test("imported summaries separate the sentence from the source and the editor's remark", () => {
  assert.deepEqual(
    parseChangeSummary(
      "Đổi sát thương đánh cường hóa.\nNguồn: https://lienquan.garena.vn/a/\nĐối chiếu các trường được bài công bố; phần còn lại kế thừa dữ liệu nền.",
    ),
    { text: "Đổi sát thương đánh cường hóa.", source: "https://lienquan.garena.vn/a/" },
  )
  assert.deepEqual(parseChangeSummary("Tăng sát thương."), { text: "Tăng sát thương.", source: null })
  assert.deepEqual(parseChangeSummary(null), { text: "", source: null })
})

test("a change set is labelled by its own kind or by what its changes share", () => {
  assert.equal(changeSetKind({ overallKind: "REWORK", changes: [{ changeKind: "BUFF" }] }), "REWORK")
  assert.equal(changeSetKind({ changes: [{ changeKind: "BUFF" }, { changeKind: "BUFF" }] }), "BUFF")
  assert.equal(changeSetKind({ changes: [{ changeKind: "BUFF" }, { changeKind: "NERF" }] }), "ADJUSTMENT")
  assert.equal(changeSetKind({ changes: [] }), null)
})
