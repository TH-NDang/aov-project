import assert from "node:assert/strict"
import { test } from "node:test"
import { changeShortWord } from "../src/lib/change-short-word.ts"

test("a change is tagged with the word players use for its tone", () => {
  assert.equal(changeShortWord("BUFF", "up"), "Buff")
  assert.equal(changeShortWord("NERF", "down"), "Nerf")
  assert.equal(changeShortWord("ADJUSTMENT", "adjust"), "Tweak")
})

test("a fix keeps its own word rather than reading as a tweak", () => {
  assert.equal(changeShortWord("FIX", "adjust"), "Fix")
  assert.equal(changeShortWord("BUG_FIX", "adjust"), "Fix")
})

test("an unknown tone reads as a tweak", () => {
  assert.equal(changeShortWord("SOMETHING", "elsewhere"), "Tweak")
})
