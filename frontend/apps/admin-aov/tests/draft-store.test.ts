import assert from "node:assert/strict"
import { test } from "node:test"
import "fake-indexeddb/auto"
import {
  createDraftRepository,
  draftKey,
  indexedDraftStorage,
  sameDraftValue,
  type DraftRecord,
  type DraftStorage,
} from "../src/app/drafts/draft-store"

function memoryStorage() {
  const values = new Map<string, DraftRecord>()
  return {
    values,
    read: async (key: string) => structuredClone(values.get(key)),
    write: async (record: DraftRecord) => {
      values.set(record.key, structuredClone(record))
    },
    remove: async (key: string) => {
      values.delete(key)
    },
  }
}
const key = draftKey("issuer", "user-a", "hero:airi:revision-1")

test("IndexedDB restores incomplete drafts after a fresh repository and isolates accounts and revisions", async () => {
  const storage = indexedDraftStorage(`draft-test-${crypto.randomUUID()}`)
  const first = createDraftRepository(storage)
  await first.load(key)
  first.put(key, { name: "Airi", rating: null }, { name: "", description: "Đang viết…", rating: NaN }, 3)
  await first.flush(key)
  assert.equal(first.slot(key).persistence, "saved")
  const reopened = createDraftRepository(storage)
  await reopened.load(key)
  assert.deepEqual(reopened.slot(key).record?.value, { name: "", description: "Đang viết…", rating: NaN })
  assert.equal(reopened.slot(key).record?.baseVersion, 3)
  const other = draftKey("issuer", "user-b", "hero:airi:revision-1")
  await reopened.load(other)
  assert.equal(reopened.slot(other).record, null)
  const revision = draftKey("issuer", "user-a", "hero:airi:revision-2")
  await reopened.load(revision)
  assert.equal(reopened.slot(revision).record, null)
  await reopened.remove(key)
})

test("a late hydration response cannot replace edits already captured in memory", async () => {
  let resolve!: (value: unknown) => void
  const pending = new Promise((done) => {
    resolve = done
  })
  const storage = { ...memoryStorage(), read: () => pending }
  const repository = createDraftRepository(storage)
  const loading = repository.load(key)
  repository.put(key, { text: "server" }, { text: "new input" }, 1)
  resolve({ schemaVersion: 1, key, base: { text: "old" }, value: { text: "stale" }, baseVersion: 0, updatedAt: 1 })
  await loading
  assert.deepEqual(repository.slot(key).record?.value, { text: "new input" })
  await repository.flush(key)
})

test("writes and discards serialize without clearing a newer edit or reporting an old write as saved", async () => {
  const storage = memoryStorage()
  let release!: () => void
  let started!: () => void
  const began = new Promise<void>((resolve) => {
    started = resolve
  })
  const block = new Promise<void>((resolve) => {
    release = resolve
  })
  let writes = 0
  const repository = createDraftRepository({
    ...storage,
    write: async (record) => {
      if (++writes === 1) {
        started()
        await block
      }
      await storage.write(record)
    },
  })
  repository.put(key, "server", "first", 1)
  const old = repository.slot(key).record!
  const saving = repository.flush(key)
  await began
  repository.put(key, "server", "second", 1)
  assert.equal(await repository.remove(key, old), false)
  release()
  await saving
  assert.equal(repository.slot(key).persistence, "pending")
  await repository.flush(key)
  assert.equal(storage.values.get(key)?.value, "second")
  await repository.remove(key)
  assert.equal(storage.values.has(key), false)
})

test("failed storage preserves edits and retry persists the latest value", async () => {
  const storage = memoryStorage()
  let fail = true
  const repository = createDraftRepository({
    ...storage,
    write: async (record) => {
      if (fail) throw new Error("Storage unavailable")
      await storage.write(record)
    },
  })
  repository.put(key, "server", "recover me", 2)
  await repository.flush(key)
  assert.equal(repository.slot(key).persistence, "error")
  assert.equal(repository.slot(key).record?.value, "recover me")
  assert.equal(storage.values.size, 0)
  fail = false
  await repository.flush(key)
  assert.equal(repository.slot(key).persistence, "saved")
  assert.equal(storage.values.get(key)?.value, "recover me")
  await repository.remove(key)
})

test("successful rebasing removes only a clean draft and malformed persisted values stay inert", async () => {
  const storage = memoryStorage()
  const repository = createDraftRepository(storage)
  const other = draftKey("issuer", "user-a", "hero:other:revision-1")
  repository.put(key, "server", "changed", 1)
  repository.put(other, "original", "other edit", 1)
  await Promise.all([repository.flush(key), repository.flush(other)])
  repository.put(key, "changed", "changed", 2)
  await repository.flush(key)
  assert.equal(storage.values.has(key), false)
  assert.equal(repository.slot(key).record, null)
  assert.equal(storage.values.get(other)?.value, "other edit")
  const invalid: DraftStorage = { ...storage, read: async () => ({ key, value: "broken", schemaVersion: 100 }) }
  const reopened = createDraftRepository(invalid)
  await reopened.load(key)
  assert.equal(reopened.slot(key).persistence, "error")
  assert.equal(reopened.slot(key).record, null)
  assert.equal(sameDraftValue({ value: NaN }, { value: null }), false)
  assert.throws(() => repository.put(key, null, new Blob(["file bytes"]) as never, 1))
  await repository.remove(other)
})
