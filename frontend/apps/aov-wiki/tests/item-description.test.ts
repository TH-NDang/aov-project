import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatItemStatValue,
  itemEffectFacts,
  itemProfile,
  formatItemGrantAmount,
  itemEffectsFromDescription,
  itemFilterStats,
  itemGrantConditions,
  itemGrantScalings,
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

test("the editor turns description stats into the codes the backend stores", () => {
  assert.deepEqual(itemStatsFromDescription("+60 Công vật lý\n+30% Tốc đánh\n+12 Sức mạnh cổ\nGiáp băng: Nhận giáp"), [
    { key: "physical-attack", value: 60, unit: null },
    { key: "attack-speed", value: 30, unit: "%" },
  ])
})

const ROBE =
  "+120 Công phép\n+900 Máu tối đa\n\nNội tại duy nhất – Linh thể: Nhận 26–40 (+2% máu bản thân) công phép, tối đa không vượt quá 100 điểm.\n\nNội tại – Phá phép: Nhận 32–60 (+3% máu bản thân thêm) xuyên giáp phép, tối đa không vượt quá 150 điểm."
const PIERCE = {
  key: "pha-phep",
  activation: "PASSIVE" as const,
  unique: false,
  grants: [
    {
      stat: "magic-penetration",
      value: 32,
      maxValue: 60,
      growth: "LEVEL" as const,
      cap: 150,
      scalings: [{ source: "BONUS_HEALTH" as const, value: 3, unit: "%" }],
    },
  ],
}

test("an effect's granted stat is read apart from the fixed stats and answers the stat filters", () => {
  const reading = itemReaderContent(
    {
      stats: [
        { key: "magic-attack", value: 120, unit: null },
        { key: "max-health", value: 900, unit: null },
      ],
      effects: [{ key: "linh-the", activation: "PASSIVE", unique: true, grants: [] }, PIERCE],
    },
    { description: ROBE },
  )
  const [pierce] = reading.granted

  assert.deepEqual(
    reading.stats.map((stat) => stat.key),
    ["magicAttack", "maxHealth"],
  )
  assert.deepEqual(
    [pierce.key, pierce.effect, pierce.value, pierce.maxValue, pierce.cap],
    ["magicPierce", "Phá phép", 32, 60, 150],
  )
  assert.equal(itemMatchesStatFilters(reading.stats, ["pierce"]), false)
  assert.equal(itemMatchesStatFilters(itemFilterStats(reading), ["pierce"]), true)
})

test("a granted stat reads as the game writes it, with its scaling, growth and cap", () => {
  const [pierce] = itemReaderContent(
    { effects: [{ key: "linh-the", grants: [] }, PIERCE] },
    { description: ROBE },
  ).granted

  assert.equal(formatItemGrantAmount(pierce), "+32–60")
  assert.deepEqual(itemGrantScalings(pierce), ["+3% máu thêm"])
  assert.deepEqual(itemGrantConditions(pierce), ["tăng theo cấp", "tối đa 150"])
})

test("a translation that writes a different number of effects is matched by the effect's name", () => {
  const reading = itemReaderContent(
    { effects: [{ key: "linh-the", grants: [] }, PIERCE] },
    { description: "Nội tại – Phá phép: Nhận 32–60 xuyên giáp phép." },
  )

  assert.equal(reading.passives[0].gameplay?.key, "pha-phep")
  assert.equal(reading.granted.length, 1)
})

