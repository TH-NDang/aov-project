import assert from "node:assert/strict"
import { test } from "node:test"
import { warehouseStatLabel } from "../src/lib/warehouse-types.ts"

test("a stat is named from the shared stat list, not from a misspelling the entry recorded", () => {
  const recorded = { statLabels: { "physical-attack": "Công vậy lý", "custom-stat": "Chỉ số riêng" } }

  assert.equal(warehouseStatLabel("physical-attack", recorded, "vi-VN"), "Công vật lý")
  assert.equal(warehouseStatLabel("physical-attack", recorded, "en-US"), "Attack Damage")
  assert.equal(warehouseStatLabel("custom-stat", recorded, "vi-VN"), "Chỉ số riêng")
})
