import assert from "node:assert/strict"
import { test } from "node:test"
import type { SkillImage } from "../src/features/publishing/skill-artwork"
import type { Skill } from "../src/features/publishing/types"

const skill = (skillKey: string, displayOrder: number, extra: Partial<Skill> = {}): Skill => ({
  skillKey,
  kind: skillKey.startsWith("skill-0") ? "PASSIVE" : "ACTIVE",
  formKey: null,
  displayOrder,
  iconAssetId: null,
  translations: [{ locale: "vi-VN", name: `Tên ${skillKey}`, description: `Mô tả ${skillKey}` }],
  effects: [],
  ...extra,
})
const image = (sourceSlot: number, variantNo: number, extra: Partial<SkillImage> = {}): SkillImage => ({
  id: `image-${sourceSlot}-${variantNo}`,
  heroId: "billow",
  skillKey: null,
  sourceSlot,
  variantNo,
  assetId: `asset-${sourceSlot}-${variantNo}`,
  sourceFilename: `billow-${sourceSlot}-${variantNo}.png`,
  label: null,
  version: 0,
  ...extra,
})

test("a new variant joins its slot right after the others, with the slot's next number and library picture", async () => {
  const { addSkillVariant } = await import("../src/features/publishing/skill-variants")
  const skills = [skill("skill-0-1", 0), skill("skill-1-1", 1), skill("skill-2-1", 2), skill("skill-3-1", 3)]
  const library = [image(1, 2), image(2, 2)]

  const empty = addSkillVariant(skills, skills[1], { locale: "vi-VN", library })!
  assert.equal(empty.added.skillKey, "skill-1-2")
  assert.equal(empty.added.displayOrder, 2, "It sits right after the first skill of its slot")
  assert.equal(empty.added.iconAssetId, "asset-1-2", "The library picture of the same slot and variant comes along")
  assert.deepEqual(empty.added.translations, [{ locale: "vi-VN", name: "", description: "" }])
  assert.deepEqual(
    empty.skills.map((row) => [row.skillKey, row.displayOrder]),
    [
      ["skill-0-1", 0],
      ["skill-1-1", 1],
      ["skill-2-1", 3],
      ["skill-3-1", 4],
      ["skill-1-2", 2],
    ],
    "Later skills move down one place and display orders stay unique",
  )
  assert.equal(skills[2].displayOrder, 2, "The input list is never changed")

  const copied = addSkillVariant(empty.skills, empty.skills[1], { locale: "vi-VN", copy: true, library })!
  assert.equal(copied.added.skillKey, "skill-1-3")
  assert.deepEqual(copied.added.translations, skills[1].translations, "A copy starts from the chosen variant's text")
  assert.notEqual(copied.added.translations, skills[1].translations)
  assert.equal(copied.added.iconAssetId, null, "No library picture is guessed for a variant number it lacks")

  const fromPicture = addSkillVariant(skills, skills[1], { locale: "vi-VN", image: image(2, 2), library })!
  assert.equal(fromPicture.added.skillKey, "skill-2-2", "A picture creates a variant of its own slot and number")
  assert.equal(fromPicture.added.iconAssetId, "asset-2-2")
  assert.deepEqual(fromPicture.added.translations[0], { locale: "vi-VN", name: "", description: "" })

  const unknown = skill("custom-move", 9)
  assert.equal(
    addSkillVariant([unknown], unknown, { locale: "vi-VN" }),
    null,
    "A skill of no known slot has no variant",
  )
})

test("unused pictures leave out every picture a skill shows, its states included", async () => {
  const { unusedSkillImages } = await import("../src/features/publishing/skill-variants")
  const library = [image(1, 1), image(1, 2), image(2, 1), image(2, 2), image(3, 2)]
  const skills = [
    // Borrows its library picture: no icon of its own, an unambiguous slot and variant.
    skill("skill-1-1", 0),
    skill("skill-2-1", 1, {
      iconAssetId: "asset-2-1",
      stateIcons: [{ assetId: "asset-2-2", label: "Hải quái" }],
    }),
  ]
  assert.deepEqual(
    unusedSkillImages(skills, library).map((row) => row.id),
    ["image-1-2", "image-3-2"],
  )
})

test("state names come from the hero's other states first, then from the terms the description marks", async () => {
  const { stateLabelHints, knownStateLabels } = await import("../src/features/publishing/skill-state-icons")
  const tide = skill("skill-1-1", 0, {
    translations: [
      {
        locale: "vi-VN",
        name: "Độn thủy tiềm hành",
        description: "Khi ở trạng thái <Hải quái> và dùng <Độn thủy tiềm hành>, Billow lao lên.",
      },
    ],
  })
  assert.deepEqual(stateLabelHints(tide, []), ["Hải quái"], "The skill's own name is never offered as a state")
  const others = [skill("skill-2-1", 1, { stateIcons: [{ assetId: "a", label: "Bão tố" }] })]
  assert.deepEqual(stateLabelHints(tide, knownStateLabels(others)), ["Bão tố", "Hải quái"])
})

test("style tags in a description are never offered as state names", async () => {
  const { stateLabelHints } = await import("../src/features/publishing/skill-state-icons")
  const tide = skill("skill-1-1", 0, {
    translations: [
      {
        locale: "vi-VN",
        name: "Độn thủy",
        description: "<color=#5AADC9>Nhanh</color> <b>đậm</b><br> trạng thái <Hải quái> và <Bão Tố>",
      },
    ],
  })
  assert.deepEqual(stateLabelHints(tide, []), ["Hải quái", "Bão Tố"])
})
