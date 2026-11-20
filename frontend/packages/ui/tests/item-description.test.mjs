import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatItemStatValue,
  itemProfile,
  itemReaderContent,
  parseItemDescription,
} from "../src/lib/item-description.ts"

const HOUSE_FORMAT = [
  "+90 Giáp phép",
  "",
  "Nội tại duy nhất – Gia tốc: +60 Tốc chạy",
  "",
  "Nội tại duy nhất: +35% Kháng hiệu ứng (giảm thời gian bị khống chế)",
  "",
  "Nội tại – Nguyên lực: Tăng 32–60 song giáp cho đồng đội lân cận.",
  "",
  "Kích hoạt – Hồi huyết: Hồi máu cho đồng minh. Hồi chiêu: 50 giây.",
  "",
  "Kích hoạt duy nhất – Bất khuất: Nhận 35% miễn thương trong 3 giây. Hồi chiêu: 90 giây.",
  "",
  "(Lời dẫn của trang bị.)",
].join("\n")

test("the house format puts the label first and reads into stats, passives and actives", () => {
  const parsed = parseItemDescription(HOUSE_FORMAT)

  assert.deepEqual(
    parsed.stats.map((stat) => [stat.key, stat.value, stat.percent, stat.unique, stat.note]),
    [
      ["magicDefense", 90, false, false, null],
      ["movementSpeed", 60, false, true, "Gia tốc"],
      ["tenacity", 35, true, true, "giảm thời gian bị khống chế"],
    ],
  )
  assert.deepEqual(parsed.passives, [
    { name: "Nguyên lực", text: "Tăng 32–60 song giáp cho đồng đội lân cận.", unique: false },
    { name: "Hồi huyết", text: "Hồi máu cho đồng minh. Hồi chiêu: 50 giây.", unique: false, active: true },
    {
      name: "Bất khuất",
      text: "Nhận 35% miễn thương trong 3 giây. Hồi chiêu: 90 giây.",
      unique: true,
      active: true,
    },
  ])
  assert.deepEqual(parsed.notes, ["Lời dẫn của trang bị."])
})

test("a stat granted by a passive reads the same wherever the label stands", () => {
  const labelFirst = parseItemDescription("Nội tại duy nhất – Phá giáp: +60 Xuyên giáp")
  const statFirst = parseItemDescription("+60 Xuyên giáp – Phá giáp – Nội tại duy nhất")
  const labelLast = parseItemDescription("Phá giáp: +60 Xuyên giáp – Nội tại duy nhất")

  for (const reading of [labelFirst, statFirst, labelLast]) {
    assert.deepEqual(reading.passives, [])
    assert.deepEqual(
      reading.stats.map((stat) => [stat.key, stat.value, stat.unique, stat.note]),
      [["armorPierce", 60, true, "Phá giáp"]],
    )
  }
})

test("a passive that does more than grant a stat stays a passive", () => {
  const { stats, passives } = parseItemDescription(
    "Nội tại duy nhất – Bảo hộ: +25% kháng hiệu ứng, tăng 30% tốc chạy trong 5 giây.\nNội tại – Cổ ngữ: +12 Sức mạnh cổ",
  )

  assert.deepEqual(stats, [])
  assert.deepEqual(
    passives.map((passive) => passive.name),
    ["Bảo hộ", "Cổ ngữ"],
  )
})

test("a bare active label names the effect after it, with a dash or a hyphen", () => {
  const { passives } = parseItemDescription(
    "Kích hoạt - Vô hình: Lập tức tàng hình.\nKích hoạt – Phản pháo: Phản sát thương.\nThần khiên: Tạo lá chắn. Hồi chiêu 60 giây – Kích hoạt chủ động",
  )

  assert.deepEqual(passives, [
    { name: "Vô hình", text: "Lập tức tàng hình.", unique: false, active: true },
    { name: "Phản pháo", text: "Phản sát thương.", unique: false, active: true },
    { name: "Thần khiên", text: "Tạo lá chắn. Hồi chiêu 60 giây", unique: false, active: true },
  ])
})

