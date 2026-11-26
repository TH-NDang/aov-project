import assert from "node:assert/strict"
import { test } from "node:test"
import { entryMemory } from "../src/lib/entry-memory.ts"

test("a choice belongs to the entry of the history it was made on", () => {
  const memory = entryMemory()
  memory.remember("a", "order", "won")
  assert.equal(memory.recall("a", "order"), "won")
  assert.equal(memory.recall("b", "order"), undefined)
})

test("what was chosen survives a reload", () => {
  const memory = entryMemory()
  memory.remember("a", "fold", true)
  memory.remember("a", "week", null)
  const reloaded = entryMemory(memory.save())
  assert.equal(reloaded.recall("a", "fold"), true)
  assert.equal(reloaded.recall("a", "week"), null)
})

test("what another version of the app saved is passed over", () => {
  for (const saved of ["not json", "null", "[]", '{"a":null}', '{"a":{"fold":{}}}'])
    assert.equal(entryMemory(saved).recall("a", "fold"), undefined)
})

test("the entries written longest ago give way to new ones", () => {
  const memory = entryMemory()
  for (let at = 0; at < 40; at++) memory.remember(String(at), "fold", true)
  memory.remember("0", "order", "won")
  memory.remember("40", "fold", true)
  assert.equal(memory.recall("1", "fold"), undefined)
  assert.equal(memory.recall("0", "fold"), true)
  assert.equal(memory.recall("40", "fold"), true)
})
