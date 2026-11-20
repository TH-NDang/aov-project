import assert from "node:assert/strict"
import { test } from "node:test"
import {
  chooseEnchantment,
  choosePrimaryBranch,
  chooseSecondaryBranch,
  slotChoices,
  startSet,
} from "../src/lib/enchantment-set.ts"

const BRANCHES = ["light", "chaos", "forest"]
const entry = (branchCode, tier, position) => ({ id: `${branchCode}-${tier}-${position}`, branchCode, tier, position })
const ALL = BRANCHES.flatMap((branch) =>
  [1, 2, 3].flatMap((tier) => [0, 1, 2].map((position) => entry(branch, tier, position))),
)

test("a new set takes each primary tier's first enchantment", () => {
  assert.deepEqual(startSet("light", ALL, BRANCHES).slice(0, 3), ["light-1-0", "light-2-0", "light-3-0"])
})

test("a new set's secondaries share the next branch as tiers I and II", () => {
  assert.deepEqual(startSet("light", ALL, BRANCHES).slice(3), ["chaos-1-0", "chaos-2-0"])
})

test("choosing the secondary branch as primary moves the secondaries elsewhere", () => {
  const set = choosePrimaryBranch(startSet("light", ALL, BRANCHES), "chaos", ALL, BRANCHES)
  assert.deepEqual(set, ["chaos-1-0", "chaos-2-0", "chaos-3-0", "light-1-0", "light-2-0"])
})

test("a second secondary of another branch takes tier I", () => {
  const set = chooseSecondaryBranch(startSet("light", ALL, BRANCHES), 5, "forest", ALL)
  assert.deepEqual(set.slice(3), ["chaos-1-0", "forest-1-0"])
})

test("a primary slot offers only its own tier of the primary branch", () => {
  const ids = slotChoices(startSet("light", ALL, BRANCHES), 2, ALL).map((choice) => choice.id)
  assert.deepEqual(ids, ["light-2-0", "light-2-1", "light-2-2"])
})

test("an enchantment the slot may not hold leaves the set as it was", () => {
  const set = startSet("light", ALL, BRANCHES)
  assert.equal(chooseEnchantment(set, 1, "light-3-1", ALL), set)
})
