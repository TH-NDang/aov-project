import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { storedAnswer } from "../src/lib/stored-answer.ts"

const store = new Map<string, string>()
const localStorage = {
  getItem: (name: string) => store.get(name) ?? null,
  setItem: (name: string, value: string) => void store.set(name, value),
}

beforeEach(() => {
  store.clear()
  Object.assign(globalThis, { window: { localStorage } })
})

test("an answer saved on one visit is read back on the next for the same query", () => {
  storedAnswer<number[]>("heroes", ["VN", "vi-VN"]).save([1, 2])
  const next = storedAnswer<number[]>("heroes", ["VN", "vi-VN"])
  assert.deepEqual(next.data(), [1, 2])
  assert.equal(typeof next.savedAt(), "number")
})

test("an answer kept for another scope is not read, and saving replaces it", () => {
  storedAnswer<number[]>("heroes", ["VN", "vi-VN"]).save([1])
  assert.equal(storedAnswer<number[]>("heroes", ["VN", "en-US"]).data(), undefined)
  storedAnswer<number[]>("heroes", ["VN", "en-US"]).save([2])
  assert.equal(store.size, 1)
})

test("a store that cannot be read or written keeps nothing and fails nothing", () => {
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: () => "{not json",
        setItem: () => {
          throw new Error("quota")
        },
      },
    },
  })
  const answer = storedAnswer<number[]>("heroes", ["VN"])
  assert.equal(answer.data(), undefined)
  assert.doesNotThrow(() => answer.save([1]))
})
