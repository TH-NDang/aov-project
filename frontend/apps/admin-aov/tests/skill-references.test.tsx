import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { ReferenceSearchPage } from "@aov/ui/lib/entity-rich-text-editor"
import type { Request } from "../src/features/publishing/publishing-api"
import type { SkillReferenceScope } from "../src/features/terminology/skill-reference-api"

const originalFetch = globalThis.fetch
const originalChannel = globalThis.BroadcastChannel
let currentFetch: typeof fetch = async () => {
  throw new Error("Unexpected network request")
}
const dispatchFetch: typeof fetch = (input, init) => currentFetch(input, init)
Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: dispatchFetch })
Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: undefined })
const { createSkillReferenceApi, createSkillReferenceSearch, skillReferenceEntryOptions, skillReferenceKeys } =
  await import("../src/features/terminology/skill-reference-api")
const { invalidateReferenceCatalog } = await import("../src/features/terminology/reference-api")
Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: originalFetch })
Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: originalChannel })

const heroId = "00000000-0000-4000-8000-000000000001"
const id = (number: number) => `${heroId}.skill-1-${number}`
const scope: SkillReferenceScope = { issuer: "realm", subject: "editor", rulesetId: "standard", locale: "vi-VN" }
function entity(referenceId: string, name = referenceId.split(".")[1]!): EntityReference {
  return {
    id: referenceId,
    kind: "skill",
    heroId,
    skillKey: referenceId.split(".")[1],
    revisionId: "revision-1",
    translations: [{ locale: "vi-VN", name, aliases: [], description: "Skill description" }],
    owner: {
      id: heroId,
      kind: "hero",
      translations: [{ locale: "vi-VN", name: "Airi", aliases: [], description: "" }],
    },
    autoMatch: false,
  }
}
const page = (items: EntityReference[]): ReferenceSearchPage => ({
  items,
  page: 0,
  size: 20,
  totalElements: items.length,
})
const settle = () => new Promise((resolve) => setTimeout(resolve, 10))
function deferredApi() {
  const calls: { path: string; signal: AbortSignal; finish: (value: ReferenceSearchPage) => void }[] = []
  const request: Request = <T,>(path: string, init?: RequestInit) =>
    new Promise<T>((resolve) => {
      calls.push({ path, signal: init!.signal as AbortSignal, finish: (value) => resolve(value as T) })
    })
  return { calls, api: createSkillReferenceApi(request) }
}

test("skill API separates paged search from bounded ID lookup and forwards abort signals", async () => {
  const calls: { path: string; signal?: AbortSignal | null }[] = []
  const api = createSkillReferenceApi(async <T,>(path: string, init?: RequestInit) => {
    calls.push({ path, signal: init?.signal })
    return page([]) as T
  })
  const abort = new AbortController()
  await api.search("  @Airi chiêu  ", "vi-VN", "standard", 2, abort.signal)
  const search = new URL(calls[0]!.path, "http://test")
  assert.equal(search.pathname, "/admin/reference-skills")
  assert.equal(search.searchParams.get("q"), "@Airi chiêu")
  assert.equal(search.searchParams.get("locale"), "vi-VN")
  assert.equal(search.searchParams.get("rulesetId"), "standard")
  assert.equal(search.searchParams.get("page"), "2")
  assert.equal(search.searchParams.get("size"), "20")
  assert.equal(calls[0]!.signal, abort.signal)
  await api.lookup([id(1), id(1), id(2)], "vi-VN", "", abort.signal)
  const lookup = new URL(calls[1]!.path, "http://test")
  assert.equal(lookup.searchParams.get("ids"), `${id(1)},${id(2)}`)
  for (const key of ["q", "page", "size", "rulesetId"]) assert.equal(lookup.searchParams.get(key), null)
  assert.throws(
    () =>
      api.lookup(
        Array.from({ length: 51 }, (_, index) => id(index)),
        "vi-VN",
        "",
        abort.signal,
      ),
    RangeError,
  )
  await api.lookup([], "vi-VN", "", abort.signal)
  assert.equal(calls.length, 2)
})

