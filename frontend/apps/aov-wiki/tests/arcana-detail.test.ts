import assert from "node:assert/strict"
import { test } from "node:test"
import { arcanaDetailDescription } from "../src/features/warehouse/warehouse-types.ts"

test("arcana details omit stat-only descriptions while preserving distinct gameplay text", () => {
  const statRows = [
    { label: "Công phép", value: "+1,3" },
    { label: "Tốc đánh", value: "+0,2%" },
  ]
  const text = { locale: "vi-VN", name: "Đỏ I Công phép/Tốc đánh", description: "Công phép +1.3; Tốc đánh +0.2%" }
  assert.equal(arcanaDetailDescription(text, statRows), undefined)
  assert.equal(arcanaDetailDescription(text, []), text.description)
  const note = "Chỉ có hiệu lực khi đánh thường."
  assert.equal(arcanaDetailDescription({ ...text, summary: note }, statRows), note)
  assert.equal(arcanaDetailDescription({ ...text, description: note }, statRows), note)
  assert.equal(arcanaDetailDescription({ ...text, description: "Tốc đánh -0,2%" }, statRows), "Tốc đánh -0,2%")
})
