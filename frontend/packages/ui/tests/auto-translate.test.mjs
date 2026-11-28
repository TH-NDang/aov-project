import assert from "node:assert/strict"
import { test } from "node:test"
import { autoTranslateOn, chooseAutoTranslate } from "../src/lib/auto-translate.ts"

test("auto-translate is off until chosen and the choice survives a visit", async () => {
  const values = new Map()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  try {
    assert.equal(autoTranslateOn(), false)
    await chooseAutoTranslate(true)
    assert.equal(autoTranslateOn(), true)
    assert.deepEqual([...values.values()], ["on"])
    await chooseAutoTranslate(false)
    assert.equal(autoTranslateOn(), false)
    assert.deepEqual([...values.values()], ["off"])
  } finally {
    delete globalThis.localStorage
  }
})
