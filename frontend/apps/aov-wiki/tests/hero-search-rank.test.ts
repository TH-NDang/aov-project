import assert from "node:assert/strict"
import { test } from "node:test"
import { heroSearchRank } from "../src/features/hero/model/hero-search-rank.ts"

test("a name that starts with the search comes before one that only holds it", () => {
  assert.equal(heroSearchRank(["raz"], "ra"), 0)
  assert.equal(heroSearchRank(["dextra"], "ra"), 2)
})

test("a word inside a name that starts with the search ranks between the two", () => {
  assert.equal(heroSearchRank(["lu bo"], "bo"), 1)
  assert.equal(heroSearchRank(["azzen'ka"], "ka"), 1)
})

test("a hero is found by any of its names, at the best rank among them", () => {
  assert.equal(heroSearchRank(["flowborn", "flowborn-ad"], "ad"), 1)
  assert.equal(heroSearchRank(["dieu thuyen", "diaochan"], "diao"), 0)
})

test("a search no name holds finds nothing, and an empty search keeps everyone", () => {
  assert.equal(heroSearchRank(["raz"], "sat thu"), undefined)
  assert.equal(heroSearchRank(["raz"], ""), 0)
})
