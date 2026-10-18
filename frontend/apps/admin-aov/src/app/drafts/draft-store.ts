import { createStore } from "zustand/vanilla"
import { openDB } from "idb"
import { z } from "zod"

export type DraftValue = string | number | boolean | null | undefined | DraftValue[] | { [key: string]: DraftValue }

function serializable(value: unknown, depth = 0): value is DraftValue {
  if (depth > 40) return false
  if (value == null || ["string", "number", "boolean", "undefined"].includes(typeof value)) return true
  if (Array.isArray(value)) return value.every((item) => serializable(item, depth + 1))
  return (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every((item) => serializable(item, depth + 1))
  )
}

export function sameDraftValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const keys = Object.keys(left)
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        sameDraftValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  )
}

const draftSchema = z.object({
  schemaVersion: z.literal(1),
  key: z.string().max(2000),
  baseVersion: z.union([z.number(), z.string(), z.null()]),
  base: z.custom<DraftValue>(serializable),
  value: z.custom<DraftValue>(serializable),
  updatedAt: z.number().finite(),
})
export type DraftRecord = z.infer<typeof draftSchema>
export type DraftSlot = {
  ready: boolean
  record: DraftRecord | null
  persistence: "idle" | "pending" | "saved" | "error"
  error: string | null
}
export const emptyDraftSlot: DraftSlot = { ready: false, record: null, persistence: "idle", error: null }
export interface DraftStorage {
  read(key: string): Promise<unknown>
  write(record: DraftRecord): Promise<void>
  remove(key: string): Promise<void>
}

export function indexedDraftStorage(name = "aov-admin-drafts"): DraftStorage {
  const database = () =>
    openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore("drafts", { keyPath: "key" })
      },
    })
  return {
    async read(key) {
      const db = await database()
      try {
        return await db.get("drafts", key)
      } finally {
        db.close()
      }
    },
    async write(record) {
      const db = await database()
      try {
        await db.put("drafts", record)
      } finally {
        db.close()
      }
    },
    async remove(key) {
      const db = await database()
      try {
        await db.delete("drafts", key)
      } finally {
        db.close()
      }
    },
  }
}

/** Keys isolate accounts and forms; authentication credentials are never part of persisted data. */
export function draftKey(issuer: string, subject: string, form: string) {
  return JSON.stringify([1, issuer, subject, form])
}

export function createDraftRepository(storage: DraftStorage, delay = 500) {
  const store = createStore<{ slots: Record<string, DraftSlot> }>(() => ({ slots: {} }))
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const loading = new Map<string, Promise<void>>()
  const queues = new Map<string, Promise<void>>()
  const epochs = new Map<string, number>()
  const slot = (key: string) => store.getState().slots[key] ?? emptyDraftSlot
  const set = (key: string, next: DraftSlot) => store.setState((state) => ({ slots: { ...state.slots, [key]: next } }))
  const cancelTimer = (key: string) => {
    clearTimeout(timers.get(key))
    timers.delete(key)
  }
  function enqueue(key: string, operation: () => Promise<void>): Promise<void> {
    const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(operation)
    queues.set(key, next)
    void next
      .finally(() => {
        if (queues.get(key) === next) queues.delete(key)
      })
      .catch(() => {})
    return next
  }
  async function load(key: string) {
    if (slot(key).ready) return
    const pending = loading.get(key)
    if (pending) return pending
    const task = (async () => {
      try {
        const raw = await storage.read(key)
        const parsed = raw === undefined ? null : draftSchema.parse(raw)
        if (parsed && parsed.key !== key) throw new Error("Draft key mismatch")
        if (!slot(key).ready) set(key, { ready: true, record: parsed, persistence: "saved", error: null })
      } catch {
        if (!slot(key).ready)
          set(key, {
            ready: true,
            record: null,
            persistence: "error",
            error:
              "Không đọc được bản nháp trên thiết bị. Nháp mới chỉ được giữ trong phiên cho đến khi lưu thành công.",
          })
      } finally {
        loading.delete(key)
      }
    })()
    loading.set(key, task)
    return task
  }
  async function flush(key: string) {
    cancelTimer(key)
    const record = slot(key).record
    const epoch = epochs.get(key)
    if (!record) return queues.get(key)
    const cleared = sameDraftValue(record.base, record.value)
    try {
      await enqueue(key, () => (cleared ? storage.remove(key) : storage.write(record)))
      if (slot(key).record === record && epochs.get(key) === epoch)
        set(key, { ready: true, record: cleared ? null : record, persistence: "saved", error: null })
    } catch {
      if (slot(key).record === record && epochs.get(key) === epoch)
        set(key, {
          ...slot(key),
          persistence: "error",
          error:
            "Không lưu được nháp trên thiết bị. Nội dung vẫn còn trong phiên này; hãy lưu backend trước khi đóng web.",
        })
    }
  }
  function put(key: string, base: DraftValue, value: DraftValue, baseVersion: DraftRecord["baseVersion"]) {
    epochs.set(key, (epochs.get(key) ?? 0) + 1)
    const record = draftSchema.parse({
      schemaVersion: 1,
      key,
      base: structuredClone(base),
      value: structuredClone(value),
      baseVersion,
      updatedAt: Date.now(),
    })
    set(key, { ready: true, record, persistence: "pending", error: null })
    cancelTimer(key)
    timers.set(
      key,
      setTimeout(() => void flush(key), delay),
    )
  }
  async function remove(key: string, expected = slot(key).record) {
    if (slot(key).record !== expected) return false
    cancelTimer(key)
    const epoch = (epochs.get(key) ?? 0) + 1
    epochs.set(key, epoch)
    set(key, { ...slot(key), persistence: "pending", error: null })
    try {
      await enqueue(key, () => storage.remove(key))
      if (slot(key).record === expected && epochs.get(key) === epoch)
        set(key, { ready: true, record: null, persistence: "saved", error: null })
      return true
    } catch {
      if (slot(key).record === expected && epochs.get(key) === epoch)
        set(key, { ...slot(key), persistence: "error", error: "Không xóa được nháp trên thiết bị. Hãy thử lại." })
      return false
    }
  }
  return { store, load, put, flush, remove, slot }
}

export const draftRepository = createDraftRepository(indexedDraftStorage())
