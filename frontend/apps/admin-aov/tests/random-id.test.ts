import assert from "node:assert/strict"
import { test } from "node:test"
import { randomId } from "../src/lib/random-id"

test("UUID generation works without the secure-context randomUUID API", () => {
  const original = globalThis.crypto
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { getRandomValues: original.getRandomValues.bind(original) },
  })
  try {
    const ids = Array.from({ length: 100 }, () => randomId())
    for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    assert.equal(new Set(ids).size, ids.length)
  } finally {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: original })
  }
})
