import assert from "node:assert/strict"
import test from "node:test"
import { isCatalogFix, splitHeroFixes } from "../src/lib/patch-fixes.ts"

const line = (id: string, changeKind: string) => ({ id, type: "HERO_OTHER_CHANGE", changeKind, description: id })

test("a hero whose changes are all fixes leaves the hero list for the fixes", () => {
  const lorion = { heroId: "lorion", overallKind: "FIX", changes: [line("stuck skill", "FIX")] }
  const dyadia = { heroId: "dyadia", overallKind: "NERF", changes: [line("less damage", "NERF")] }

  const { main, fixes } = splitHeroFixes([lorion, dyadia])

  assert.deepEqual(main, [dyadia])
  assert.deepEqual(fixes, [lorion])
})

test("a hero with balance changes and fixes shows each part in its own place", () => {
  const richter = {
    heroId: "richter",
    overallKind: "BUFF",
    changes: [line("more damage", "BUFF"), line("display fixed", "FIX")],
  }

  const { main, fixes } = splitHeroFixes([richter])

  assert.deepEqual(main, [{ ...richter, changes: [line("more damage", "BUFF")] }])
  assert.deepEqual(fixes, [{ ...richter, overallKind: "FIX", changes: [line("display fixed", "FIX")] }])
})

test("a set rated as a fix that also changes balance reads by its remaining changes", () => {
  const grakk = { heroId: "grakk", overallKind: "FIX", changes: [line("hook fixed", "FIX"), line("slower", "NERF")] }

  const { main } = splitHeroFixes([grakk])

  assert.equal(main[0].overallKind, undefined)
  assert.deepEqual(main[0].changes, [line("slower", "NERF")])
})

test("a hero with only a summary goes by the kind of its set", () => {
  const allain = { heroId: "allain", overallKind: "FIX", summary: "Sudden death fixed." }
  const arduin = { heroId: "arduin", overallKind: "BUFF", summary: "Stronger." }

  assert.deepEqual(splitHeroFixes([allain, arduin]), { main: [arduin], fixes: [allain] })
})

test("an armory entry is a fix only when fixing is all the update did to it", () => {
  const subject = { id: "blade", code: "blade" }
  assert.equal(isCatalogFix({ subject, changeKinds: ["FIX"] }), true)
  assert.equal(isCatalogFix({ subject, changeKinds: ["FIX", "BUFF"] }), false)
  assert.equal(isCatalogFix({ subject, changeKinds: ["BUFF"] }), false)
})
