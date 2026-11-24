import assert from "node:assert/strict"
import { test } from "node:test"
import { catalogScopeOf, type GamePatchScope } from "../src/features/tournaments/api/tournament-api"

const game = { region: "VN", locale: "vi-VN", seasonId: null, patchVariantId: null, includeUnscoped: false }
const stage: GamePatchScope = { gameId: "g", source: "STAGE", seasonId: "s4", patchId: "p1" }

test("a game without a patch of its own reads its catalog in the patch of its stage", () => {
  assert.deepEqual(catalogScopeOf(game, stage), { ...game, seasonId: "s4", patchVariantId: "p1" })
})

test("a game's own patch is kept over its stage", () => {
  const own = { ...game, patchVariantId: "v9" }
  assert.equal(catalogScopeOf(own, stage), own)
})

test("a game outside every line reads its catalog as before", () => {
  assert.equal(catalogScopeOf(game, { gameId: "g", source: "NONE" }), game)
  assert.equal(catalogScopeOf(game, undefined), game)
})
