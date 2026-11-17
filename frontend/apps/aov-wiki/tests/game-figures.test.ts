import assert from "node:assert/strict"
import test from "node:test"
import { warehouseStatValue } from "../src/features/warehouse/warehouse-types.ts"

test("an arcana stat keeps the game's decimal dot in Vietnamese", () => {
  assert.equal(warehouseStatValue({ key: "ARMOR", value: 3.1, unit: null }, "vi-VN"), "+3.1")
})

test("a large in-game figure has no thousands separator in English", () => {
  assert.equal(warehouseStatValue({ key: "MAX_HEALTH", value: 1200, unit: null }, "en-US"), "+1200")
})

test("a percent stat is written right after its number", () => {
  assert.equal(warehouseStatValue({ key: "CRIT", value: 0.75, unit: "PERCENT" }, "vi-VN"), "+0.75%")
})
