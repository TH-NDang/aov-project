import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatItemStatValue,
  itemProfile,
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

const profile = (description: string, summary?: string, category?: string) =>
  itemProfile(itemReaderContent({}, { description }), { summary, category })

function ranked(
  own: ReturnType<typeof profile>,
  others: Record<string, ReturnType<typeof profile>>,
  { tier = 3, prices = {} as Record<string, number> } = {},
) {
  const item = (id: string) => ({ id, content: { tier, price: prices[id] ?? 2000 } })
  const profiles: Record<string, ReturnType<typeof profile>> = { self: own, ...others }
  return similarItems(item("self"), Object.keys(others).map(item), (entry) => profiles[entry.id])
}

test("a shared passive counts for more than a list of shared stats", () => {
  const found = ranked(profile("+60 Công vật lý\n+10% Tốc đánh\n+5% Tốc chạy\nTróc nã: Giảm 40% hiệu ứng hồi máu"), {
    statsOnly: profile("+60 Công vật lý\n+10% Tốc đánh\n+5% Tốc chạy\nLốc xoáy: Gây thêm sát thương"),
    samePassive: profile("+50 Công vật lý\n+200 Giáp\nTróc nã: Giảm 40% hiệu ứng hồi máu"),
  })

  assert.deepEqual(
    found.map(({ item }) => item.id),
    ["samePassive"],
  )
  assert.deepEqual(found[0].reasons[0], { vi: "Tróc nã", en: "Tróc nã" })
})

test("passives with different names match when they do the same thing", () => {
  const found = ranked(profile("+200 Giáp\nBăng giá: Đòn đánh làm chậm mục tiêu"), {
    sameEffect: profile("+400 Máu tối đa\nLính gác: Tung chiêu làm chậm kẻ địch\n+200 Giáp"),
    otherEffect: profile("+200 Giáp\nLính gác: Nhận lá chắn khi ít máu"),
  })

  assert.deepEqual(
    found.map(({ item }) => item.id),
    ["sameEffect"],
  )
  assert.ok(found[0].reasons.some((reason) => reason.vi === "Làm chậm"))
})

test("reducing healing is not read as healing", () => {
  assert.deepEqual(profile("Tróc nã: Mục tiêu bị giảm 40% hiệu quả hồi máu").effects, ["anti-heal"])
  assert.deepEqual(profile("Hồi phục: Khi chịu sát thương, tướng hồi 4% máu tối đa").effects, ["heal"])
})

test("an item for the other damage type needs a strong reason to appear", () => {
  const physical = profile("+60 Công vật lý\n+500 Máu tối đa\nCuồng phong: Đòn đánh làm chậm mục tiêu", "", "cong")

  assert.deepEqual(
    ranked(physical, {
      magicSameEffect: profile("+60 Công phép\n+500 Máu tối đa\nGiá băng: Tung chiêu làm chậm mục tiêu"),
    }),
    [],
  )
  assert.deepEqual(
    ranked(physical, {
      magicSamePassive: profile("+60 Công phép\n+500 Máu tối đa\nCuồng phong: Đòn đánh làm chậm mục tiêu"),
    }).map(({ item }) => item.id),
    ["magicSamePassive"],
  )
})

test("stats alone are enough only within the same shop category", () => {
  const own = profile("+100 Công vật lý\n+25% Tỷ lệ chí mạng", "", "cong")

  assert.deepEqual(
    ranked(own, {
      sameCategory: profile("+80 Công vật lý\n+15% Tỷ lệ chí mạng", "", "cong"),
      otherCategory: profile("+80 Công vật lý\n+15% Tỷ lệ chí mạng", "", "di-rung"),
    }).map(({ item }) => item.id),
    ["sameCategory"],
  )
})

test("role items do not stand in for ordinary items on a shared effect alone", () => {
  const mage = profile("+200 Công phép\n+500 Máu tối đa\nGiá băng: Tung chiêu làm chậm mục tiêu", "", "phep")

  assert.deepEqual(
    ranked(mage, {
      support: profile("+500 Máu tối đa\nMa nhãn: Tung chiêu làm chậm mục tiêu", "", "phu-tro"),
      tank: profile("+500 Máu tối đa\nLính gác: Tung chiêu làm chậm mục tiêu", "", "thu"),
    }).map(({ item }) => item.id),
    ["tank"],
  )
})

test("a passive most of the catalog carries does not make items alike", () => {
  const common = "Khiêm nhường: Nhận vàng khi đi cùng đồng đội"
  const others: Record<string, ReturnType<typeof profile>> = {}
  for (let index = 0; index < 13; index++) others[`filler${index}`] = profile(common)

  assert.deepEqual(ranked(profile(`+200 Giáp\n${common}`), others), [])
})

test("items of another tier are never alternatives, and ties go to the closest price", () => {
  const stats = "Tróc nã: Giảm hồi máu"
  const item = (id: string, tier: number, price: number) => ({ id, content: { tier, price } })
  const found = similarItems(
    item("self", 3, 2000),
    [item("far", 3, 2900), item("near", 3, 2100), item("lower", 2, 2000)],
    () => profile(stats),
  )

  assert.deepEqual(
    found.map((entry) => entry.item.id),
    ["near", "far"],
  )
})

test("active items are marked, and names may come last in angle brackets", () => {
  const { passives } = parseItemDescription(
    "Nhận 35% miễn thương trong 3 giây. <Bất khuất>– Kích hoạt duy nhất\nKích hoạt chủ động – Hồi huyết: Hồi máu cho đồng minh\nNội tại – Nguyên lực: Tăng giáp cho đồng đội",
  )

  assert.deepEqual(passives, [
    { name: "Bất khuất", text: "Nhận 35% miễn thương trong 3 giây.", unique: false, active: true },
    { name: "Hồi huyết", text: "Hồi máu cho đồng minh", unique: false, active: true },
    { name: "Nguyên lực", text: "Tăng giáp cho đồng đội", unique: false },
  ])
})

test("values read as gains, except a stat stored as a penalty", () => {
  assert.equal(formatItemStatValue({ value: 30, percent: true }), "+30%")
  assert.equal(formatItemStatValue({ value: -5, percent: false }), "-5")
})
