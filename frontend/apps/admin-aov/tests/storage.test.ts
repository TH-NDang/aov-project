import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { createServer } from "node:http"
import {
  applyImport,
  parseCsv,
  planImport,
  recordArrays,
  validateTable,
  type StorageTable,
} from "../src/features/storage/storage-model.ts"
import { jsonStorage } from "../server/json-storage.ts"

const empty = (): StorageTable => ({
  id: "table",
  name: "Heroes",
  version: 1,
  columns: [],
  idColumn: null,
  rows: [],
  archived: false,
})

test("CSV preserves IDs, quoted delimiters, escaped quotes, and multiline values", () => {
  assert.deepEqual(parseCsv('\uFEFFcode;name;note\r\n001;"A;B";"line 1\nline ""2"""\r\n'), [
    { code: "001", name: "A;B", note: 'line 1\nline "2"' },
  ])
  assert.throws(() => parseCsv("id,id\n1,2"))
  assert.throws(() => parseCsv('id,name\n1,"open'))
  assert.throws(() => parseCsv("id,name\n1"))
})

test("first import uses the selected ID values and only selected columns", () => {
  const table = empty()
  const source = [
    { code: "001", name: "A", ignored: "secret" },
    { code: "002", name: "B" },
  ]
  const plan = planImport(table, source, "code", { name: "name" })
  const result = applyImport(table, plan, new Set())
  assert.equal(result.idColumn, "code")
  assert.deepEqual(result.columns, ["code", "name"])
  assert.deepEqual(result.rows, [
    { code: "001", name: "A" },
    { code: "002", name: "B" },
  ])
  assert.deepEqual(table.rows, [])
})

test("later imports match IDs, preserve untouched data, and explicitly update or skip", () => {
  const table = {
    ...empty(),
    columns: ["code", "name", "note"],
    idColumn: "code",
    rows: [
      { code: "001", name: "A", note: "keep" },
      { code: "002", name: "B", note: "also keep" },
    ],
  }
  const plan = planImport(
    table,
    [
      { external: "001", title: "Changed" },
      { external: "002", title: "Skipped" },
      { external: "003", title: "New" },
    ],
    "external",
    { title: "name" },
  )
  assert.deepEqual(
    plan.entries.map((entry) => entry.kind),
    ["update", "update", "new"],
  )
  const result = applyImport(table, plan, new Set(["001"]))
  assert.deepEqual(result.rows, [
    { code: "001", name: "Changed", note: "keep" },
    { code: "002", name: "B", note: "also keep" },
    { code: "003", name: "New" },
  ])
})

test("unchanged rows and missing cells do not overwrite existing values", () => {
  const table = { ...empty(), columns: ["id", "name"], idColumn: "id", rows: [{ id: 7, name: "A" }] }
  const plan = planImport(table, [{ code: "7" }], "code", { title: "name" })
  assert.equal(plan.entries[0].kind, "same")
  assert.deepEqual(applyImport(table, plan, new Set()).rows, table.rows)
})

test("invalid IDs, duplicate normalized IDs, unsafe columns, and conflicting mappings fail before saving", () => {
  assert.throws(() => planImport(empty(), [{ id: "" }], "id", {}))
  assert.throws(() => planImport(empty(), [{ id: "a" }, { id: " a " }], "id", {}))
  assert.throws(() => planImport(empty(), [{ id: 1 }, { id: "1" }], "id", {}))
  assert.throws(() => planImport(empty(), [{ id: 1, a: 1, b: 2 }], "id", { a: "name", b: "name" }))
  assert.throws(() => planImport(empty(), [{ id: 1 }], "id", { a: "__proto__" }))
  assert.throws(() => validateTable({ ...empty(), columns: ["id"], idColumn: "id", rows: [{ id: false }] }))
  assert.deepEqual(Object.keys(recordArrays({ heroes: [{ id: 1 }], badges: [{ id: "a" }], title: "test" })), [
    "heroes",
    "badges",
  ])
})

test("JSON storage persists files, rejects stale versions and cross-site writes, and preserves IDs", async () => {
  const root = await mkdtemp(join(tmpdir(), "aov-storage-test-"))
  let handler: any
  const plugin = jsonStorage(root)
  ;(plugin.configureServer as Function)({
    middlewares: {
      use: (_: string, callback: any) => {
        handler = callback
      },
    },
  })
  const server = createServer((req, res) => void handler(req, res))
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as { port: number }
  const base = `http://127.0.0.1:${address.port}`
  const request = (path: string, data: unknown, method = "PUT", origin?: string) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(data),
    })
  try {
    const created = await request("/", { name: "Heroes" }, "POST")
    assert.equal(created.status, 201)
    const table = (await created.json()) as StorageTable
    const updated = { ...table, columns: ["code", "name"], idColumn: "code", rows: [{ code: "001", name: "A" }] }
    assert.equal((await request(`/${table.id}`, updated)).status, 200)
    const saved = JSON.parse(await readFile(join(root, `${table.id}.json`), "utf8"))
    assert.equal(saved.version, 2)
    assert.equal(saved.rows[0].code, "001")
    assert.equal((await request(`/${table.id}`, updated)).status, 409)
    assert.equal((await request(`/${table.id}`, { ...saved, idColumn: "name" })).status, 400)
    assert.equal((await request(`/${table.id}`, saved, "PUT", "https://other.example")).status, 403)
    assert.equal((await request("/", null, "POST")).status, 400)
    assert.equal((await request("/", { name: "Heroes" }, "POST")).status, 400)
    assert.equal((await fetch(base + "/").then((response) => response.json()))[0].rowCount, 1)
    const simultaneous = await Promise.all([request(`/${table.id}`, saved), request(`/${table.id}`, saved)])
    assert.deepEqual(simultaneous.map((response) => response.status).sort(), [200, 409])
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    assert.equal(dirname(root), tmpdir())
    assert.ok(root.includes("aov-storage-test-"))
    await rm(root, { recursive: true, force: true })
  }
})
