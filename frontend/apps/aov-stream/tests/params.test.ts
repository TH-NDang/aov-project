import assert from "node:assert/strict"
import { test } from "node:test"
import { withParam } from "../src/lib/params.ts"

const params = () => new URLSearchParams("tab=stats&sort=short")

test("a parameter takes another value and the others stay", () => {
  assert.equal(String(withParam(params(), "sort", "long")), "tab=stats&sort=long")
  assert.equal(String(withParam(params(), "in", "GROUP")), "tab=stats&sort=short&in=GROUP")
})

test("a parameter without a value leaves the address", () => {
  assert.equal(String(withParam(params(), "sort", null)), "tab=stats")
})

test("the parameters that were read are left as they are", () => {
  const read = params()
  withParam(read, "sort", null)
  assert.equal(String(read), "tab=stats&sort=short")
})
