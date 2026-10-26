import assert from "node:assert/strict"
import { test } from "node:test"
import { warehouseItemLayout } from "../src/features/warehouse/warehouse-item-layout.ts"
import type { WarehouseContent, WarehouseEntry } from "../src/features/warehouse/warehouse-types.ts"

function item(
  code: string,
  tier: number,
  positions: NonNullable<WarehouseContent["shopPositions"]>,
  categoryCode = "phep",
): WarehouseEntry {
  return {
    id: code,
    code,
    revision: {
      id: `revision-${code}`,
      state: "PUBLISHED",
      effectiveFromPatchVariantId: null,
      publishedAt: "2026-10-26",
    },
    content: {
      tier,
      shopPositions: positions,
      categoryCode,
      iconAssetId: null,
      translations: [{ locale: "vi-VN", name: code }],
    },
  }
}

test("category layout preserves physical columns and row order independently from item tiers", () => {
  const entries = [
    item("xuyen-tam-lenh", 3, [{ categoryCode: "phep", column: 1, row: 3, variant: null }]),
    item("cau-chiem-tinh", 3, [{ categoryCode: "phep", column: 1, row: 2, variant: null }]),
    item("day-chuyen-luc-bao", 2, [{ categoryCode: "phep", column: 1, row: 1, variant: null }]),
    item("sach-phep", 1, [{ categoryCode: "phep", column: 0, row: 0, variant: null }]),
  ]
  const before = structuredClone(entries)
  const sections = warehouseItemLayout(entries, "phep")
  assert.deepEqual(
    sections.map((section) => [section.kind, section.value]),
    [
      ["column", 0],
      ["column", 1],
    ],
  )
  assert.deepEqual(
    sections[1].entries.map((entry) => entry.code),
    ["day-chuyen-luc-bao", "cau-chiem-tinh", "xuyen-tam-lenh"],
  )
  assert.equal(sections[1].entries[1].content.tier, 3)
  assert.deepEqual(entries, before)
})

test("general placement takes precedence over a variant and each category uses its own coordinates", () => {
  const entry = item("hybrid", 3, [
    { categoryCode: "phep", column: 2, row: 0, variant: "support" },
    { categoryCode: "phep", column: 1, row: 4, variant: null },
    { categoryCode: "thu", column: 0, row: 2, variant: null },
  ])
  assert.equal(warehouseItemLayout([entry], "phep")[0].value, 1)
  assert.equal(warehouseItemLayout([entry], "thu")[0].value, 0)
  assert.equal(warehouseItemLayout([entry], "cong").length, 0)
})

test("missing or invalid coordinates stay unplaced instead of borrowing tier as their column", () => {
  const entries = [
    item("no-placement", 3, []),
    item("no-row", 2, [{ categoryCode: "phep", column: 1, row: null, variant: null }]),
    item("negative-column", 1, [{ categoryCode: "phep", column: -1, row: 0, variant: null }]),
    item("other-group", 3, [], "thu"),
  ]
  const sections = warehouseItemLayout(entries, "phep")
  assert.equal(sections.length, 1)
  assert.equal(sections[0].kind, "unplaced")
  assert.deepEqual(
    sections[0].entries.map((entry) => entry.code),
    ["no-placement", "no-row", "negative-column"],
  )
})

test("all-items overview remains grouped by actual tier", () => {
  const entries = [
    item("advanced", 3, [{ categoryCode: "phep", column: 1, row: 0, variant: null }]),
    item("basic", 1, []),
  ]
  const sections = warehouseItemLayout(entries, "")
  assert.deepEqual(
    sections.map((section) => [section.kind, section.value]),
    [
      ["tier", 1],
      ["tier", 3],
    ],
  )
})
