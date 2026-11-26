import assert from "node:assert/strict"
import { test } from "node:test"
import { shareOrGames, shareText, shareWords, wholePercent } from "../src/lib/shares.ts"

const vi = (text: string) => text
const en = (_: string, text: string) => text

test("a share says a hundred only of all, and stays under the limit it belongs under", () => {
  assert.equal(wholePercent(327, 327), 100)
  assert.equal(wholePercent(326, 327), 99)
  assert.equal(wholePercent(896, 1000, 90), 89)
  assert.equal(wholePercent(74, 100, 90), 74)
})

test("a share too small for a whole percent is not written as nothing", () => {
  assert.equal(shareText(1, 327), "<1%")
  assert.equal(shareText(0, 327), "0%")
  assert.equal(shareText(0, 0), "0%")
})

test("a share reads as everything only where nothing is missing", () => {
  assert.equal(shareText(49, 105), "47%")
  assert.equal(shareText(81, 81), "100%")
  assert.equal(shareText(326, 327), "99%")
})

test("of fewer than ten games no share is told but the games", () => {
  const told = (part: number, whole: number) => shareOrGames(part, whole, vi, "vi-VN")
  assert.deepEqual([told(3, 4), told(9, 9), told(9, 10)], ["3 ván", "9 ván", "90%"])
  assert.equal(shareOrGames(1, 4, en, "en-US"), "1 game")
})

test("inside a sentence a share never reads as nothing or all while it is neither", () => {
  assert.deepEqual(
    [0, 0.004, 0.006, 0.5, 0.996, 1].map((share) => shareWords(share, vi)),
    ["0%", "dưới 1%", "1%", "50%", "trên 99%", "100%"],
  )
  assert.deepEqual(
    [0.004, 0.996].map((share) => shareWords(share, en)),
    ["under 1%", "over 99%"],
  )
})
