import assert from "node:assert/strict"
import test from "node:test"
import { previousPatch } from "../src/lib/hero-patch-line.ts"
import { statText } from "../src/features/hero/model/hero-stat-text.ts"

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
})

test("a stat with decimals keeps the game's dot and no thousands separator", () => {
  assert.equal(statText({ baseValue: 12.5, percentValue: 7.5 }), "12.5 | 7.5%")
  assert.equal(statText({ baseValue: 3200.5 }), "3200.5")
})
