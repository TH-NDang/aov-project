import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Request } from "../src/features/publishing/publishing-api"
import type { ImportContext } from "../src/features/publishing/import-context"
import type { HeroRow, Revision } from "../src/features/publishing/types"
import { fixtureRevision } from "./fixtures/hero-workspace-data"

test("baseline migration confirms first, only moves eligible drafts, and retains per-row failures", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing/import", pretendToBeVisual: true })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    Node: dom.window.Node,
    Element: dom.window.Element,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => {
      throw new Error("The migration regression must use its request fixture")
    },
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { BaselineMigration } = await import("../src/features/publishing/baseline-migration")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const context: ImportContext = {
    contextId: "s3-authoring-context",
    rulesetId: fixtureRevision.rulesetId,
    patchVariantId: "s3-final-patch",
    patchCode: "before-s4",
    seasonId: "s3",
    seasonName: "S3 2026",
    rulesetOrdinal: 3,
    regionId: null,
    regionCode: null,
    effectiveAt: null,
  }
  const draft = (id: string, version: number, extra: Partial<Revision> = {}): Revision => ({
    ...fixtureRevision,
    id: `${id}-draft`,
    heroId: id,
    version,
    effectiveFromPatchVariantId: "incorrect-s4-patch",
    ...extra,
  })
  const eligibleA = draft("airi", 7)
  const eligibleB = draft("aleister", 11)
  const heroes: HeroRow[] = [
    { id: "airi", code: "airi", revisions: [eligibleA] },
    {
      id: "aleister",
      code: "aleister",
      revisions: [eligibleB, draft("aleister-other", 2, { rulesetId: "other-rules", state: "PUBLISHED" })],
    },
    {
      id: "published",
      code: "published",
      revisions: [draft("published", 20), draft("published-history", 1, { state: "PUBLISHED" })],
    },
    { id: "derived", code: "derived", revisions: [draft("derived", 30, { sourceRevisionId: "earlier-revision" })] },
    { id: "correction", code: "correction", revisions: [draft("correction", 40, { cause: "CONTENT_CORRECTION" })] },
    { id: "not-draft", code: "not-draft", revisions: [draft("not-draft", 50, { state: "PUBLISHED" })] },
    { id: "other-rules", code: "other-rules", revisions: [draft("other-rules", 60, { rulesetId: "other-rules" })] },
    {
      id: "already-there",
      code: "already-there",
      revisions: [draft("already-there", 70, { effectiveFromPatchVariantId: context.patchVariantId })],
    },
    { id: "discarded", code: "discarded", revisions: [draft("discarded", 80, { state: "DISCARDED" })] },
  ]
  const mutations: { path: string; body: Record<string, unknown>; settled: boolean }[] = []
  const pageRequests: number[] = []
  const gates: { resolve: (value: Revision) => void; reject: (error: Error) => void }[] = []
  const unexpected: string[] = []
  const request: Request = async <T,>(path: string, init?: RequestInit) => {
    if (path.startsWith("/admin/heroes?page=")) {
      const page = Number(new URL(path, "http://fixture.local").searchParams.get("page"))
      pageRequests.push(page)
      return { items: heroes.slice(page * 3, page * 3 + 3), page, size: 3, totalElements: heroes.length } as T
    }
    const match = /^\/admin\/heroes\/(airi|aleister)\/drafts\/([^/]+)\/baseline-context$/.exec(path)
    if (match && init?.method === "POST") {
      const operation = { path, body: JSON.parse(String(init.body)) as Record<string, unknown>, settled: false }
      mutations.push(operation)
      try {
        const moved = await new Promise<Revision>((resolve, reject) => gates.push({ resolve, reject }))
        heroes.find((hero) => hero.id === match[1])!.revisions[0] = moved
        return moved as T
      } finally {
        operation.settled = true
      }
    }
    unexpected.push(path)
    throw new Error(`Unexpected migration request: ${path}`)
  }
  const busy: boolean[] = []
  const movedAfter: number[] = []
  const document = dom.window.document
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 150 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition(), "Expected migration state was not reached")
  }
  const button = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.includes(text))!
  const click = async (node: HTMLButtonElement) => act(async () => node.click())
  try {
    cache.setQueryData(["publishing-preview", "airi", eligibleA.id], { stale: true })
    cache.setQueryData(["publishing-preview", "aleister", eligibleB.id], { failed: true })
    await act(async () =>
      root.render(
        <QueryClientProvider client={cache}>
          <BaselineMigration
            context={context}
            request={request}
            onBusyChange={(value) => busy.push(value)}
            onMoved={() => movedAfter.push(mutations.filter((operation) => operation.settled).length)}
          />
        </QueryClientProvider>,
      ),
    )
    assert.deepEqual(pageRequests, [])
    const disclosure = document.querySelector("details")!
    await act(async () => {
      disclosure.open = true
      disclosure.dispatchEvent(new dom.window.Event("toggle"))
    })
    await waitFor(() => button("Chuyển các mốc ban đầu")?.disabled === false)
    assert.deepEqual(pageRequests, [0, 1, 2])
    assert.match(disclosure.textContent!, /2 bản nháp có thể chuyển về S3 2026 \/ before-s4/)
    assert.equal(mutations.length, 0)

    await click(button("Chuyển các mốc ban đầu"))
    await waitFor(() => !!document.querySelector('[role="alertdialog"]'))
    assert.match(document.querySelector('[role="alertdialog"]')!.textContent!, /Chuyển 2 mốc dữ liệu ban đầu/)
    assert.equal(mutations.length, 0)
    await click(button("Quay lại"))
    await waitFor(() => !document.querySelector('[role="alertdialog"]'))
    assert.equal(mutations.length, 0)

    await click(button("Chuyển các mốc ban đầu"))
    await click(button("Xác nhận chuyển mốc"))
    await waitFor(() => mutations.length === 1)
    assert.deepEqual(mutations[0], {
      path: `/admin/heroes/airi/drafts/${eligibleA.id}/baseline-context`,
      body: { expectedVersion: 7, contextId: context.contextId },
      settled: false,
    })
    assert.deepEqual(busy, [true])
    assert.deepEqual(movedAfter, [])
    assert.equal(button("Chuyển các mốc ban đầu").disabled, true)
    await act(async () =>
      gates[0].resolve({ ...eligibleA, version: 8, effectiveFromPatchVariantId: context.patchVariantId }),
    )
    await waitFor(() => mutations.length === 2)
    assert.equal(mutations[0].settled, true)
    assert.deepEqual(mutations[1].body, { expectedVersion: 11, contextId: context.contextId })
    assert.equal(mutations[1].path, `/admin/heroes/aleister/drafts/${eligibleB.id}/baseline-context`)
    assert.deepEqual(movedAfter, [])
    await act(async () => gates[1].reject(new Error("Version conflict for this draft")))
    await waitFor(() => movedAfter.length === 1 && busy.at(-1) === false)
    assert.deepEqual(movedAfter, [2])
    assert.deepEqual(busy, [true, false])
    assert.match(disclosure.textContent!, /Đã chuyển 1\/2 bản nháp/)
    assert.match(disclosure.textContent!, /1 bản chưa chuyển được/)
    assert.match(disclosure.textContent!, /aleister: Version conflict for this draft/)
    assert.equal(cache.getQueryData(["publishing-preview", "airi", eligibleA.id]), undefined)
    assert.deepEqual(cache.getQueryData(["publishing-preview", "aleister", eligibleB.id]), { failed: true })
    assert.equal(mutations.length, 2)
    assert.deepEqual(unexpected, [])
  } finally {
    await act(async () => root.unmount())
    cache.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
