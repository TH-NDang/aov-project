import assert from "node:assert/strict"
import test from "node:test"
import { previousPatch } from "../src/features/hero/hero-patch-line.ts"
import { localizedStatText, statText } from "../src/features/hero/hero-stat-text.ts"

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
