import assert from "node:assert/strict"
import { test } from "node:test"
import { toolOf } from "../src/features/esports/model/desk"

test("a step of the line-ups opens them at the part it is about, the players at the board", () => {
  assert.deepEqual(toolOf({ id: "spells", target: "loadout" }), { tool: "lineup", target: { part: "spell" } })
  assert.deepEqual(toolOf({ id: "items", target: "equipment" }), { tool: "lineup", target: { part: "equipment" } })
  assert.deepEqual(toolOf({ id: "players", target: "loadout" }), { tool: "lineup", target: undefined })
})

test("a step of the game opens Ván đấu at the row that records it", () => {
  assert.deepEqual(toolOf({ id: "video", target: "sync" }), { tool: "game", target: { row: "times" } })
  assert.deepEqual(toolOf({ id: "result", target: "result" }), { tool: "game", target: { row: "result" } })
  assert.deepEqual(toolOf({ id: "checks", target: "data" }), { tool: "game", target: { row: "scope" } })
})
