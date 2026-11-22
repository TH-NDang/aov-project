import assert from "node:assert/strict"
import { test } from "node:test"
import { searchMatchRange } from "../src/features/hero/model/hero-search-highlight.ts"

test("a search lights the part of the name it matches", () => {
  assert.deepEqual(searchMatchRange("Raz", "ra"), [0, 2])
  assert.deepEqual(searchMatchRange("Aleister", "ster"), [4, 8])
})

test("a search without accents lights the accented letters of the name", () => {
  const name = "Lữ Bố"
  const range = searchMatchRange(name, "lu bo")
  assert.ok(range)
  assert.equal(name.slice(...range), "Lữ Bố")
  const other = "Điêu Thuyền"
  assert.equal(other.slice(...searchMatchRange(other, "dieu")!), "Điêu")
})

test("a search the name does not hold, or an empty one, lights nothing", () => {
  assert.equal(searchMatchRange("Raz", "sat thu"), undefined)
  assert.equal(searchMatchRange("Raz", "  "), undefined)
})
