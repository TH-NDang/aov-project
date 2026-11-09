import assert from "node:assert/strict"
import { test } from "node:test"
import type { Skin } from "../src/features/publishing/types"

const skin = (skinKey: string, name: string, displayOrder = 0): Skin => ({
  skinKey,
  displayOrder,
  artAssetId: null,
  rarityCode: null,
  translations: [{ locale: "vi-VN", name, description: null, acquisitionNote: null }],
})

test("a skin key is made from the hero part of the other keys and the Vietnamese name", async () => {
  const { nextSkinKey, skinKeyPrefix, skinSlug } = await import("../src/features/publishing/hero-skins-editor")
  assert.equal(skinSlug("Tân thủy thủ"), "tan-thuy-thu")
  assert.equal(skinSlug("Chiến Binh Hải Tộc"), "chien-binh-hai-toc")
  assert.equal(skinSlug("Đồ  Ách!"), "do-ach")

  const skins = [skin("bolt-baron-mac-dinh-1", "Mặc định"), skin("bolt-baron-tan-thuy-thu-1", "Tân thủy thủ", 1)]
  assert.equal(skinKeyPrefix(skins), "bolt-baron", "A hero code with a hyphen is read whole")
  assert.equal(nextSkinKey(skins, "Giao long"), "bolt-baron-giao-long-1")
  assert.equal(
    nextSkinKey(skins, "Tân thủy thủ"),
    "bolt-baron-tan-thuy-thu-2",
    "A name used twice takes the next number",
  )
  assert.equal(
    nextSkinKey(skins, "Tân thủy thủ", "bolt-baron-tan-thuy-thu-1"),
    "bolt-baron-tan-thuy-thu-1",
    "A skin keeps its own key while its name stays the same",
  )
  assert.equal(nextSkinKey([], "Giao long"), "giao-long-1", "Without other keys there is no hero part to reuse")
  assert.equal(nextSkinKey(skins, ""), "bolt-baron-trang-phuc-1", "An unnamed skin still has a valid key")
})

test("a cost line reads as label and value and is written back in the game's colour", async () => {
  const { parseCostText, composeCostText, costSeconds, costNumber } =
    await import("../src/features/publishing/skill-cost-fields")
  assert.deepEqual(parseCostText("<color=#FF8941>H.chiêu: 10s</color>"), {
    label: "H.chiêu",
    value: "10s",
    color: "#FF8941",
  })
  assert.deepEqual(parseCostText("<color=#62A2CC>Hao máu: 10% máu hiện tại</color>"), {
    label: "Hao máu",
    value: "10% máu hiện tại",
    color: "#62A2CC",
  })
  assert.deepEqual(parseCostText(""), { label: "", value: "", color: null })
  assert.equal(parseCostText("<color=#FF8941>H.chiêu: <b>10s</b></color>"), null, "Nested markup stays as written")

  assert.equal(
    composeCostText({ label: "N.lượng", value: "40", color: null }, "#74D4FA"),
    "<color=#74D4FA>N.lượng: 40</color>",
    "A new line takes the colour of its kind",
  )
  assert.equal(
    composeCostText({ label: "H.chiêu", value: "8s", color: "#FA8741" }, "#FF8941"),
    "<color=#FA8741>H.chiêu: 8s</color>",
    "A colour already there is kept",
  )
  assert.equal(composeCostText({ label: "H.chiêu", value: "  ", color: null }, "#FF8941"), "")
  assert.equal(costSeconds("12,5 giây"), 12.5)
  assert.equal(costSeconds("12/11/10s"), null)
  assert.equal(costNumber("40"), 40)
  assert.equal(costNumber("10% máu"), null)
})

test("the label and colour of a cost line are shared by every skill, each keeping its own value", async () => {
  const { applyCostStyle, sharedCostStyle } = await import("../src/features/publishing/skill-cost-fields")
  const withCooldown = (skillKey: string, display: string | null) => ({
    skillKey,
    kind: "ACTIVE" as const,
    formKey: null,
    displayOrder: 0,
    iconAssetId: null,
    translations: [],
    effects: [
      { effectType: "SOURCE_SNAPSHOT", metadata: display === null ? {} : { cooldown: { display, seconds: 5 } } },
    ],
  })
  const skills = [
    withCooldown("skill-0-1", null),
    withCooldown("skill-1-1", "<color=#FF8941>H.chiêu: 10s</color>"),
    withCooldown("skill-2-1", "<color=#FA8741>H.chiêu: 6s</color>"),
  ]
  assert.deepEqual(sharedCostStyle(skills, "cooldown"), { label: "H.chiêu", color: "#FF8941" })
  assert.equal(sharedCostStyle(skills, "energyCost"), undefined)

  const next = applyCostStyle(skills, "cooldown", { label: "Hồi chiêu", color: "#E0A030" })
  const cooldown = (index: number) => next[index]!.effects[0]!.metadata.cooldown as Record<string, unknown> | undefined
  assert.equal(cooldown(0), undefined, "A skill without the line gets none")
  assert.equal(cooldown(1)!.display, "<color=#E0A030>Hồi chiêu: 10s</color>")
  assert.equal(cooldown(2)!.display, "<color=#E0A030>Hồi chiêu: 6s</color>", "Each skill keeps its own value")
  assert.equal(cooldown(2)!.seconds, 5, "Other details of the line stay")
  assert.equal(cooldown(2)!.label, "Hồi chiêu")
})
