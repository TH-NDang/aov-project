import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ATTRIBUTE_SOURCE_LABELS,
  combatAttributeRows,
} from "../src/features/publishing/model/assessment/combat-attributes"
import { STAT_STANDING_LABELS, statDistribution } from "../src/features/publishing/model/assessment/hero-stat-analysis"
import { comparisonValue, joinStatReadings } from "../src/features/publishing/model/assessment/hero-comparison"
import {
  formatStatReading,
  hasStatPercent,
  parseStatReading,
  statReadingChange,
} from "../src/features/publishing/model/assessment/stat-reading"

const readings = (input: string) => {
  const parsed = parseStatReading(input)
  return parsed.ok ? [parsed.value, parsed.percent] : parsed.message
}

test("only the four stats the game shows with a bar take a percent", () => {
  for (const key of ["ARMOR", "MAGIC_DEFENSE", "ARMOR_PIERCE", "MAGIC_PIERCE"]) assert.equal(hasStatPercent(key), true)
  for (const key of ["HP", "MOVEMENT_SPEED", "CRITICAL_DAMAGE", "COOLDOWN_REDUCTION", ""])
    assert.equal(hasStatPercent(key), false)
})

test("a value pasted the way the game shows it is read in every spacing", () => {
  for (const input of ["150 | 20%", "150|20%", "  150 |20 % ", "150 | 20"]) assert.deepEqual(readings(input), [150, 20])
  assert.deepEqual(readings("80 | 0%"), [80, 0])
  assert.deepEqual(readings("12.5 | 7,5%"), [12.5, 7.5])
})

test("a number alone is kept with its percent unknown, never as 0%", () => {
  assert.deepEqual(readings("145"), [145, null])
  assert.deepEqual(readings(""), [null, null])
  assert.deepEqual(readings("   "), [null, null])
})

test("malformed input says in Vietnamese what is wrong", () => {
  const cases: [string, RegExp][] = [
    ["20%", /Thiếu số hoặc thiếu dấu \|/],
    ["150 20%", /Thiếu số hoặc thiếu dấu \|/],
    ["| 20%", /Thiếu số trước dấu \|/],
    ["150 |", /Thiếu phần trăm sau dấu \|.*150 \| 0%/],
    ["150 | 20% | 3", /Chỉ có một dấu \|/],
    ["abc", /Số chưa đúng/],
    ["-5", /Số chưa đúng/],
    ["abc | 20%", /Số trước dấu \| chưa đúng/],
    ["150% | 20%", /Số trước dấu \| chưa đúng/],
    ["150 | abc", /Phần trăm sau dấu \| phải là số/],
    ["150 | -5%", /Phần trăm sau dấu \| phải là số/],
    ["150 | 101%", /phải từ 0 đến 100/],
  ]
  for (const [input, message] of cases) assert.match(String(readings(input)), message, input)
})

test("a stored reading prints as the game shows it and reads back the same", () => {
  assert.equal(formatStatReading(150, 20), "150 | 20%")
  assert.equal(formatStatReading(145, null), "145")
  assert.equal(formatStatReading(null, null), "")
  assert.equal(formatStatReading(null, 20), "— | 20%")
  assert.deepEqual(readings(formatStatReading(12.5, 7.5)), [12.5, 7.5])
})

test("the hero's own value shows the percent next to the number and in the reading", () => {
  const rows = combatAttributeRows(
    {
      values: [
        { statKey: "ARMOR", baseValue: 150, percentValue: 20, growthPerLevel: null, unit: "POINT" },
        { statKey: "MAGIC_DEFENSE", baseValue: 80, percentValue: null, growthPerLevel: null, unit: "UNKNOWN" },
        { statKey: "HP", baseValue: 3720, percentValue: null, growthPerLevel: null, unit: "HP" },
      ],
      sources: [],
    },
    undefined,
    [],
  )
  const row = (key: string) => rows.find((item) => item.key === key)!
  assert.equal(row("ARMOR").value, "150 | 20%")
  assert.equal(row("ARMOR").reading?.percent, 20)
  assert.equal(row("MAGIC_DEFENSE").value, "80")
  assert.equal(row("MAGIC_DEFENSE").reading?.percent, undefined)
  assert.equal(row("HP").value, "3720")
})

test("a stat row says where its value comes from with a code and labels it from the table", () => {
  const rows = combatAttributeRows(
    {
      values: [{ statKey: "HP", baseValue: 3720, percentValue: null, growthPerLevel: null, unit: "HP" }],
      sources: [],
    },
    undefined,
    [{ statKey: "ARMOR", baseValue: 150, unit: "POINT" } as Parameters<typeof combatAttributeRows>[2][number]],
  )
  const row = (key: string) => rows.find((item) => item.key === key)!

  assert.equal(row("HP").kind, "OWN")
  assert.equal(row("ARMOR").kind, "PATCH_DEFAULT")
  assert.equal(ATTRIBUTE_SOURCE_LABELS[row("ARMOR").kind], "Mặc định của patch")
})

