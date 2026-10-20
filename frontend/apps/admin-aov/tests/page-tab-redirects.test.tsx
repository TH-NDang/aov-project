import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act, useEffect } from "react"
import { createMemoryRouter, Navigate, RouterProvider } from "react-router"
import { HotkeysProvider } from "../src/app/hotkeys"
import { PageTabPanels, PageTabsProvider, usePageTabs } from "../src/app/layout/page-tabs"
import type { RouteHandle } from "../src/app/layout/site-header"

test("redirect-only routes execute without opening ghost tabs or remounting existing page sessions", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/heroes/airi?tab=skins" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const observedTabs: string[][] = []
  function Tabs() {
    const { sessions } = usePageTabs()
    useEffect(() => {
      observedTabs.push(sessions.map((session) => session.path))
    }, [sessions])
    return (
      <nav>
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
        <Tabs />
        <PageTabPanels />
      </PageTabsProvider>
    )
  }
  const transientHandle = { pageTab: false } satisfies RouteHandle
  const router = createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [
          { path: "/hero", element: <input aria-label="Hero draft" defaultValue="Saved session" /> },
          { path: "/other", element: <p>Another page</p> },
          { path: "/heroes/*", handle: transientHandle, element: <Navigate to="/hero" replace /> },
          { path: "/skins/*", handle: transientHandle, element: <Navigate to="/hero" replace /> },
          { path: "/reference/skins/*", handle: transientHandle, element: <Navigate to="/hero" replace /> },
        ],
      },
    ],
    { initialEntries: ["/heroes/airi?tab=skins"] },
  )
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const flush = async () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  const navigate = async (to: string) => {
    await act(async () => {
      await router.navigate(to)
    })
    await flush()
  }
  const tabs = () => [...document.querySelectorAll("nav a")].map((anchor) => anchor.getAttribute("href"))
  try {
    await act(async () =>
      root.render(
        <HotkeysProvider>
          <RouterProvider router={router} />
        </HotkeysProvider>,
      ),
    )
    await flush()
    assert.equal(router.state.location.pathname, "/hero")
    assert.equal(router.state.location.search, "")
    assert.deepEqual(tabs(), ["/hero"])
    assert.equal(document.querySelectorAll("[data-page-tab]").length, 1)
    const draft = document.querySelector<HTMLInputElement>('[aria-label="Hero draft"]')!
    draft.value = "Unfinished edit"
    const publishingPanel = draft.closest("[data-page-tab]")

    await navigate("/other")
    assert.deepEqual(tabs(), ["/hero", "/other"])
    for (const legacy of ["/skins?q=limited", "/reference/skins?portrait=missing", "/heroes/unknown?tab=skills"]) {
      await navigate(legacy)
      assert.equal(router.state.location.pathname, "/hero")
      assert.deepEqual(tabs(), ["/hero", "/other"])
      assert.equal(document.querySelectorAll("[data-page-tab]").length, 2)
      assert.equal(document.querySelector('[aria-label="Hero draft"]'), draft)
      assert.equal(draft.value, "Unfinished edit")
      assert.equal(draft.closest("[data-page-tab]"), publishingPanel)
    }
    assert.ok(observedTabs.every((paths) => paths.every((path) => ["/hero", "/other"].includes(path))))
  } finally {
    await act(async () => root.unmount())
    router.dispose()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
