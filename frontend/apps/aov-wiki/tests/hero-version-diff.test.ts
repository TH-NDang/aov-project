import assert from "node:assert/strict"
import test from "node:test"
import {
  diffWords,
  heroDifferences,
  localizedStatText,
  previousPatch,
  skillDifference,
  statText,
  stripSkillMarkup,
} from "../src/features/hero/hero-version-diff.ts"

const skill = (description: string, row?: string, cooldown?: string) => ({
  skillKey: "skill-0-1",
  kind: "PASSIVE" as const,
  displayOrder: 0,
  description,
  effects: [
    {
      effectType: "SOURCE_SNAPSHOT",
      metadata: {
        cooldown: cooldown ? { display: cooldown } : undefined,
        levelTable: row
          ? { column_labels: ["Thông tin"], rows: [{ label: "Sát thương", display_values: [row] }] }
          : undefined,
      },
    },
  ],
})

test("a word diff keeps shared text and marks only what changed", () => {
  assert.deepEqual(diffWords("gây 340–508 sát thương", "gây 450 sát thương"), [
    { kind: "same", text: "gây " },
    { kind: "del", text: "340–508" },
    { kind: "ins", text: "450" },
    { kind: "same", text: " sát thương" },
  ])
})

test("color markup never counts as a gameplay difference", () => {
  assert.equal(stripSkillMarkup("gây <color=#FD8841>(+100%)</color> sát thương"), "gây (+100%) sát thương")
  assert.equal(skillDifference(skill("gây <color=#111111>100</color>"), skill("gây <color=#222222>100</color>")), null)
})

test("color and spacing in cooldowns, table cells and text are not changes", () => {
  assert.equal(
    skillDifference(
      skill("gây 100 sát thương", "395", "<color=#FF8941>H.chiêu: 11s</color>"),
      skill("gây  100\nsát thương", "  395", "<color=#D07649>H.chiêu: 11s</color>"),
    ),
    null,
  )
})

test("a changed cooldown is shown without its markup", () => {
  const difference = skillDifference(
    skill("x", undefined, "<color=#FF8941>H.chiêu: 11s</color>"),
    skill("x", undefined, "<color=#D07649>H.chiêu: 9s</color>"),
  )
  assert.deepEqual(difference?.cooldown, { before: "H.chiêu: 11s", after: "H.chiêu: 9s" })
})

test("a number joined to a word is marked alone", () => {
  assert.deepEqual(diffWords("(+80%Công phép)", "(+90%Công phép)"), [
    { kind: "same", text: "(+" },
    { kind: "del", text: "80%" },
    { kind: "ins", text: "90%" },
    { kind: "same", text: "Công phép)" },
  ])
})

test("edits a space or bracket apart read as one, longer shared text keeps them separate", () => {
  assert.deepEqual(diffWords("500 (+60 mỗi cấp", "450 (+90 mỗi cấp"), [
    { kind: "del", text: "500 (+60" },
    { kind: "ins", text: "450 (+90" },
    { kind: "same", text: " mỗi cấp" },
  ])
  assert.deepEqual(diffWords("hồi 11 giây, giảm 0.6", "hồi 12.5 giây, giảm 0.5"), [
    { kind: "same", text: "hồi " },
    { kind: "del", text: "11" },
    { kind: "ins", text: "12.5" },
    { kind: "same", text: " giây, giảm " },
    { kind: "del", text: "0.6" },
    { kind: "ins", text: "0.5" },
  ])
})

test("the Wukong passive shows its description and table change", () => {
  const difference = skillDifference(
    skill("gây 340–508 (tăng theo cấp tướng) sát thương", "340–508 + 1.0 công vật lý"),
    skill("gây 450 sát thương", "450 + 1.0 công vật lý"),
  )
  assert.ok(difference?.description?.some((part) => part.kind === "del" && part.text.includes("340–508")))
  assert.ok(difference?.description?.some((part) => part.kind === "ins" && part.text.includes("450")))
  assert.deepEqual(difference?.rows.get("Sát thương"), {
    before: ["340–508 + 1.0 công vật lý"],
    after: ["450 + 1.0 công vật lý"],
  })
})

test("skills and stats that did not change are left out, and images are ignored", () => {
  const content = (health: number, art: string) => ({
    skills: { skills: [skill("giống nhau", "1")] },
    combatStats: { values: [{ statKey: "HP", baseValue: health }] },
    skins: { skins: [{ artAssetId: art }] },
  })
  const same = heroDifferences({ content: content(100, "a") }, { content: content(100, "b") })
  assert.equal(same.skills.size, 0)
  assert.equal(same.stats.size, 0)
  const stats = heroDifferences({ content: content(100, "a") }, { content: content(120, "a") })
  assert.deepEqual(stats.stats.get("HP"), { before: "100", after: "120" })
})

test("a skill missing from the earlier version is new", () => {
  assert.equal(skillDifference(undefined, skill("mới"))?.isNew, true)
})

test("the previous version follows season and patch order inside one ruleset", () => {
  const seasons = [
    { id: "s3", ordinal: 3 },
    { id: "s4", ordinal: 4 },
  ]
  const patch = (id: string, seasonId: string, ordinal: number, rulesetId = "aov") => ({
    id,
    seasonId,
    ordinal,
    rulesetId,
  })
  const patches = [patch("p3", "s4", 3), patch("p1", "s3", 1), patch("p2", "s4", 1), patch("other", "s4", 2, "arena")]
  assert.equal(previousPatch(patches, seasons, patches[0])?.id, "p2")
  assert.equal(previousPatch(patches, seasons, patches[2])?.id, "p1")
  assert.equal(previousPatch(patches, seasons, patches[1]), undefined)
  assert.equal(previousPatch(patches, seasons, undefined), undefined)
})

test("a stat with a percent reads the way the game shows it", () => {
  assert.equal(statText({ baseValue: 150, percentValue: 20 }), "150 | 20%")
  assert.equal(statText({ baseValue: 80, percentValue: 0 }), "80 | 0%")
  assert.equal(statText({ baseValue: 145, percentValue: null }), "145")
  assert.equal(statText({ baseValue: 3720 }), "3720")
  assert.equal(localizedStatText("150 | 20%", "vi-VN"), "150 | 20%")
  assert.equal(localizedStatText("12.5 | 7.5%", "vi-VN"), "12,5 | 7,5%")
  assert.equal(localizedStatText("3720", "vi-VN"), "3.720")
})

test("a percent change is a difference, but a percent recorded for the first time is not", () => {
  const armor = (baseValue: number, percentValue?: number | null) => ({
    content: { combatStats: { values: [{ statKey: "ARMOR", baseValue, percentValue }] } },
  })
  assert.deepEqual(heroDifferences(armor(150, 20), armor(150, 0)).stats.get("ARMOR"), {
    before: "150 | 20%",
    after: "150 | 0%",
  })
  assert.deepEqual(heroDifferences(armor(145), armor(150, 20)).stats.get("ARMOR"), {
    before: "145",
    after: "150 | 20%",
  })
  assert.equal(heroDifferences(armor(150), armor(150, 20)).stats.size, 0)
  assert.equal(heroDifferences(armor(150, 20), armor(150, 20)).stats.size, 0)
})
