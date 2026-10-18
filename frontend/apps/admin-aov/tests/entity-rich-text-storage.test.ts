import assert from "node:assert/strict"
import { test } from "node:test"
import { defaultSettings, loadSettings, saveSettings } from "../src/features/terminology/settings-api"
import type { StorageTable } from "../src/features/storage/storage-model"

test("settings persist through versioned server storage; failures never report saved", async () => {
  const original = globalThis.fetch
  let stored: StorageTable | null = null
  let writes = 0
  globalThis.fetch = async (input, init) => {
    if (init?.method === "POST") {
      stored = {
        id: "fixture-table",
        name: "AOV rich text settings v1",
        version: 1,
        columns: [],
        idColumn: null,
        rows: [],
        archived: false,
      }
      return Response.json(stored)
    }
    if (init?.method === "PUT") {
      const value = JSON.parse(String(init.body)) as StorageTable
      writes++
      if (value.version !== stored?.version) return Response.json({ message: "Version conflict" }, { status: 409 })
      stored = { ...value, version: value.version + 1 }
      return Response.json(stored)
    }
    return Response.json(String(input).endsWith("/__storage/") ? (stored ? [stored] : []) : stored)
  }
  try {
    const empty = await loadSettings()
    assert.equal(empty.table, null)
    assert.equal(writes, 0)
    const table = await saveSettings({ ...defaultSettings, autoRecognize: false }, null)
    assert.equal(table.version, 2)
    const loaded = await loadSettings()
    assert.equal(loaded.settings.autoRecognize, false)
    await saveSettings(defaultSettings, table)
    await assert.rejects(saveSettings(defaultSettings, table), /Version conflict/)
    globalThis.fetch = async () => new Response("unavailable", { status: 503 })
    await assert.rejects(loadSettings(), /local dev or preview server/)
  } finally {
    globalThis.fetch = original
  }
})
