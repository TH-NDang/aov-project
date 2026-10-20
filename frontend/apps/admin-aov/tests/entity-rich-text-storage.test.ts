import assert from "node:assert/strict"
import { test } from "node:test"
import type { ReferenceSettingsDocument } from "@aov/ui/lib/reference-settings"

test("shared backend settings preserve translations and reject stale saves or failed responses", async () => {
  const channel = globalThis.BroadcastChannel
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: undefined })
  const { createReferenceSettingsApi, defaultSettings } = await import("../src/features/terminology/settings-api")
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: channel })
  let stored: ReferenceSettingsDocument = { version: 1, settings: structuredClone(defaultSettings) }
  const requests: string[] = []
  const api = createReferenceSettingsApi(async <T>(path: string, init?: RequestInit): Promise<T> => {
    requests.push(path)
    if (init?.method === "PUT") {
      const input = JSON.parse(String(init.body))
      if (input.expectedVersion !== stored.version) throw new Error("Version conflict")
      stored = { version: stored.version + 1, settings: input.settings }
    }
    return structuredClone(stored) as T
  })
  const initial = await api.load()
  const saved = await api.save({ ...initial.settings, autoRecognize: false }, initial.version)
  assert.equal(saved.version, 2)
  assert.equal((await api.load()).settings.autoRecognize, false)
  assert.deepEqual(saved.settings.entities, defaultSettings.entities)
  await assert.rejects(api.save(defaultSettings, initial.version), /Version conflict/)
  assert.ok(requests.every((path) => path === "/admin/reference-settings"))
  const broken = createReferenceSettingsApi(async () => {
    throw new Error("unavailable")
  })
  await assert.rejects(broken.save(defaultSettings, 2), /unavailable/)
})
