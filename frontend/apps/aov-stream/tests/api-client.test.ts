import assert from "node:assert/strict"
import { test } from "node:test"
import type { PageSlice } from "@aov/community-contracts"
import { ApiError, COMMUNITY_API_ROOT, createApiRequest, readAllPages } from "../src/lib/api-client.ts"

type Sent = { url: string; init: RequestInit }

function client(answer: (url: string) => Response, token: (path: string) => string | null = () => null) {
  const sent: Sent[] = []
  const fetcher = (async (url: string, init: RequestInit) => {
    sent.push({ url, init })
    return answer(url)
  }) as typeof fetch
  const request = createApiRequest({
    root: COMMUNITY_API_ROOT,
    token,
    describe: (status, problem) => `${status} ${problem.code ?? ""}`,
    fetcher,
  })
  return { request, sent }
}

test("a public read carries neither a token nor a cookie", async () => {
  const { request, sent } = client(() => Response.json({ id: "c1" }))
  assert.deepEqual(await request("/competitions/c1"), { id: "c1" })
  assert.equal(sent[0]!.url, "/api/community/v1/competitions/c1")
  assert.equal(sent[0]!.init.credentials, "omit")
  assert.equal((sent[0]!.init.headers as Record<string, string>).Authorization, undefined)
  assert.equal(sent[0]!.init.cache, undefined)
})

test("a reader's own request carries the token and skips the browser cache", async () => {
  const { request, sent } = client(
    () => new Response(null, { status: 204 }),
    (path) => (path.startsWith("/me") ? "token-1" : null),
  )
  await request("/me/pages/p1/follow", { body: { following: true } })
  assert.equal(sent[0]!.init.method, "POST")
  assert.equal((sent[0]!.init.headers as Record<string, string>).Authorization, "Bearer token-1")
  assert.equal(sent[0]!.init.body, JSON.stringify({ following: true }))
  assert.equal(sent[0]!.init.cache, "no-store")
})

test("a failure keeps its status and problem code so a screen can choose its words", async () => {
  const { request } = client(() => Response.json({ code: "DUPLICATE_RECORD" }, { status: 409 }))
  await assert.rejects(request("/me/pages/p1/claims", { body: {} }), (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 409)
    assert.equal(error.code, "DUPLICATE_RECORD")
    assert.equal(error.message, "409 DUPLICATE_RECORD")
    return true
  })
})

test("a list is read past its first hundred rows", async () => {
  const slice = (page: number, items: number[]): PageSlice<number> => ({ items, page, size: 2, totalElements: 5 })
  const pages = [slice(0, [1, 2]), slice(1, [3, 4]), slice(2, [5])]
  const { request, sent } = client(() => Response.json(pages.shift()))
  assert.deepEqual(
    await readAllPages<number>((path, init) => request(path, init), "/me/follows", { size: 2 }),
    [1, 2, 3, 4, 5],
  )
  assert.equal(sent[2]!.url, "/api/community/v1/me/follows?page=2&size=2")
})
