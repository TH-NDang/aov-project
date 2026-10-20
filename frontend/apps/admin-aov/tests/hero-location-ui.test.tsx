import assert from "node:assert/strict"
import { test } from "node:test"
import "fake-indexeddb/auto"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture, fixturePreviousRevision } from "./fixtures/hero-workspace-data"
import { draftRepository } from "../src/app/drafts/draft-store"

test("hero links restore a side panel beyond loaded rows, survive reload, and preserve state in full view and browser history", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing", pretendToBeVisual: true })
  const fixture = createHeroFixture(false, true)
  const fetcher: typeof fetch = (input, init) => {
    if (String(input).split("?")[0].endsWith("/admin/heroes")) {
      return Promise.resolve(Response.json({ items: [], page: 0, size: 20, totalElements: 0 }))
    }
    return fixture.fetcher(input, init)
  }
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    DocumentFragment: dom.window.DocumentFragment,
    HTMLInputElement: dom.window.HTMLInputElement,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { PublishingPage } = await import("../src/features/publishing/publishing-page")
  const { createRoot } = await import("react-dom/client")
  let root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const routes = [
    { path: "/hero", element: <PublishingPage /> },
    { path: "/hero/:heroId", element: <PublishingPage /> },
  ]
  let router = createMemoryRouter(routes, {
    initialEntries: ["/hero?search=all", "/hero?search=all&hero=fixture-hero&revision=fixture-draft&tab=media"],
  })
  const document = dom.window.document
  const mount = () =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      ),
    )
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 200 && !condition(); attempt++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    }
    assert.ok(condition(), "Expected URL-backed hero workspace was not reached")
  }
  const click = (selector: string) => act(async () => document.querySelector<HTMLElement>(selector)!.click())
  try {
    await verifySession()
    await mount()
    await waitFor(() => !!document.querySelector("#hero-content-media"))
    assert.ok(document.querySelector('[role="dialog"]'))
    assert.equal(document.querySelectorAll("tbody tr").length, 0)
    await click('[aria-controls="hero-content-skills"]')
    assert.equal(new URLSearchParams(router.state.location.search).get("tab"), "skills")
    await click('[aria-controls="workspace-translations"]')
    const target = [...document.querySelectorAll("label")]
      .find((label) => label.textContent?.includes("Ngôn ngữ dữ liệu"))!
      .querySelector("select")!
    await act(async () => {
      target.value = "th-TH"
      target.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await click('[aria-label="Các phần nội dung"] button:nth-child(2)')
    const restoredUrl = router.state.location.pathname + router.state.location.search
    assert.equal(new URLSearchParams(router.state.location.search).get("target"), "th-TH")
    assert.equal(new URLSearchParams(router.state.location.search).get("section"), "SKILLS")
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => !document.querySelector('[role="dialog"]'))
    await act(async () => {
      await router.navigate(1)
    })
    await waitFor(() => !!document.querySelector('[aria-label="Đối chiếu bản dịch"]'))
    assert.equal(router.state.location.pathname + router.state.location.search, restoredUrl)
    await act(async () => root.unmount())
    router.dispose()
    root = createRoot(document.getElementById("root")!)
    router = createMemoryRouter(routes, { initialEntries: [restoredUrl] })
    await mount()
    await waitFor(() => !!document.querySelector('[aria-label="Đối chiếu bản dịch"]'))
    assert.ok(document.querySelector('[aria-controls="workspace-translations"][aria-selected="true"]'))
    await click('[aria-label="Mở trang tướng đầy đủ"]')
    await waitFor(() => router.state.location.pathname === "/hero/fixture-hero")
    const params = new URLSearchParams(router.state.location.search)
    assert.equal(params.get("hero"), null)
    assert.equal(params.get("view"), "translations")
    assert.equal(params.get("tab"), "skills")
    assert.equal(params.get("target"), "th-TH")
    assert.equal(params.get("section"), "SKILLS")
    await waitFor(() => !!document.querySelector('[aria-label="Đối chiếu bản dịch"]'))
    const nameInput = [...document.querySelectorAll("label")]
      .find((label) => label.textContent === "Tên · th-TH")!
      .querySelector("input")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(
        nameInput,
        "Unsaved translation",
      )
      nameInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    let confirmations = 0
    dom.window.confirm = () => {
      confirmations++
      return false
    }
    const beforeBack = router.state.location.pathname + router.state.location.search
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => router.state.location.pathname === "/hero")
    assert.equal(confirmations, 0, "A recoverable draft should not block internal navigation")
    await waitFor(() => [...document.querySelectorAll("input")].some((input) => input.value === "Unsaved translation"))
    await act(async () => {
      await router.navigate(1)
    })
    await waitFor(() => router.state.location.pathname + router.state.location.search === beforeBack)
    await waitFor(() => [...document.querySelectorAll("input")].some((input) => input.value === "Unsaved translation"))
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => router.state.location.pathname === "/hero")
    assert.equal(new URLSearchParams(router.state.location.search).get("hero"), "fixture-hero")
    await act(async () => root.unmount())
    router.dispose()
    client.setQueryData(["publishing-preview", "fixture-hero", "fixture-previous"], {
      revision: fixturePreviousRevision,
      content: fixture.content,
    })
    root = createRoot(document.getElementById("root")!)
    router = createMemoryRouter(routes, {
      initialEntries: ["/hero/fixture-hero?revision=fixture-previous&tab=media"],
    })
    await mount()
    await waitFor(() => !!document.querySelector("#hero-content-media"))
    assert.equal(new URLSearchParams(router.state.location.search).get("revision"), "fixture-previous")
    assert.equal(
      document.querySelector<HTMLSelectElement>('[aria-label="Phiên bản dữ liệu"]')!.value,
      "fixture-previous",
    )
    assert.equal(fixture.writes.length, 0)
  } finally {
    await act(async () => root.unmount())
    for (const key of Object.keys(draftRepository.store.getState().slots)) await draftRepository.remove(key)
    router.dispose()
    await logout()
    client.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