test("a value at the top of its group stands high, and the label comes from the table", () => {
  const spread = statDistribution(900, [100, 200, 300, 400, 500, 900])

  assert.equal(spread.standing, "HIGH")
  assert.equal(spread.label, STAT_STANDING_LABELS.HIGH)
  assert.equal(statDistribution(100, [100, 200]).standing, "FEW_SAMPLES")
})

test("a whole stat row in a comparison reads as one value", () => {
  const armor = { statKey: "ARMOR", baseValue: 150, percentValue: 20, growthPerLevel: null, unit: "POINT" }
  assert.match(comparisonValue(armor), /Giá trị ghi nhận: 150 \| 20%/)
  assert.doesNotMatch(comparisonValue(armor), /Phần trăm/)
  const health = { statKey: "HP", baseValue: 3500, percentValue: null, growthPerLevel: null, unit: "POINT" }
  assert.match(comparisonValue(health), /Giá trị ghi nhận: 3500/)
  assert.doesNotMatch(comparisonValue(health), /Phần trăm/)
})

test("number and percent changes join into one line that names the whole reading", () => {
  const before = { combatStats: { values: [{ statKey: "ARMOR", baseValue: 150, percentValue: 20 }] } }
  const after = { combatStats: { values: [{ statKey: "ARMOR", baseValue: 160, percentValue: 0 }] } }
  const change = (path: string, left: unknown, right: unknown) => ({
    section: "combatStats",
    path,
    kind: "CHANGED",
    before: left,
    after: right,
  })
  assert.deepEqual(
    joinStatReadings(
      [change("/values/ARMOR/baseValue", 150, 160), change("/values/ARMOR/percentValue", 20, 0)],
      before,
      after,
    ),
    [change("/values/ARMOR/baseValue", "150 | 20%", "160 | 0%")],
  )
  const onlyPercent = { combatStats: { values: [{ statKey: "ARMOR", baseValue: 150, percentValue: 0 }] } }
  assert.deepEqual(joinStatReadings([change("/values/ARMOR/percentValue", 20, 0)], before, onlyPercent), [
    change("/values/ARMOR/baseValue", "150 | 20%", "150 | 0%"),
  ])
})

test("a percent recorded for the first time still reads as a change, not as an addition", () => {
  const before = { combatStats: { values: [{ statKey: "ARMOR", baseValue: 145, percentValue: null }] } }
  const after = { combatStats: { values: [{ statKey: "ARMOR", baseValue: 145, percentValue: 0 }] } }
  assert.deepEqual(
    joinStatReadings(
      [{ section: "combatStats", path: "/values/ARMOR/percentValue", kind: "ADDED", before: null, after: 0 }],
      before,
      after,
    ),
    [{ section: "combatStats", path: "/values/ARMOR/baseValue", kind: "CHANGED", before: "145", after: "145 | 0%" }],
  )
})

test("rows without a percent keep their plain number change and its difference", () => {
  const plain = { section: "combatStats", path: "/values/ARMOR/baseValue", kind: "CHANGED", before: 145, after: 150 }
  const before = { combatStats: { values: [{ statKey: "ARMOR", baseValue: 145, percentValue: null }] } }
  const after = { combatStats: { values: [{ statKey: "ARMOR", baseValue: 150, percentValue: null }] } }
  assert.deepEqual(joinStatReadings([plain], before, after), [plain])
  const health = { ...plain, path: "/values/HP/baseValue" }
  assert.deepEqual(joinStatReadings([health], {}, {}), [health])
  assert.equal(statReadingChange("HP", { baseValue: 1, percentValue: 2 }, { baseValue: 1, percentValue: 3 }), null)
})

test("the draft changes sheet lists a stat with a percent as one reading and other stats as plain numbers", async () => {
  const { changedRows } = await import("../src/features/publishing/components/patch-changes/hero-draft-changes")
  const row = (statKey: string, baseValue: number, percentValue: number | null) => ({
    statKey,
    baseValue,
    percentValue,
    growthPerLevel: null,
    unit: "POINT",
  })
  const before = { values: [row("ARMOR", 150, 0), row("HP", 3500, null), row("MAGIC_DEFENSE", 80, 0)] }
  const after = { values: [row("ARMOR", 150, 20), row("HP", 3600, null), row("MAGIC_DEFENSE", 80, 0)] }
  assert.deepEqual(changedRows(before, after, "vi-VN"), [
    {
      label: "Thuộc tính · Giáp · Giá trị ghi nhận",
      field: "baseValue",
      before: "150 | 0%",
      after: "150 | 20%",
    },
    { label: "Thuộc tính · Máu · Giá trị ghi nhận", field: "baseValue", before: 3500, after: 3600 },
  ])
})
