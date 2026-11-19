import assert from "node:assert/strict"
import test from "node:test"
import { MODE_PARAMS, paramNames, readModeParam, readParam, writeParam } from "../src/lib/search-params.ts"

test("a link shared before the rename still opens the table of factions and classes", () => {
  assert.equal(readModeParam(new URLSearchParams("xem=bang"), MODE_PARAMS.view), "table")
})

test("a link shared before the rename keeps its unit filter and sort", () => {
  const old = new URLSearchParams("gia=3&phe=mage,knight&xep=dang-len&quan=airi&loc=open")
  assert.equal(readParam(old, MODE_PARAMS.cost), "3")
  assert.equal(readParam(old, MODE_PARAMS.traits), "mage,knight")
  assert.equal(readModeParam(old, MODE_PARAMS.sort), "trending")
  assert.equal(readParam(old, MODE_PARAMS.lineupUnit), "airi")
  assert.equal(readParam(old, MODE_PARAMS.filter), "open")
})

test("the English name wins when a link carries both", () => {
  assert.equal(readParam(new URLSearchParams("gia=3&cost=5"), MODE_PARAMS.cost), "5")
})

test("changing a value writes the English name and drops the old one", () => {
  const params = new URLSearchParams("gia=3&q=airi")
  writeParam(params, MODE_PARAMS.cost, "4")
  assert.equal(params.toString(), "q=airi&cost=4")
})

test("clearing a value removes both spellings", () => {
  const params = new URLSearchParams("xem=bang&view=table")
  writeParam(params, MODE_PARAMS.view, null)
  assert.equal(params.toString(), "")
})

test("a shared lineup link drops the unit filter under either name", () => {
  assert.deepEqual(paramNames([MODE_PARAMS.search, MODE_PARAMS.cost, MODE_PARAMS.traits]), [
    "q",
    "cost",
    "gia",
    "traits",
    "phe",
  ])
})
