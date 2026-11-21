import assert from "node:assert/strict"
import { test } from "node:test"
import { matchesWarehouseSearch, warehouseStatLabel, type WarehouseEntry } from "../src/lib/warehouse-types.ts"

test("a stat is named from the shared stat list, not from a misspelling the entry recorded", () => {
  const recorded = { statLabels: { "physical-attack": "Công vậy lý", "custom-stat": "Chỉ số riêng" } }

  assert.equal(warehouseStatLabel("physical-attack", recorded, "vi-VN"), "Công vật lý")
  assert.equal(warehouseStatLabel("physical-attack", recorded, "en-US"), "Attack Damage")
  assert.equal(warehouseStatLabel("custom-stat", recorded, "vi-VN"), "Chỉ số riêng")
})

test("an entry is found by the shared names of its stats in either language", () => {
  const arcana = {
    id: "a",
    code: "do-3-cong-vat-ly-hut-mau",
    content: {
      stats: [{ key: "physical-lifesteal", value: 0.5, unit: "%" }],
      translations: [{ locale: "vi-VN", name: "ĐỎ III CÔNG VẬT LÝ/HÚT MÁU" }],
    },
  } as unknown as WarehouseEntry

  assert.ok(matchesWarehouseSearch(arcana, "life steal", "en-US"))
  assert.ok(matchesWarehouseSearch(arcana, "hut mau", "vi-VN"))
  assert.equal(matchesWarehouseSearch(arcana, "armor pierce", "en-US"), false)
})