test("identity queries coalesce across readers, chunk at 50 and cache missing identities as null", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const batches: string[][] = []
  const api = createSkillReferenceApi(async <T,>(path: string) => {
    const ids = new URL(path, "http://test").searchParams.get("ids")!.split(",")
    batches.push(ids)
    return page(ids.filter((value) => value !== id(120)).map((value) => entity(value))) as T
  })
  try {
    const reads = Array.from({ length: 121 }, (_, index) =>
      client.fetchQuery(skillReferenceEntryOptions(client, scope, id(index), api)),
    )
    reads.push(client.fetchQuery(skillReferenceEntryOptions(client, scope, id(2), api)))
    const values = await Promise.all(reads)
    assert.deepEqual(
      batches.map((batch) => batch.length),
      [50, 50, 21],
    )
    assert.equal(values[120], null)
    assert.equal(client.getQueryData(skillReferenceKeys.entry(scope, id(120))), null)
    assert.equal(values[2], values[121])
    await client.fetchQuery(skillReferenceEntryOptions(client, scope, id(120), api))
    assert.equal(batches.length, 3, "Negative cache entries must not repeat missing lookups")
    assert.equal(client.getQueryCache().find({ queryKey: skillReferenceKeys.entry(scope, id(1)) })?.gcTime, 60000)
  } finally {
    client.clear()
  }
})

test("batch cancellation belongs to live consumers and only aborts HTTP after all remaining readers leave", async () => {
  const client = new QueryClient()
  const { calls, api } = deferredApi()
  const first = new QueryObserver(client, skillReferenceEntryOptions(client, scope, id(1), api))
  const same = new QueryObserver(client, skillReferenceEntryOptions(client, scope, id(1), api))
  const second = new QueryObserver(client, skillReferenceEntryOptions(client, scope, id(2), api))
  const stopFirst = first.subscribe(() => {})
  const stopSame = same.subscribe(() => {})
  const stopSecond = second.subscribe(() => {})
  try {
    await settle()
    assert.equal(calls.length, 1)
    stopFirst()
    assert.equal(calls[0]!.signal.aborted, false)
    stopSame()
    assert.equal(calls[0]!.signal.aborted, false, "A different identity still needs the shared request")
    calls[0]!.finish(page([entity(id(1)), entity(id(2))]))
    await settle()
    assert.equal(client.getQueryData(skillReferenceKeys.entry(scope, id(1))), undefined)
    assert.equal(client.getQueryData<EntityReference>(skillReferenceKeys.entry(scope, id(2)))?.id, id(2))
    const third = new QueryObserver(client, skillReferenceEntryOptions(client, scope, id(3), api))
    const stopThird = third.subscribe(() => {})
    await settle()
    stopThird()
    assert.equal(calls[1]!.signal.aborted, true)
    calls[1]!.finish(page([entity(id(3))]))
    await settle()
    assert.equal(client.getQueryData(skillReferenceKeys.entry(scope, id(3))), undefined)
  } finally {
    stopFirst()
    stopSame()
    stopSecond()
    client.clear()
  }
})

test("account, issuer, ruleset and locale scopes never share pending batches or identity cache entries", async () => {
  const client = new QueryClient()
  let requests = 0
  const api = createSkillReferenceApi(async <T,>() => {
    requests++
    return page([entity(id(1), `request-${requests}`)]) as T
  })
  const scopes = [
    scope,
    { ...scope, subject: "other" },
    { ...scope, issuer: "other" },
    { ...scope, rulesetId: "other" },
    { ...scope, locale: "en-US" },
  ]
  try {
    const results = await Promise.all(
      scopes.map((value) => client.fetchQuery(skillReferenceEntryOptions(client, value, id(1), api))),
    )
    assert.equal(requests, 5)
    assert.equal(new Set(results.map((value) => value!.translations[0]!.name)).size, 5)
  } finally {
    client.clear()
  }
})

test("separate editors own search cancellation while successful search immediately seeds shared identities", async () => {
  const client = new QueryClient()
  const { calls, api } = deferredApi()
  const first = createSkillReferenceSearch(client, scope, "editor-1", api)
  const second = createSkillReferenceSearch(client, scope, "editor-2", api)
  const firstAbort = new AbortController()
  const secondAbort = new AbortController()
  const old = first({ query: "Airi", locale: "vi-VN", page: 0, signal: firstAbort.signal }).catch((error) => error)
  const current = second({ query: "Airi", locale: "vi-VN", page: 0, signal: secondAbort.signal })
  try {
    assert.equal(calls.length, 2)
    firstAbort.abort()
    assert.equal(calls[0]!.signal.aborted, true)
    assert.equal(calls[1]!.signal.aborted, false)
    calls[1]!.finish(page([entity(id(1), "Current")]))
    await current
    assert.equal(
      client.getQueryData<EntityReference>(skillReferenceKeys.entry(scope, id(1)))?.translations[0]!.name,
      "Current",
    )
    calls[0]!.finish(page([entity(id(1), "Stale")]))
    await old
    assert.equal(
      client.getQueryData<EntityReference>(skillReferenceKeys.entry(scope, id(1)))?.translations[0]!.name,
      "Current",
    )
    await client.fetchQuery(skillReferenceEntryOptions(client, scope, id(1), api))
    assert.equal(calls.length, 2, "Preview must reuse the identity supplied by search")
  } finally {
    firstAbort.abort()
    secondAbort.abort()
    client.clear()
  }
})

