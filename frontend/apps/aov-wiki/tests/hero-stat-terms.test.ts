import assert from "node:assert/strict"
import test from "node:test"
import { statGrowthText } from "../src/features/hero/model/hero-stat-text.ts"
import { HERO_STAT_TERMS, TERM_ITEM_FILTERS } from "../../../packages/ui/src/lib/hero-stat-terms.ts"
import { ITEM_STAT_FILTERS } from "../../../packages/ui/src/lib/item-description.ts"

test("a stat's rise per level reads as the game writes it and stays out when nothing rises", () => {
  assert.equal(statGrowthText(90, "cấp"), "+90/cấp")
  assert.equal(statGrowthText(2.5, "level"), "+2.5/level")
  assert.equal(statGrowthText(0, "cấp"), undefined)
  assert.equal(statGrowthText(null, "cấp"), undefined)
})

test("every stat the attribute screen shows has a term, and each term's items come from a real stat filter", () => {
  for (const key of ["HP", "ATTACK_DAMAGE", "ABILITY_POWER", "ARMOR", "MAGIC_DEFENSE", "MOVEMENT_SPEED"])
    assert.ok(HERO_STAT_TERMS[key], `${key} has a term`)
  const filters = new Set(ITEM_STAT_FILTERS.map((filter) => filter.key))
  for (const [term, filter] of Object.entries(TERM_ITEM_FILTERS)) assert.ok(filters.has(filter), `${term} → ${filter}`)
})
