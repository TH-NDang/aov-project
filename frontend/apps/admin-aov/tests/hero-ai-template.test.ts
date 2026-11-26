import assert from "node:assert/strict"
import { test } from "node:test"
import {
  HERO_AI_FORMAT,
  applyHeroAiAnswer,
  heroAiData,
  heroAiGuide,
  heroAiPrompt,
  parseHeroAiAnswer,
  type HeroAiAnswer,
} from "../src/features/publishing/model/ai-template/hero-ai-template"
import { fixtureContent } from "./fixtures/hero-workspace-data"

const answer = (fields: Partial<HeroAiAnswer>): HeroAiAnswer => ({ format: HERO_AI_FORMAT, locale: "vi-VN", ...fields })

test("the template shows saved values in the chosen language and ratings on the scale the page shows", () => {
  const data = heroAiData(fixtureContent, "vi-VN", "airi")

  assert.equal(data.format, HERO_AI_FORMAT)
  assert.equal(data.code, "airi")
  assert.equal(data.profile.title, "Ninja rồng")
  assert.equal(data.ratings.attackDamage, 3.5)
  assert.deepEqual(data.combatStats.HP, { value: 3300 })
  assert.deepEqual(data.combatStats.ARMOR, { value: 100, percent: null })
  assert.equal(data.skills[0]?.skillKey, "passive")
  assert.equal(data.skins[0]?.name, "Mặc định")
})

test("a hero without skills gets the passive and three abilities to fill in", () => {
  const data = heroAiData({ ...fixtureContent, SKILLS: null }, "vi-VN", null)

  assert.deepEqual(
    data.skills.map((skill) => [skill.skillKey, skill.kind]),
    [
      ["skill-0-1", "PASSIVE"],
      ["skill-1-1", "ACTIVE"],
      ["skill-2-1", "ACTIVE"],
      ["skill-3-1", "ACTIVE"],
    ],
  )
})

test("the guide marks what the hero lacks in the chosen language", () => {
  const english = heroAiGuide(fixtureContent, "en-US").flatMap((group) => group.fields)
  const vietnamese = heroAiGuide(fixtureContent, "vi-VN").flatMap((group) => group.fields)

  assert.equal(english.find((field) => field.path === "profile.name")?.filled, false)
  assert.equal(vietnamese.find((field) => field.path === "profile.name")?.filled, true)
})

