import assert from "node:assert/strict"
import { test } from "node:test"
import { groupSkins } from "../src/lib/skin-groups.ts"
import type { SkinEntry } from "../src/lib/skin-api.ts"

function skin(heroCode: string, name: string, rarityCode?: string): SkinEntry {
  return { heroId: heroCode, heroCode, heroName: heroCode, skinKey: name, name, rarityCode, actualLocale: "vi-VN" }
}

test("a hero appears once even when its skins arrive on different pages; explicit ranks precede themes", () => {
  const skins = [
    skin("Yena", "SS", "ss-vn-1"),
    skin("Airi", "Classic"),
    skin("Yena", "Z", "sss-plus-huu-han-vn-1"),
    skin("Yena", "AIC", "aic-2020-vn-1"),
    skin("Yena", "Season", "s18-thuong-hang-vn-1"),
    skin("Yena", "Limited", "bac-s-plus-mau-01"),
  ]
  const rows = groupSkins(skins, "most", "tier", "vi-VN")
  assert.deepEqual(
    rows.map((row) => row[0].heroCode),
    ["Yena", "Airi"],
  )
  assert.deepEqual(
    rows[0].map((entry) => entry.name),
    ["Z", "SS", "Limited", "AIC", "Season"],
  )
  assert.equal(skins[0].name, "SS")
})

test("hero and skin sorts are independent; filtered counts and ties use the displayed rows", () => {
  const skins = [skin("Yena", "B", "sss-vn-1"), skin("Yena", "A", "a-vn-1"), skin("Aya", "C"), skin("Airi", "D")]
  const fewest = groupSkins(skins, "fewest", "name", "vi-VN")
  assert.deepEqual(
    fewest.map((row) => row[0].heroCode),
    ["Airi", "Aya", "Yena"],
  )
  assert.deepEqual(
    fewest[2].map((entry) => entry.name),
    ["A", "B"],
  )
  assert.deepEqual(
    groupSkins(skins, "name", "tier", "vi-VN")[2].map((entry) => entry.name),
    ["B", "A"],
  )
  assert.deepEqual(
    groupSkins(skins.slice(1), "most", "tier", "vi-VN").map((row) => row[0].heroCode),
    ["Airi", "Aya", "Yena"],
  )
})