test("catalog invalidation fences late lookup and search responses before fresh identity data is published", async () => {
  const client = new QueryClient()
  const { calls, api } = deferredApi()
  const search = createSkillReferenceSearch(client, scope, "editor", api)
  const old = search({ query: "Airi", locale: "vi-VN", page: 0, signal: new AbortController().signal }).catch(
    (error) => error,
  )
  try {
    await invalidateReferenceCatalog(client)
    assert.equal(calls[0]!.signal.aborted, true)
    const fresh = search({ query: "Airi", locale: "vi-VN", page: 0, signal: new AbortController().signal })
    calls[1]!.finish(page([entity(id(1), "Fresh")]))
    await fresh
    calls[0]!.finish(page([entity(id(1), "Old")]))
    await old
    assert.equal(
      client.getQueryData<EntityReference>(skillReferenceKeys.entry(scope, id(1)))?.translations[0]!.name,
      "Fresh",
    )
    const obsolete = client.fetchQuery(skillReferenceEntryOptions(client, scope, id(2), api)).catch((error) => error)
    await settle()
    await invalidateReferenceCatalog(client)
    assert.equal(calls[2]!.signal.aborted, true)
    calls[2]!.finish(page([entity(id(2), "Old lookup")]))
    await obsolete
    await settle()
    assert.equal(client.getQueryData(skillReferenceKeys.entry(scope, id(2))), undefined)
  } finally {
    client.clear()
  }
})

test("useSkillReferences resolves only explicit tokens and shares batches across mounted text consumers", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero" })
  const batches: string[][] = []
  currentFetch = async (input) => {
    const path = String(input).replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "fixture-only", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: scope.issuer,
        subject: scope.subject,
        type: "HUMAN",
        displayName: "Editor",
        capabilities: ["catalog:read"],
      })
    if (path.startsWith("/admin/reference-skills?")) {
      const ids = new URL(path, "http://test").searchParams.get("ids")!.split(",")
      batches.push(ids)
      return Response.json(page(ids.filter((value) => value !== id(3)).map((value) => entity(value))))
    }
    throw new Error(`Unexpected request ${path}`)
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    fetch: dispatchFetch,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { useSkillReferences } = await import("../src/features/terminology/use-skill-references")
  const { createRoot } = await import("react-dom/client")
  const client = new QueryClient()
  const root = createRoot(dom.window.document.getElementById("root")!)
  const token = (number: number) => `<ref=skill:${id(number)}>Skill</ref>`
  const rendered = new Map<string, EntityReference[]>()
  function Reader({ name, text }: { name: string; text: string }) {
    const items = useSkillReferences(text, "vi-VN", "standard")
    rendered.set(name, items)
    return <div data-reader={name}>{items.map((value) => value.skillKey).join("|")}</div>
  }
  const render = (include: boolean) =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <Reader name="first" text={include ? token(1) + token(2) + " @Airi" : "Plain text @Airi"} />
          <Reader name="second" text={include ? token(2) + token(3) : "No explicit references"} />
        </QueryClientProvider>,
      ),
    )
  try {
    await verifySession()
    await render(false)
    assert.equal(batches.length, 0)
    await render(true)
    for (
      let attempt = 0;
      attempt < 100 &&
      dom.window.document.querySelector('[data-reader="first"]')?.textContent !== "skill-1-1|skill-1-2";
      attempt++
    )
      await act(async () => {
        await settle()
      })
    assert.equal(dom.window.document.querySelector('[data-reader="first"]')?.textContent, "skill-1-1|skill-1-2")
    assert.equal(dom.window.document.querySelector('[data-reader="second"]')?.textContent, "skill-1-2")
    assert.equal(batches.length, 1)
    assert.deepEqual(new Set(batches[0]), new Set([id(1), id(2), id(3)]))
    assert.equal(client.getQueryData(skillReferenceKeys.entry(scope, id(3))), null)
    const stable = rendered.get("first")
    await render(true)
    assert.equal(rendered.get("first"), stable, "Unchanged query data preserves the reference array across renders")
  } finally {
    await act(async () => root.unmount())
    client.clear()
    await logout()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
