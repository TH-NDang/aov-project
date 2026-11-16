import assert from "node:assert/strict"
import { test } from "node:test"
import {
  localizedFormName,
  localizedRankLabel,
  localizedSkillCost,
  localizedStateName,
} from "../src/features/hero/hero-skill-labels.ts"

test("skill labels stay as recorded for Vietnamese readers", () => {
  assert.equal(localizedRankLabel("ST gốc", "vi-VN"), "ST gốc")
  assert.equal(localizedSkillCost("<color=#D07649>H.chiêu: 8s</color>", "vi-VN"), "<color=#D07649>H.chiêu: 8s</color>")
  assert.equal(localizedFormName("Cường hóa", "vi-VN"), "Cường hóa")
  assert.equal(localizedStateName("Tái kích hoạt", "vi-VN"), "Tái kích hoạt")
})

test("English readers get the level table rows in English and keep the formatting tags", () => {
  assert.equal(localizedRankLabel("ST gốc", "en-US"), "Base damage")
  assert.equal(localizedRankLabel("<color=#C6633E>Hồi chiêu</color>", "en-US"), "<color=#C6633E>Cooldown</color>")
  assert.equal(localizedRankLabel("  Tăng tốc chạy ", "en-US"), "  Movement Speed bonus ")
})

test("a label the tables do not know stays in the language it was recorded in", () => {
  assert.equal(localizedRankLabel("ST Pháo tử quang", "en-US"), "ST Pháo tử quang")
  assert.equal(localizedFormName("Loan đao", "en-US"), "Loan đao")
  assert.equal(localizedStateName("Chiến vương bất tử", "en-US"), "Chiến vương bất tử")
  assert.equal(localizedSkillCost("Chưa rõ", "en-US"), "Chưa rõ")
})

test("cooldown and cost lines keep their numbers", () => {
  assert.equal(localizedSkillCost("<color=#D07649>H.chiêu: 8s</color>", "en-US"), "<color=#D07649>Cooldown: 8s</color>")
  assert.equal(localizedSkillCost("<color=#62A2CC>N.lượng: 50</color>", "en-US"), "<color=#62A2CC>Mana: 50</color>")
  assert.equal(localizedSkillCost("Nội năng cần: 30", "en-US"), "Energy needed: 30")
  assert.equal(localizedSkillCost("Hao máu: 8% máu hiện tại", "en-US"), "HP cost: 8% of current HP")
})

test("form and state names read in English", () => {
  assert.equal(localizedFormName(" Quang minh ", "en-US"), "Light")
  assert.equal(localizedFormName("Biến thể 2", "en-US"), "Biến thể 2")
  assert.equal(localizedStateName("25 tầng dịch bệnh", "en-US"), "25 plague stacks")
})
