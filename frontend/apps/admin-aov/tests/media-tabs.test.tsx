import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HotkeysProvider } from "../src/app/hotkeys"
import { PageTabPanels, PageTabsProvider, usePageTabs } from "../src/app/layout/page-tabs"
import { mediaTabLocation, readMediaTab } from "../src/features/media/media-location"
import type { Request } from "../src/features/publishing/publishing-api"

test("media tab locations preserve filters and keep portrait as the canonical default", () => {
  const filters = new URLSearchParams("ruleset=rule&q=airi&tab=cover")
  assert.equal(readMediaTab(filters), "cover")
  assert.equal(mediaTabLocation(filters, "head"), "/hero/media?ruleset=rule&q=airi&tab=head")
  assert.equal(mediaTabLocation(filters, "portrait"), "/hero/media?ruleset=rule&q=airi")
  assert.equal(readMediaTab(new URLSearchParams("tab=unknown")), "portrait")
  assert.equal(mediaTabLocation(new URLSearchParams(), "portrait"), "/hero/media")
  assert.equal(filters.get("tab"), "cover")
})

test("media query tabs restore back/forward state and legacy links never create separate page sessions", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/media/head?ruleset=rule&q=airi" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  const requests: string[] = []
  const request: Request = async <T,>(path: string) => {
    requests.push(path)
    if (path === "/admin/rulesets") return [{ id: "rule", code: "aov-standard", description: "" }] as T
    if (path.startsWith("/admin/hero-media?") || path.startsWith("/admin/skin-badge-groups?"))
      return { items: [], page: 0, size: 20, totalElements: 0 } as T
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    BroadcastChannel: undefined,
    fetch: async () => {
      throw new Error("Live requests are forbidden in media routing tests")
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { MediaWorkspace, LegacyMediaRedirect } = await import("../src/features/media/media-workspace")
  function SessionLinks() {
    const { sessions } = usePageTabs()
    return (
      <nav aria-label="App page tabs">
        {sessions.map((session) => (
          <a key={session.path} href={session.to}>
            {session.path}
          </a>
        ))}
      </nav>
    )
  }
  function Shell() {
    return (
      <PageTabsProvider>
        <SessionLinks />
        <PageTabPanels />
      </PageTabsProvider>
    )
  }
  const router = createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [
          { path: "/hero/media", element: <MediaWorkspace request={request} /> },
          { path: "/portraits", handle: { pageTab: false }, element: <LegacyMediaRedirect /> },
          { path: "/media/head", handle: { pageTab: false }, element: <LegacyMediaRedirect tab="head" /> },
          { path: "/media/cover", handle: { pageTab: false }, element: <LegacyMediaRedirect tab="cover" /> },
          { path: "/media/badges", handle: { pageTab: false }, element: <LegacyMediaRedirect tab="badges" /> },
        ],
      },
    ],
    { initialEntries: ["/media/head?ruleset=rule&q=airi#image"] },
  )
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 200 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    assert.ok(
      condition(),
      `${router.state.location.pathname}${router.state.location.search}; selected=${selected()}; ${document.body.textContent ?? ""}`,
    )
  }
  const selected = () => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()
  const clickTab = async (label: string) => {
    const tab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (element) => element.textContent?.trim() === label,
    )!
    assert.ok(tab)
    await act(async () => {
      tab.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }))
      ;(tab as HTMLElement).click()
    })
    await waitFor(() => selected() === label)
  }
  const appTabs = () =>
    Array.from(document.querySelectorAll('nav[aria-label="App page tabs"] a')).map((element) =>
      element.getAttribute("href"),
    )
  try {
    await act(async () =>
      root.render(
        <HotkeysProvider>
          <QueryClientProvider client={client}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </HotkeysProvider>,
      ),
    )
    await waitFor(() => selected() === "Head" && requests.some((path) => path.includes("role=HEAD")))
    assert.equal(router.state.location.pathname, "/hero/media")
    assert.equal(router.state.location.hash, "#image")
    assert.equal(appTabs().length, 1)
    assert.ok(appTabs()[0]?.startsWith("/hero/media?"))
    assert.deepEqual(
      [...document.querySelectorAll("h1")].map((heading) => heading.textContent),
      ["Không gian ảnh"],
      "Only the workspace has a heading; its tabs do not add their own",
    )
    await clickTab("Cover")
    await waitFor(() => requests.some((path) => path.includes("role=SPLASH")))
    assert.equal(new URLSearchParams(router.state.location.search).get("tab"), "cover")
    assert.equal(new URLSearchParams(router.state.location.search).get("ruleset"), "rule")
    assert.equal(new URLSearchParams(router.state.location.search).get("q"), "airi")
    await clickTab("Bậc trang phục")
    await waitFor(() => requests.some((path) => path.startsWith("/admin/skin-badge-groups?")))
    assert.equal(appTabs().length, 1)
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => selected() === "Cover")
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => selected() === "Head")
    await act(async () => {
      await router.navigate(1)
    })
    await waitFor(() => selected() === "Cover")
    await clickTab("Portrait")
    await waitFor(() => requests.some((path) => path.includes("role=PORTRAIT")))
    assert.equal(new URLSearchParams(router.state.location.search).has("tab"), false)
    for (const [path, label] of [
      ["/portraits?ruleset=rule&q=airi&tab=head", "Head"],
      ["/media/cover?ruleset=rule&q=skin", "Cover"],
      ["/media/badges?ruleset=rule&q=ss", "Bậc trang phục"],
    ]) {
      await act(async () => {
        await router.navigate(path)
      })
      await waitFor(() => selected() === label && router.state.location.pathname === "/hero/media")
      assert.equal(appTabs().length, 1)
      assert.ok(appTabs().every((to) => to?.startsWith("/hero/media")))
    }
    for (const [typed, destination] of [
      ["", "Bậc trang phục"],
      ["ss limited", "Cover"],
    ]) {
      await act(async () => {
        await router.navigate("/hero/media?ruleset=rule&q=airi&tab=head")
      })
      await waitFor(() => selected() === "Head")
      // The active tab places its search in the workspace header.
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Tìm tướng hoặc mã tướng…"]')!
      assert.equal(input.value, "airi")
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, typed)
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      })
      assert.equal(new URLSearchParams(router.state.location.search).get("q") ?? "", typed)
      await clickTab(destination)
      assert.equal(new URLSearchParams(router.state.location.search).get("q") ?? "", typed)
      const visibleInput = document.querySelector<HTMLInputElement>('input[type="search"]')!
      assert.equal(visibleInput.value, typed)
      await waitFor(() =>
        requests.some(
          (path) =>
            path.startsWith(destination === "Cover" ? "/admin/hero-media?" : "/admin/skin-badge-groups?") &&
            (new URL(path, "http://fixture").searchParams.get("q") ?? "") === typed,
        ),
      )
    }
  } finally {
    await act(async () => root.unmount())
    client.clear()
    router.dispose()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
