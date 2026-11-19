import assert from "node:assert/strict"
import { test } from "node:test"
import { chooseRank, rankChoice, typedPlace } from "../src/features/community/model/achievement-rank-model"

test("a stored rank shows as the choice that names it", () => {
  assert.equal(rankChoice({ place: 1 }), "1")
  assert.equal(rankChoice({ place: 5, placeTo: 8 }), "5-8")
  assert.equal(rankChoice({ award: true }), "AWARD")
  assert.equal(rankChoice({}), "")
})

test("a place no choice names shows as another place", () => {
  assert.equal(rankChoice({ place: 7 }), "OTHER")
  assert.equal(rankChoice({ place: 9, placeTo: 12 }), "OTHER")
})

test("choosing an individual award clears the place it had", () => {
  assert.deepEqual(chooseRank("AWARD", { place: 3, placeTo: 4 }), { place: null, placeTo: null, award: true })
})

test("choosing another place keeps the place already typed in", () => {
  assert.deepEqual(chooseRank("OTHER", { place: 7, placeTo: null }), { place: 7, placeTo: null, award: null })
})

test("choosing no rank leaves the wording to speak for the record", () => {
  assert.deepEqual(chooseRank("", { place: 1, award: null }), { place: null, placeTo: null, award: null })
})

test("a typed place is a whole number from 1", () => {
  assert.equal(typedPlace("7"), 7)
  assert.equal(typedPlace("0"), null)
  assert.equal(typedPlace(""), null)
})
