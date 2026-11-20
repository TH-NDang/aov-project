import assert from "node:assert/strict"
import { test } from "node:test"
import { pastedSetCodes } from "../src/features/warehouse/enchantment-set-codes.ts"

const SET = ["hap-huyet", "co-thu", "ma-chu", "tuong-phan", "xuyen-tam"]

test("a pasted link to a set gives its five codes", () => {
  const link = `https://athahub.com/warehouse/enchantments?view=set&set=${SET.join(",")}`
  assert.deepEqual(pastedSetCodes(link), SET)
})

test("five codes pasted with commas or spaces give the set", () => {
  assert.deepEqual(pastedSetCodes("hap-huyet, co-thu ma-chu,tuong-phan  xuyen-tam"), SET)
})

test("text that does not name five enchantments gives nothing", () => {
  assert.equal(pastedSetCodes("hap-huyet,co-thu"), null)
})
