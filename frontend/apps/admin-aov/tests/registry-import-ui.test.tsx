import assert from "node:assert/strict"
import { test } from "node:test"
import React, { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createMemoryRouter, RouterProvider } from "react-router"

test("file selection previews named records without mutation until the explicit start action", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:5175/tournaments" })
  const values = {
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    BroadcastChannel: undefined,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    DocumentFragment: dom.window.DocumentFragment,
    CustomEvent: dom.window.CustomEvent,
    Event: dom.window.Event,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(values)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { tournamentApi } = await import("../src/features/tournaments/tournament-api")
  const { RegistryImportSheet } = await import("../src/features/tournaments/registry-import")
  const apiOriginal = { list: tournamentApi.list, create: tournamentApi.create }
  let writes = 0
  tournamentApi.list = async (_kind, _signal, filters) => {
    assert.deepEqual(filters, { state: "ALL" })
    return []
  }
  tournamentApi.create = async (_kind, content) => {
    writes++
    return { id: "team", version: 1, createdAt: "", updatedAt: "", missingFields: [], deletedAt: null, content }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const root = createRoot(dom.window.document.getElementById("root")!)
  const router = createMemoryRouter([{ path: "/", element: <RegistryImportSheet onClose={() => {}} /> }])
  const flush = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      ),
    )
    const input = dom.window.document.querySelector<HTMLInputElement>('[aria-label="Chọn file nhập dữ liệu"]')!
    assert.ok(input)
    const text = JSON.stringify({
      schemaVersion: 1,
      teams: [{ content: { code: "verified-team", name: "Verified Team" } }],
    })
    const file = new dom.window.File([text], "teams.json", { type: "application/json" })
    Object.defineProperty(file, "text", { value: async () => text })
    Object.defineProperty(input, "files", { configurable: true, value: [file] })
    await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })))
    await flush()
    assert.match(dom.window.document.body.textContent ?? "", /Verified Team/)
    assert.match(dom.window.document.body.textContent ?? "", /1 mục/)
    assert.equal(writes, 0)
    const button = [...dom.window.document.querySelectorAll<HTMLButtonElement>("button")].find(
      (entry) => entry.textContent?.trim() === "Bắt đầu nhập",
    )!
    assert.ok(button)
    assert.equal(button.disabled, false)
    await act(async () => button.click())
    await flush()
    assert.equal(writes, 1)
    assert.match(dom.window.document.body.textContent ?? "", /Đã nhập xong/)
    assert.match(dom.window.document.body.textContent ?? "", /1 \/ 1/)
  } finally {
    await act(async () => root.unmount())
    await flush()
    router.dispose()
    client.clear()
    tournamentApi.list = apiOriginal.list
    tournamentApi.create = apiOriginal.create
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
