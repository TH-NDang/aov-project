import assert from "node:assert/strict"
import { test } from "node:test"
import { difficultyLevel } from "../src/features/hero/model/hero-difficulty.ts"

test("a difficulty on the game's five segments reads as the word of its segment", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((value) => difficultyLevel(value, 5)),
    [1, 2, 3, 4, 5],
  )
})

test("a difficulty on a ten-point scale reads as the same five words", () => {
  assert.equal(difficultyLevel(8, 10), 4)
  assert.equal(difficultyLevel(10, 10), 5)
})

test("a half step reads as the harder word and an empty rating as the easiest", () => {
  assert.equal(difficultyLevel(3.5, 5), 4)
  assert.equal(difficultyLevel(0, 5), 1)
})