test("the prompt carries the rules, the field meanings and the JSON to fill in", () => {
  const data = heroAiData(fixtureContent, "vi-VN", "airi")
  const prompt = heroAiPrompt("Airi", data, heroAiGuide(fixtureContent, "vi-VN"))

  assert.match(prompt, /để null/)
  assert.match(prompt, /profile\.roles \(Vai trò/)
  assert.ok(prompt.includes(JSON.stringify(data, null, 2)))
})

test("an answer is read out of a code block with words around it", () => {
  const text = `Đây là kết quả:\n\`\`\`json\n${JSON.stringify({ format: HERO_AI_FORMAT, locale: "vi-VN", ratings: { difficulty: "4" } })}\n\`\`\`\nChúc vui!`

  const parsed = parseHeroAiAnswer(text)

  assert.ok(parsed.ok)
  assert.equal(parsed.answer.ratings?.difficulty, 4)
})

test("an answer with an unknown role is refused with the place of the mistake", () => {
  const parsed = parseHeroAiAnswer(
    JSON.stringify({ format: HERO_AI_FORMAT, locale: "vi-VN", profile: { roles: ["HEALER"] } }),
  )

  assert.equal(parsed.ok, false)
  assert.match(parsed.ok ? "" : parsed.message, /^profile\.roles\.0/)
})

test("an answer that is not the template is refused", () => {
  const parsed = parseHeroAiAnswer(JSON.stringify({ name: "Airi" }))

  assert.equal(parsed.ok, false)
  assert.match(parsed.ok ? "" : parsed.message, /aov-hero\/1/)
})

test("fields the answer leaves empty keep what is saved", () => {
  const result = applyHeroAiAnswer(
    fixtureContent,
    answer({ profile: { name: null, title: "", summary: null, lore: null, roles: [], positions: null } }),
  )

  assert.deepEqual(result.changes, [])
  assert.deepEqual(result.content, fixtureContent)
})

test("written values change the content and are listed old to new", () => {
  const result = applyHeroAiAnswer(
    fixtureContent,
    answer({
      profile: { title: "Ninja Rồng Lửa" },
      ratings: { difficulty: 2.5 },
      combatStats: { HP: 3543, ARMOR: { value: 137, percent: 12 } },
    }),
  )

  assert.equal(result.content.PROFILE?.translations[0]?.title, "Ninja Rồng Lửa")
  assert.equal(result.content.OVERVIEW_RATINGS?.difficulty, 5)
  assert.equal(result.content.OVERVIEW_RATINGS?.derived, false)
  assert.equal(result.content.COMBAT_STATS?.values.find((row) => row.statKey === "HP")?.baseValue, 3543)
  assert.equal(result.content.COMBAT_STATS?.values.find((row) => row.statKey === "ARMOR")?.percentValue, 12)
  assert.deepEqual(
    result.changes.map((change) => [change.label, change.before, change.after]),
    [
      ["Danh hiệu", "Ninja rồng", "Ninja Rồng Lửa"],
      ["Độ khó", "4/5", "2.5/5"],
      ["Máu", "3300", "3543"],
      ["Giáp", "100", "137 | 12%"],
    ],
  )
})

test("a rating outside the scale is skipped with a warning", () => {
  const result = applyHeroAiAnswer(fixtureContent, answer({ ratings: { difficulty: 9 } }))

  assert.equal(result.content.OVERVIEW_RATINGS?.difficulty, fixtureContent.OVERVIEW_RATINGS?.difficulty)
  assert.match(result.warnings[0] ?? "", /Độ khó = 9/)
})

test("an English answer adds English text beside the Vietnamese", () => {
  const result = applyHeroAiAnswer(
    fixtureContent,
    answer({
      locale: "en-US",
      profile: { name: "Airi", title: "Kunoichi" },
      skills: [{ skillKey: "passive", name: "Sharp", description: "Deals damage." }],
    }),
  )

  const profile = result.content.PROFILE!.translations
  assert.deepEqual(
    profile.map((text) => [text.locale, text.title]),
    [
      ["vi-VN", "Ninja rồng"],
      ["en-US", "Kunoichi"],
    ],
  )
  assert.deepEqual(
    result.content.SKILLS!.skills[0]!.translations.map((text) => text.locale),
    ["vi-VN", "en-US"],
  )
})

test("new skills and skins get keys of their own and keep pictures empty", () => {
  const result = applyHeroAiAnswer(
    fixtureContent,
    answer({
      skills: [{ skillKey: null, kind: "ACTIVE", name: "Phi tiêu", description: "Ném phi tiêu." }],
      skins: [{ skinKey: null, name: "Ninja Xanh Lá", acquisitionNote: "Quà sự kiện" }],
    }),
  )

  const skill = result.content.SKILLS!.skills.at(-1)!
  const skin = result.content.SKINS!.skins.at(-1)!
  assert.equal(skill.skillKey, "skill-1-1")
  assert.deepEqual(skill.effects, [])
  assert.equal(skin.skinKey, "ninja-xanh-la-1")
  assert.equal(skin.artAssetId, null)
  assert.equal(skin.translations[0]?.acquisitionNote, "Quà sự kiện")
})

test("a skin named like a saved one updates it instead of adding a copy", () => {
  const result = applyHeroAiAnswer(
    fixtureContent,
    answer({ skins: [{ skinKey: null, name: "Mặc định", description: "Trang phục gốc." }] }),
  )

  assert.equal(result.content.SKINS!.skins.length, fixtureContent.SKINS!.skins.length)
  assert.equal(result.content.SKINS!.skins[0]?.translations[0]?.description, "Trang phục gốc.")
})
