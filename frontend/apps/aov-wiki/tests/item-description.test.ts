import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatItemStatValue,
  itemMatchesStatFilters,
  itemReaderContent,
  itemStatFilterCounts,
  itemStatsFromDescription,
  parseItemDescription,
  similarItems,
} from "../../../packages/ui/src/lib/item-description.ts"

test("stat lines become values and named passives are split from their text", () => {
  const parsed = parseItemDescription(
    "+60 Công vật lý\n+30% Tốc đánh\n+10% Hút máu\n\nHơi thở rồng: Đòn đánh thường gây thêm sát thương – Nội tại duy nhất",
  )

  assert.deepEqual(
    parsed.stats.map((stat) => [stat.key, stat.value, stat.percent]),
    [
      ["physicalAttack", 60, false],
      ["attackSpeed", 30, true],
      ["lifesteal", 10, true],
    ],
  )
  assert.deepEqual(parsed.passives, [
    { name: "Hơi thở rồng", text: "Đòn đánh thường gây thêm sát thương", unique: true },
  ])
})

test("the spellings and typos found in published items still resolve to a known stat", () => {
  const stats = parseItemDescription(
    '+ 600 Máu tối đâ\n"+30% Tốc đáng\n10 Công vật lý\n+5% giảm Hồi chiêu\n+1.000 máu tối đa',
  ).stats

  assert.deepEqual(
    stats.map((stat) => [stat.key, stat.value]),
    [
      ["maxHealth", 600],
      ["attackSpeed", 30],
      ["physicalAttack", 10],
      ["cooldownReduction", 5],
      ["maxHealth", 1000],
    ],
  )
})

test("a stat granted by a unique passive keeps its note", () => {
  const [movement, pierce, tenacity] = parseItemDescription(
    "+10% Tốc chạy – Nội tại duy nhất: Gia tốc\n+150 Xuyên giáp - Phá giáp - Nội tại duy nhất\n+35% Kháng hiệu ứng – Nội tại duy nhất (giảm thời gian bị khống chế)",
  ).stats

  assert.deepEqual([movement.key, movement.unique, movement.note], ["movementSpeed", true, "Gia tốc"])
  assert.deepEqual([pierce.key, pierce.unique, pierce.note], ["armorPierce", true, "Phá giáp"])
  assert.deepEqual([tenacity.key, tenacity.unique, tenacity.note], ["tenacity", true, "giảm thời gian bị khống chế"])
})

test("the other passive spellings lose their unique marker but keep their name", () => {
  const { passives } = parseItemDescription(
    "Nội tại duy nhất – Đông Băng: Đánh thường làm chậm 5%\nTróc nã – Hỏa diệm giảm 40% hồi máu – Nội tại duy nhất",
  )

  assert.deepEqual(passives, [
    { name: "Đông Băng", text: "Đánh thường làm chậm 5%", unique: true },
    { name: "Tróc nã", text: "Hỏa diệm giảm 40% hồi máu", unique: true },
  ])
})

test("flavour text, plain sentences and numbers in sentences are not mistaken for stats", () => {
  const parsed = parseItemDescription(
    "(Chiến giáp của hắn cũng thiêu đốt)\n(Bị phong ấn vì chạm vào điều cấm kỵ).\n(Lời dẫn chưa đóng\nNhận hiệu ứng tê tái\n10 giây hồi chiêu sau khi kích hoạt",
  )

  assert.deepEqual(parsed.stats, [])
  assert.deepEqual(parsed.notes, [
    "Chiến giáp của hắn cũng thiêu đốt",
    "Bị phong ấn vì chạm vào điều cấm kỵ",
    "Lời dẫn chưa đóng",
  ])
  assert.deepEqual(
    parsed.passives.map((passive) => passive.text),
    ["Nhận hiệu ứng tê tái", "10 giây hồi chiêu sau khi kích hoạt"],
  )
})

test("a passive that opens with a scaling value is not read as a note", () => {
  const { notes, passives } = parseItemDescription("(+30% công vật lý) sát thương lan")

  assert.deepEqual(notes, [])
  assert.equal(passives.length, 1)
})

test("an unknown stat keeps its original label instead of disappearing", () => {
  const [stat] = parseItemDescription("+12 Sức mạnh cổ").stats

  assert.deepEqual([stat.key, stat.label, stat.value], [null, "Sức mạnh cổ", 12])
})

test("structured stats win over the description, whose passives still show", () => {
  const reading = itemReaderContent(
    { stats: [{ key: "armor", value: 200, unit: "POINT" }] },
    { description: "+60 Công vật lý\nGiáp băng: Nhận giáp", effects: [{ name: "Mới", description: "Hiệu ứng mới" }] },
  )

  assert.deepEqual(
    reading.stats.map((stat) => [stat.key, stat.label]),
    [["armor", "Giáp"]],
  )
  assert.deepEqual(
    reading.passives.map((passive) => passive.name),
    ["Mới", "Giáp băng"],
  )
})

test("the editor can turn description stats into structured ones", () => {
  assert.deepEqual(itemStatsFromDescription("+60 Công vật lý\n+30% Tốc đánh\n+12 Sức mạnh cổ\nGiáp băng: Nhận giáp"), [
    { key: "physicalAttack", value: 60, unit: "POINT" },
    { key: "attackSpeed", value: 30, unit: "PERCENT" },
  ])
})

test("stat filters require every chip and count what each chip would leave", () => {
  const crit = [{ key: "criticalChance" as const }, { key: "physicalAttack" as const }]
  const attack = [{ key: "physicalAttack" as const }]

  assert.equal(itemMatchesStatFilters(crit, ["crit", "physical"]), true)
  assert.equal(itemMatchesStatFilters(attack, ["crit", "physical"]), false)
  assert.equal(itemMatchesStatFilters(attack, []), true)

  const counts = itemStatFilterCounts([crit, attack], ["physical"])
  assert.equal(counts.physical, 2)
  assert.equal(counts.crit, 1)
  assert.equal(counts.magic, 0)
})

test("similar items share the tier and most stats, closest in price first", () => {
  const item = (id: string, tier: number, price: number) => ({ id, content: { tier, price } })
  const stats: Record<string, { key: "physicalAttack" | "lifesteal" | "armor" }[]> = {
    self: [{ key: "physicalAttack" }, { key: "lifesteal" }],
    near: [{ key: "physicalAttack" }, { key: "lifesteal" }],
    far: [{ key: "physicalAttack" }, { key: "lifesteal" }],
    lower: [{ key: "physicalAttack" }, { key: "lifesteal" }],
    single: [{ key: "physicalAttack" }],
    other: [{ key: "armor" }],
  }
  const self = item("self", 3, 2000)
  const found = similarItems(
    self,
    [
      item("far", 3, 2900),
      item("near", 3, 2100),
      item("lower", 2, 2000),
      item("single", 3, 2000),
      item("other", 3, 2000),
      self,
    ],
    (entry) => stats[entry.id],
  )

  assert.deepEqual(
    found.map((entry) => entry.id),
    ["near", "far"],
  )
})

test("values read as gains, except a stat stored as a penalty", () => {
  assert.equal(formatItemStatValue({ value: 30, percent: true }), "+30%")
  assert.equal(formatItemStatValue({ value: -5, percent: false }), "-5")
})