test("the words for activating inside a sentence do not make a passive an active", () => {
  const [passive] = parseItemDescription(
    'Nội tại – Hậu cần: Khi đủ 600 vàng sẽ mở khóa chiêu "Cộng hưởng", kích hoạt chủ động giúp đồng minh nhận vàng.',
  ).passives

  assert.deepEqual(passive, {
    name: "Hậu cần",
    text: 'Khi đủ 600 vàng sẽ mở khóa chiêu "Cộng hưởng", kích hoạt chủ động giúp đồng minh nhận vàng.',
    unique: false,
  })
})

test("a heal written as a total over time is still read as healing", () => {
  // The published wording and the house wording that puts the duration after the heal.
  for (const description of [
    "Nội tại duy nhất – Huyết yến: Khi máu bản thân dưới 30%, trong 5 giây sẽ hồi tổng cộng 400–610 máu.",
    "Nội tại duy nhất – Huyết yến: Khi máu bản thân dưới 30%, hồi tổng cộng 400–610 máu trong 5 giây.",
  ]) {
    const profile = itemProfile(itemReaderContent({}, { description }))

    assert.deepEqual(profile.effects, ["heal"], description)
  }
})

test("an English unique passive that only grants a stat reads as a stat named in English", () => {
  const reading = parseItemDescription("Unique Passive – Pierce: +20% Armor Pierce", "en-US")

  assert.deepEqual(reading.passives, [])
  assert.deepEqual(
    reading.stats.map((stat) => [stat.key, stat.label, stat.value, stat.percent, stat.unique, stat.note]),
    [["armorPierce", "Armor Pierce", 20, true, true, "Pierce"]],
  )
})

test("English active labels make an active wherever the label stands", () => {
  const { passives } = parseItemDescription(
    [
      "Gain 35% damage reduction for 3 seconds. <Indomitable> – Unique Active",
      "Active Ability – Blood Recovery: Heals an ally",
      "Active – Vanish: Instantly enter stealth.",
      "Divine Shield: Gain a shield. Cooldown: 60 seconds – Active Ability",
    ].join("\n"),
    "en-US",
  )

  assert.deepEqual(passives, [
    { name: "Indomitable", text: "Gain 35% damage reduction for 3 seconds.", unique: true, active: true },
    { name: "Blood Recovery", text: "Heals an ally", unique: false, active: true },
    { name: "Vanish", text: "Instantly enter stealth.", unique: false, active: true },
    { name: "Divine Shield", text: "Gain a shield. Cooldown: 60 seconds", unique: false, active: true },
  ])
})

test("English words for an active ability inside a sentence keep a passive passive", () => {
  const [passive] = parseItemDescription(
    "Passive – Echo: Using an active ability grants 10% Movement Speed for 2 seconds.",
    "en-US",
  ).passives

  assert.deepEqual(passive, {
    name: "Echo",
    text: "Using an active ability grants 10% Movement Speed for 2 seconds.",
    unique: false,
  })
})

test("an English heal over time is healing and a healing cut is not", () => {
  const heal = itemProfile(
    itemReaderContent({}, { description: "Unique Passive – Lifeline: Restores 400 HP over 5 seconds." }, "en-US"),
  )
  const cut = itemProfile(
    itemReaderContent({}, { description: "Unique Passive – Rend: Reduces the target's healing by 40%." }, "en-US"),
  )

  assert.ok(heal.effects.includes("heal"))
  assert.deepEqual(cut.effects, ["anti-heal"])
})

test("an item stat keeps the game's decimal dot and no thousands separator", () => {
  assert.equal(formatItemStatValue({ value: 1200, percent: false }), "+1200")
  assert.equal(formatItemStatValue({ value: 0.5, percent: true }), "+0.5%")
})
