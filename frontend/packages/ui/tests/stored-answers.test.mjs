import assert from "node:assert/strict"
import test from "node:test"

import { answerBytes, connectStoredAnswers } from "../src/lib/stored-answers.ts"

/** A store in memory, with the same contract as the IndexedDB one. */
function memoryStore() {
  const answers = new Map()
  return {
    answers,
    get: async (kind) => answers.get(kind),
    put: async (answer) => void answers.set(answer.kind, answer),
    sizes: async () => [...answers.values()].map(({ kind, savedAt, bytes }) => ({ kind, savedAt, bytes })),
    delete: async (kind) => void answers.delete(kind),
  }
}

/** A query client with just what the module reads: a cache to listen to and data set by hand. */
function fakeClient() {
  const listeners = []
  const set = []
  return {
    set,
    getQueryCache: () => ({ subscribe: (listener) => (listeners.push(listener), () => {}) }),
    setQueryData: (key, data, options) => set.push({ key, data, options }),
    emit: (event) => listeners.forEach((listener) => listener(event)),
  }
}

const query = (kind, hash, data) => ({
  queryKey: [hash],
  queryHash: hash,
  meta: kind ? { storedAnswer: kind } : undefined,
  state: { data, dataUpdatedAt: data === undefined ? 0 : 1 },
})
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test("an answer read from the network is kept and seeds the same query on the next visit", async () => {
  const store = memoryStore()
  const first = fakeClient()
  connectStoredAnswers(first, store)
  first.emit({ type: "updated", query: query("heroes@1", "VN", [1, 2]), action: { type: "success" } })
  await settle()

  const next = fakeClient()
  connectStoredAnswers(next, store)
  next.emit({ type: "added", query: query("heroes@1", "VN", undefined) })
  await settle()

  assert.deepEqual(next.set[0].data, [1, 2])
  assert.equal(typeof next.set[0].options.updatedAt, "number")
})

test("a kept answer of another scope seeds nothing, and a query that does not opt in is never kept", async () => {
  const store = memoryStore()
  const client = fakeClient()
  connectStoredAnswers(client, store)
  client.emit({ type: "updated", query: query("heroes@1", "VN", [1]), action: { type: "success" } })
  client.emit({ type: "updated", query: query(undefined, "account", { name: "me" }), action: { type: "success" } })
  await settle()
  client.emit({ type: "added", query: query("heroes@1", "TH", undefined) })
  await settle()

  assert.deepEqual([...store.answers.keys()], ["heroes@1"])
  assert.equal(client.set.length, 0)
})

test("data set by hand, such as the seeding itself, is not kept again", async () => {
  const store = memoryStore()
  const client = fakeClient()
  connectStoredAnswers(client, store)
  client.emit({ type: "updated", query: query("heroes@1", "VN", [1]), action: { type: "success", manual: true } })
  await settle()

  assert.equal(store.answers.size, 0)
})

test("over the limit, the oldest answers of other kinds go first", async () => {
  const store = memoryStore()
  const client = fakeClient()
  const limit = answerBytes([1, 2, 3]) * 2
  connectStoredAnswers(client, store, limit)
  for (const kind of ["a@1", "b@1", "c@1"]) {
    client.emit({ type: "updated", query: query(kind, kind, [1, 2, 3]), action: { type: "success" } })
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 2))
  }

  assert.deepEqual([...store.answers.keys()].sort(), ["b@1", "c@1"])
})

test("a missing store keeps nothing and fails nothing", () => {
  const client = fakeClient()
  const stop = connectStoredAnswers(client, undefined)
  assert.equal(typeof stop, "function")
})
