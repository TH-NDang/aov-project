import assert from "node:assert/strict"
import test from "node:test"
import { WikiApiError, wikiGet, wikiGetAll, wikiGetPages, wikiRequest } from "../src/lib/wiki-api.ts"

const page = (items: number[], totalElements: number) => Response.json({ items, totalElements })

test("a public read goes to wiki-service without cookies or a token", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }))
  await wikiGet("/heroes/airi")
  const [url, init] = request.mock.calls[0]!.arguments as [string, RequestInit]
  assert.equal(url, "/api/wiki/v1/heroes/airi")
  assert.equal(init.credentials, "omit")
  assert.equal(init.headers, undefined)
})

test("a failed request keeps its status and problem code", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ code: "HERO_NOT_FOUND", detail: "No such hero." }, { status: 404 }),
  )
  await assert.rejects(wikiGet("/heroes/nobody"), (error: unknown) => {
    assert.ok(error instanceof WikiApiError)
    assert.equal(error.status, 404)
    assert.equal(error.code, "HERO_NOT_FOUND")
    return true
  })
})

test("a failure without problem JSON still keeps its status", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("gateway", { status: 502 }))
  await assert.rejects(wikiGet("/heroes"), { status: 502, code: undefined })
})

test("a reader's request carries the token, sends JSON and skips the browser cache", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }))
  assert.equal(await wikiRequest("/users/me", { method: "PUT", body: { displayName: "A" }, token: "t-1" }), undefined)
  const [, init] = request.mock.calls[0]!.arguments as [string, RequestInit]
  assert.equal((init.headers as Record<string, string>).Authorization, "Bearer t-1")
  assert.equal((init.headers as Record<string, string>)["Content-Type"], "application/json")
  assert.equal(init.body, JSON.stringify({ displayName: "A" }))
  assert.equal(init.cache, "no-store")
})

test("a list is read to its last page", async (t) => {
  const answers = [page([1, 2], 5), page([3, 4], 5), page([5], 5)]
  const request = t.mock.method(globalThis, "fetch", async () => answers.shift()!)
  assert.deepEqual(
    await wikiGetAll<number>("/patches", new URLSearchParams({ region: "VN" }), undefined, { size: 2 }),
    [1, 2, 3, 4, 5],
  )
  assert.equal(request.mock.callCount(), 3)
  assert.equal(request.mock.calls[1]!.arguments[0], "/api/wiki/v1/patches?region=VN&page=1&size=2")
})

test("an empty page ends a list whatever its total says", async (t) => {
  const answers = [page([1, 2], 9), page([], 9)]
  const request = t.mock.method(globalThis, "fetch", async () => answers.shift()!)
  assert.deepEqual(await wikiGetAll<number>("/patches", new URLSearchParams(), undefined, { size: 2 }), [1, 2])
  assert.equal(request.mock.callCount(), 2)
})

test("a list can be read on from a later page", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () => page([3], 3))
  assert.deepEqual(await wikiGetAll<number>("/changes", new URLSearchParams(), undefined, { size: 2, from: 1 }), [3])
  assert.equal(request.mock.calls[0]!.arguments[0], "/api/wiki/v1/changes?page=1&size=2")
})

test("pages that carry more than rows keep the first page beside every row", async (t) => {
  const answers = new Map([
    ["0", { rows: [1, 2], filters: ["a"], total: 5 }],
    ["1", { rows: [3, 4], filters: [], total: 5 }],
    ["2", { rows: [5], filters: [], total: 5 }],
  ])
  t.mock.method(globalThis, "fetch", async (url: string) =>
    Response.json(answers.get(new URL(url, "http://wiki.test").searchParams.get("page")!)),
  )
  const { first, items } = await wikiGetPages<{ rows: number[]; filters: string[]; total: number }, number>(
    "/skins",
    new URLSearchParams(),
    undefined,
    { size: 2, items: (read) => read.rows, total: (read) => read.total, parallel: 3 },
  )
  assert.deepEqual(first.filters, ["a"])
  assert.deepEqual(items, [1, 2, 3, 4, 5])
})

test("pages asked for ahead arrive with the first and a page past the end is dropped", async (t) => {
  const asked: string[] = []
  const answers = new Map([
    ["0", { rows: [1, 2], total: 3 }],
    ["1", { rows: [3], total: 3 }],
    ["2", { rows: [], total: 3 }],
  ])
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const page = new URL(url, "http://wiki.test").searchParams.get("page")!
    asked.push(page)
    return Response.json(answers.get(page))
  })
  const { items } = await wikiGetPages<{ rows: number[]; total: number }, number>(
    "/heroes",
    new URLSearchParams(),
    undefined,
    {
      size: 2,
      items: (read) => read.rows,
      total: (read) => read.total,
      ahead: 2,
    },
  )
  assert.deepEqual(items, [1, 2, 3])
  assert.deepEqual(asked.sort(), ["0", "1", "2"])
})
