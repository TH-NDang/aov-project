import assert from "node:assert/strict"
import { test } from "node:test"
import { capital } from "../src/lib/capital.ts"

test("words that stand alone start with a capital", () => {
  assert.equal(capital("đường Caesar"), "Đường Caesar")
  assert.equal(capital(""), "")
})
