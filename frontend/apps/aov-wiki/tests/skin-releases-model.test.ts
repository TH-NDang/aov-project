import assert from "node:assert/strict"
import { test } from "node:test"
import { skinsNewIn } from "../src/features/skins/skin-releases-model.ts"

const skin = (skinKey: string, unscopedBaseline = false) => ({ skinKey, unscopedBaseline })

test("a skin in this version's collection but not in the one before is new", () => {
  assert.deepEqual(
    skinsNewIn([skin("a"), skin("b"), skin("c")], [skin("a"), skin("b")]).map((entry) => entry.skinKey),
    ["c"],
  )
})

test("nothing is new when the version before has no recorded skins", () => {
  assert.deepEqual(skinsNewIn([skin("a")], []), [])
  assert.deepEqual(skinsNewIn([skin("a")], undefined), [])
})

test("a skin from the undated baseline is never called new", () => {
  assert.deepEqual(skinsNewIn([skin("a"), skin("b", true)], [skin("a")]), [])
})
