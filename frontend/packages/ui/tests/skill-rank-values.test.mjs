import assert from "node:assert/strict"
import test from "node:test"

import { rankValues } from "../src/lib/skill-rank-values.ts"

test("rank values expanded from a formula keep the game's decimal dot", () => {
  assert.deepEqual(rankValues("8 - 0.3/cấp chiêu", 3), ["8", "7.7", "7.4"])
})

test("a coefficient of a combat stat keeps the game's decimal dot", () => {
  assert.deepEqual(rankValues("450 + 90*(rank-1) + 0.9*magicAttack", 2), [
    "450 + 0.9 × Công phép",
    "540 + 0.9 × Công phép",
  ])
})

test("rank values in the thousands have no thousands separator", () => {
  assert.deepEqual(rankValues("1200 + 150/cấp chiêu", 2), ["1200", "1350"])
})
