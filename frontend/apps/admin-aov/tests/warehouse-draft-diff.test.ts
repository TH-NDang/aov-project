import assert from "node:assert/strict"
import { test } from "node:test"
import { comparableData, languageChanges, wordDiff } from "../src/features/warehouse/model/warehouse-draft-diff"

test("a one-word fix in a long text shows as that word removed and the new one added", () => {
  assert.deepEqual(wordDiff("Công vậy lý +2.5; Hút máu +0.5%", "Công vật lý +2.5; Hút máu +0.5%"), [
    { kind: "same", text: "Công " },
    { kind: "removed", text: "vậy " },
    { kind: "added", text: "vật " },
    { kind: "same", text: "lý +2.5; Hút máu +0.5%" },
  ])
})

test("a draft lists each language it touches once, the reading language first, with new ones read as their text", () => {
  const before = {
    translations: [{ locale: "vi-VN", name: "Trừng trị", description: "10 giây hồi chiêu: gây sát thương." }],
    states: [{ key: "regular", translations: [{ locale: "vi-VN", name: "Trừng trị thường" }] }],
  }
  const after = {
    translations: [
      { locale: "en-US", name: "Punish", description: "Deals damage.", effects: [], statLabels: {} },
      { locale: "th-TH", name: "Punish TH" },
      { locale: "vi-VN", name: "Trừng trị", description: "Gây sát thương. Hồi chiêu: 10 giây." },
    ],
    states: [
      {
        key: "regular",
        translations: [
          { locale: "vi-VN", name: "Trừng trị thường" },
          { locale: "en-US", name: "Regular Punish" },
        ],
      },
    ],
  }

  const changes = languageChanges(before, after, "vi-VN")

  assert.deepEqual(
    changes.map((change) => [change.locale, change.kind, change.fields.map((field) => field.label)]),
    [
      ["vi-VN", "changed", ["Mô tả"]],
      ["en-US", "added", ["Tên", "Mô tả", "Dạng · Trừng trị thường · Tên"]],
      ["th-TH", "added", ["Tên"]],
    ],
  )
  assert.equal(changes[1].fields[0].before, null)
})

test("the data of a draft compares stats by their shared names and leaves the texts to the language tabs", () => {
  const data = comparableData({
    translations: [{ locale: "vi-VN", name: "Ngọc" }],
    stats: [{ key: "physical-lifesteal", value: 0.6, unit: "%" }],
    states: [{ key: "regular", iconAssetId: null, translations: [{ locale: "vi-VN", name: "Thường" }] }],
  })

  assert.deepEqual(data, { stats: { "Hút máu": "0.6%" }, states: [{ key: "regular", iconAssetId: null }] })
})