test("with structured gameplay a passive written as a stat stays an effect", () => {
  const description = "+240 Công phép\n\nNội tại duy nhất – Thuật sư: +35% Công phép"
  const effects = itemEffectsFromDescription(description)
  const reading = itemReaderContent(
    { stats: [{ key: "magic-attack", value: 240, unit: null }], effects },
    { description },
  )

  assert.deepEqual(effects, [
    {
      key: "thuat-su",
      activation: "PASSIVE",
      unique: true,
      cooldownSeconds: null,
      maxStacks: null,
      grants: [{ stat: "magic-attack", value: 35, unit: "%" }],
    },
  ])
  assert.deepEqual(
    reading.stats.map((stat) => stat.value),
    [240],
  )
  assert.deepEqual(
    reading.granted.map((grant) => [grant.label, grant.percent, grant.unique]),
    [["Công phép", true, true]],
  )
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

test("active items are marked, a unique active is unique, and names may come last in angle brackets", () => {
  const { passives } = parseItemDescription(
    "Nhận 35% miễn thương trong 3 giây. <Bất khuất>– Kích hoạt duy nhất\nKích hoạt chủ động – Hồi huyết: Hồi máu cho đồng minh\nNội tại – Nguyên lực: Tăng giáp cho đồng đội",
  )

  assert.deepEqual(passives, [
    { name: "Bất khuất", text: "Nhận 35% miễn thương trong 3 giây.", unique: true, active: true },
    { name: "Hồi huyết", text: "Hồi máu cho đồng minh", unique: false, active: true },
    { name: "Nguyên lực", text: "Tăng giáp cho đồng đội", unique: false },
  ])
})

test("an English description reads into the same stats and passives as the Vietnamese one", () => {
  const vietnamese = parseItemDescription(
    "+10% Giảm hồi chiêu\n+200 Giáp\n+800 Máu tối đa\n\nSức mạnh nguyên tố: Đòn đánh kế gây thêm sát thương – Nội tại duy nhất",
  )
  const english = parseItemDescription(
    "+10% Cooldown Speed\n+200 Armor\n+800 Max HP\n\nElemental Power: The next normal attack deals bonus damage – Unique Passive",
    "en-US",
  )

  const values = (content: typeof english) => content.stats.map((stat) => [stat.key, stat.value, stat.percent])
  assert.deepEqual(values(english), values(vietnamese))
  assert.deepEqual(
    english.stats.map((stat) => stat.label),
    ["Cooldown Speed", "Armor", "Max HP"],
  )
  assert.deepEqual(english.passives, [
    { name: "Elemental Power", text: "The next normal attack deals bonus damage", unique: true },
  ])
})

test("English markers for active effects and bare passive prefixes are read like the Vietnamese ones", () => {
  const { passives } = parseItemDescription(
    "Gain 35% damage reduction for 3 seconds. <Indomitable> – Unique Active\nActive Ability – Blood Recovery: Heals an ally\nPassive – Source Power: Grants armor to allies",
    "en-US",
  )

  assert.deepEqual(passives, [
    { name: "Indomitable", text: "Gain 35% damage reduction for 3 seconds.", unique: true, active: true },
    { name: "Blood Recovery", text: "Heals an ally", unique: false, active: true },
    { name: "Source Power", text: "Grants armor to allies", unique: false },
  ])
})

test("stat names follow the reader's language, whatever language the description is in", () => {
  const description = "+60 Công vật lý\n+12 Sức mạnh cổ"
  assert.deepEqual(
    parseItemDescription(description, "en-US").stats.map((stat) => stat.label),
    ["Attack Damage", "Sức mạnh cổ"],
  )
  assert.deepEqual(
    parseItemDescription(description).stats.map((stat) => stat.label),
    ["Công vật lý", "Sức mạnh cổ"],
  )
  assert.equal(
    itemReaderContent({ stats: [{ key: "armorPierce", value: 60, unit: "POINT" }] }, null, "en-US").stats[0]?.label,
    "Armor Pierce",
  )
})

test("values read as gains, except a stat stored as a penalty", () => {
  assert.equal(formatItemStatValue({ value: 30, percent: true }), "+30%")
  assert.equal(formatItemStatValue({ value: -5, percent: false }), "-5")
})

test("an effect's cooldown is read whether it leads or follows the number", () => {
  assert.equal(itemEffectFacts("Trở thành bất khả xâm phạm. Hồi chiêu: 75 giây.").cooldownSeconds, "75")
  assert.equal(itemEffectFacts("Sống lại sau 2 giây; 150 giây hồi chiêu.").cooldownSeconds, "150")
  assert.equal(itemEffectFacts("kéo dài 5 giây (hồi chiêu 0.3 giây)").cooldownSeconds, "0.3")
  assert.equal(itemEffectFacts("Becomes untargetable. Cooldown: 75 seconds.").cooldownSeconds, "75")
})

test("an effect's stacks are read and a plain duration is not taken for a cooldown", () => {
  const facts = itemEffectFacts("Gây sát thương sẽ trừ 6% Giáp, cộng dồn lên đến 4 lần, kéo dài 5 giây")
  assert.deepEqual(facts, { cooldownSeconds: null, maxStacks: 4 })
  assert.equal(itemEffectFacts("Stacks up to 3 times.").maxStacks, 3)
})
