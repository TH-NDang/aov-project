import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { HeroRow } from "../src/features/publishing/types"
import { intersectionHarness } from "./fixtures/intersection-observer"

let currentFetch: typeof fetch
const dispatchFetch: typeof fetch = (input, init) => currentFetch(input, init)

async function withSwitcher(run: (ui: Awaited<ReturnType<typeof createSwitcher>>) => Promise<void>) {
  const ui = await createSwitcher()
  try {
    await run(ui)
  } finally {
    await ui.close()
  }
}

async function createSwitcher() {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero/current", pretendToBeVisual: true })
  const intersections = intersectionHarness()
  const heroes: HeroRow[] = Array.from({ length: 21 }, (_, index) => ({
    id: `hero-${index}`,
    code: `code-${index}`,
    revisions: [],
  }))
  const calls: { path: string; signal: AbortSignal | null | undefined }[] = []
  const held = new Map<string, { signal: AbortSignal | null | undefined; finish: () => void }>()
  currentFetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    calls.push({ path: `${path}${url.search}`, signal: init?.signal })
    if (path === "/auth/refresh") return Response.json({ accessToken: "fixture", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        displayName: "Editor",
        capabilities: ["catalog:read", "hero:write"],
      })
    if (path === "/admin/reference-catalog")
      return Response.json({
        rulesetId: "rules",
        items: heroes.map((hero, index) => ({
          id: hero.id,
          kind: "hero",
          iconAssetId: index < 2 ? `head-${index}` : null,
          translations: [
            { locale: "vi-VN", name: `Tướng ${index}`, aliases: [], description: "" },
            { locale: "en-US", name: `Hero ${index}`, aliases: [], description: "" },
          ],
        })),
      })
    if (path.startsWith("/admin/media/assets/")) {
      const id = path.split("/").at(-1)
      return Response.json({ id, currentVersionId: "v1", versions: [{ id: "v1", url: `/heads/${id}.webp` }] })
    }
    if (path === "/admin/heroes") {
      const query = url.searchParams.get("q") ?? ""
      if (query.startsWith("hold"))
        return new Promise<Response>((resolve, reject) => {
          held.set(query, {
            signal: init?.signal,
            finish: () => resolve(Response.json({ items: [], page: 0, size: 20, totalElements: 0 })),
          })
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
            once: true,
          })
        })
      const filtered = query === "wuk" ? [heroes[20]] : query ? [] : heroes
      const page = Number(url.searchParams.get("page") ?? "0")
      return Response.json({
        items: filtered.slice(page * 20, page * 20 + 20),
        page,
        size: 20,
        totalElements: filtered.length,
      })
    }
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IntersectionObserver: intersections.Observer,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    BroadcastChannel: undefined,
    fetch: dispatchFetch,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { HeroQuickSwitcher } = await import("../src/features/publishing/hero-quick-switcher")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const selected: HeroRow[] = []
  const document = dom.window.document
  await verifySession()
  const render = async (disabled = false) =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HeroQuickSwitcher
            heroId="hero-0"
            locale="vi-VN"
            rulesetId="rules"
            disabled={disabled}
            onSelect={(hero) => selected.push(hero)}
          />
        </QueryClientProvider>,
      ),
    )
  const trigger = () => document.querySelector<HTMLButtonElement>('[aria-label="Chuyển tướng nhanh"]')!
  const input = () => document.querySelector<HTMLInputElement>('[aria-label="Tìm tướng để chuyển"]')!
  const rows = () => [...document.querySelectorAll<HTMLButtonElement>("[data-hero-option]")]
  const click = (element: HTMLElement) => act(async () => element.click())
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 150 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    assert.ok(condition(), "Expected quick hero switcher state was not reached")
  }
  return {
    dom,
    document,
    heroes,
    calls,
    held,
    client,
    selected,
    intersections,
    render,
    trigger,
    input,
    rows,
    click,
    waitFor,
    key: (element: HTMLElement, key: string) =>
      act(async () =>
        element.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })),
      ),
    fill: (value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input(), value)
        input().dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      }),
    close: async () => {
      await act(async () => root.unmount())
      client.clear()
      await logout()
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30))
      })
      dom.window.close()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}

