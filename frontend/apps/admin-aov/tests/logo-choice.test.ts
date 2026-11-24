import assert from "node:assert/strict"
import { test } from "node:test"
import { chooseLogo } from "../src/lib/logo-choice"

const light = "https://img.example.test/light.png"
const dark = "https://img.example.test/dark.png"

test("each theme shows the logo drawn for it when both exist", () => {
  assert.deepEqual(chooseLogo(light, dark, false), { url: light })
  assert.deepEqual(chooseLogo(light, dark, true), { url: dark })
})

test("a dark theme without a dark logo shows the usual logo on a light plate", () => {
  assert.deepEqual(chooseLogo(light, null, true), { url: light, plate: "light" })
})

test("a light theme with only a dark logo shows it on a dark plate", () => {
  assert.deepEqual(chooseLogo(undefined, dark, false), { url: dark, plate: "dark" })
})

test("a record without a logo shows none", () => {
  assert.deepEqual(chooseLogo(null, undefined, true), {})
})