test("quick switching loads server pages only while open, joins reference names and lazy heads, and preserves native keyboard navigation", async () => {
  await withSwitcher(
    async ({ document, calls, heroes, intersections, render, trigger, input, rows, click, waitFor, key, selected }) => {
      await render(true)
      await click(trigger())
      assert.equal(input(), null)
      assert.equal(
        calls.some((call) => call.path.startsWith("/admin/heroes") || call.path.startsWith("/admin/reference-catalog")),
        false,
      )
      await render()
      await click(trigger())
      await waitFor(() => rows().length === 20 && rows()[0].getAttribute("aria-label") === "Chuyển sang Tướng 0")
      assert.equal(rows()[0].getAttribute("aria-current"), "true")
      assert.match(rows()[0].textContent!, /Đang xem/)
      assert.equal(calls.filter((call) => call.path.startsWith("/admin/heroes")).length, 1)
      const firstRequest = new URL(calls.find((call) => call.path.startsWith("/admin/heroes"))!.path, "http://fixture")
      assert.equal(firstRequest.searchParams.get("size"), "20")
      assert.equal(firstRequest.searchParams.get("includeUnchanged"), "true")
      assert.equal(firstRequest.searchParams.get("locale"), "vi-VN")
      assert.equal(firstRequest.searchParams.get("rulesetId"), "rules")
      assert.equal(calls.filter((call) => call.path.startsWith("/admin/media/assets/")).length, 0)
      const icon = rows()[0].querySelector("span")!
      const list = document.querySelector('[aria-label="Danh sách chuyển tướng"]')!
      assert.equal(intersections.root(icon), list, "All quick-switch icons share the popup scroll root")
      await act(async () => intersections.intersect(icon))
      await waitFor(() => !!rows()[0].querySelector('img[src="/heads/head-0.webp"]'))
      assert.equal(calls.filter((call) => call.path.startsWith("/admin/media/assets/")).length, 1)
      const sentinel = document.querySelector<HTMLElement>('[aria-label="Đang tải thêm tướng…"]')!
      assert.equal(intersections.root(sentinel), list)
      await act(async () => intersections.intersect(sentinel))
      await waitFor(() => rows().length === 21)
      assert.equal(calls.filter((call) => call.path.startsWith("/admin/heroes")).length, 2)
      assert.equal(document.querySelector('[aria-label="Đang tải thêm tướng…"]'), null)
      await key(input(), "ArrowDown")
      assert.equal(document.activeElement, rows()[0])
      await key(rows()[0], "ArrowDown")
      assert.equal(document.activeElement, rows()[1])
      await key(rows()[1], "Home")
      assert.equal(document.activeElement, rows()[0])
      await key(rows()[0], "ArrowUp")
      assert.equal(document.activeElement, input())
      await click(rows()[20])
      await waitFor(() => !input())
      assert.deepEqual(selected, [heroes[20]])
      await click(trigger())
      await waitFor(() => !!input())
      assert.equal(input().value, "")
      assert.equal(calls.filter((call) => call.path.startsWith("/admin/reference-catalog")).length, 1)
      await render(true)
      assert.equal(input(), null)
      await render(false)
      assert.equal(input(), null, "Finishing an upload must not reopen a previously disabled popup")
      assert.equal(
        calls.some((call) => /\/revisions\//.test(call.path) || call.path.includes("resources")),
        false,
      )
    },
  )
})

test("quick search debounces backend queries, aborts replaced and closed reads, and resets on reopening", async () => {
  await withSwitcher(async ({ calls, held, render, trigger, input, rows, click, waitFor, fill, key }) => {
    await render()
    await click(trigger())
    await waitFor(() => rows().length === 20)
    const before = calls.filter((call) => call.path.startsWith("/admin/heroes")).length
    await fill("w")
    await fill("wu")
    await fill("wuk")
    assert.equal(calls.filter((call) => call.path.startsWith("/admin/heroes")).length, before)
    await waitFor(() => rows().length === 1 && rows()[0].getAttribute("aria-label") === "Chuyển sang Tướng 20")
    assert.equal(
      calls.some((call) => /[?&]q=w(?:&|$)|[?&]q=wu(?:&|$)/.test(call.path)),
      false,
    )
    await fill("hold-first")
    await waitFor(() => held.has("hold-first"))
    await fill("hold-second")
    await waitFor(() => held.has("hold-second"))
    assert.equal(held.get("hold-first")!.signal?.aborted, true)
    await act(async () => held.get("hold-first")!.finish())
    await key(input(), "Escape")
    await waitFor(() => !input())
    assert.equal(held.get("hold-second")!.signal?.aborted, true)
    await click(trigger())
    await waitFor(() => rows().length === 20)
    assert.equal(input().value, "")
  })
})
