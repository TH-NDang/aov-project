import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture } from "./fixtures/hero-workspace-data"

test("catalog lists backend heroes, resource items and glossary; filters, mentions and server round-trip work", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/terminology" })
  const fixture = createHeroFixture(true)
  const requests: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input)
    requests.push(url)
    if (url.endsWith("/admin/media/assets/fixture-head"))
      return Response.json({
        id: "fixture-head",
        currentVersionId: "head-v1",
        versions: [{ id: "head-v1", url: "http://localhost:9000/head.png" }],
      })
    const response = await fixture.fetcher(input, init)
    if (url.includes("/admin/heroes?page=")) {
      const data = await response.json()
      for (const hero of data.items)
        hero.revisions = hero.revisions.filter((revision: { state: string }) => revision.state === "DRAFT")
      return Response.json(data)
    }
    if (url.endsWith("/revisions/fixture-draft")) {
      const data = await response.json()
      data.content.MEDIA_BINDINGS.bindings.HEAD = "fixture-head"
      return Response.json(data)
    }
    return response
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    Event: dom.window.Event,
    fetch: fetcher,
    BroadcastChannel: undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { TerminologyPage } = await import("../src/features/terminology/terminology-page")
  const { loadHeroReferences } = await import("../src/features/terminology/catalog")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const waitFor = async (test: () => boolean) => {
    for (let i = 0; i < 150 && !test(); i++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
    assert.ok(test())
  }
  const button = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.trim() === name)!
  const fill = async (node: HTMLInputElement | HTMLTextAreaElement, value: string) =>
    act(async () => {
      const prototype =
        node.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value)
      node.setSelectionRange(value.length, value.length)
      node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  try {
    await verifySession()
    const references = await loadHeroReferences(client)
    assert.equal(references[0]?.translations[0]?.name, "Airi", "Imported drafts are available before publication")
    assert.equal(references[0]?.iconAssetId, "fixture-head")
    assert.equal(
      requests.filter((url) => url.includes("/admin/media/assets/")).length,
      0,
      "The catalog does not eagerly load every head asset",
    )
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/terminology"]}>
            <TerminologyPage />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    )
    await waitFor(() => document.querySelectorAll("tbody tr").length === 3)
    await waitFor(() => !!document.querySelector('img[src="http://localhost:9000/head.png"]'))
    assert.match(document.querySelector("table")!.textContent!, /Airi/)
    assert.match(document.querySelector("table")!.textContent!, /Kiếm QA/)
    assert.match(document.querySelector("table")!.textContent!, /Sát thương chuẩn/)
    const search = document.querySelector<HTMLInputElement>('[aria-label="Tìm danh mục"]')!
    await fill(search, "sat thuong")
    assert.equal(document.querySelectorAll("tbody tr").length, 1)
    await fill(search, "")
    const filter = document.querySelector<HTMLSelectElement>('[aria-label="Lọc loại tham chiếu"]')!
    await act(async () => {
      filter.value = "item"
      filter.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    assert.equal(document.querySelectorAll("tbody tr").length, 1)
    assert.match(document.querySelector("table")!.textContent!, /Kiếm QA/)
    await act(async () => document.querySelector<HTMLButtonElement>("tbody button")!.click())
    const autoItem = [...document.querySelectorAll<HTMLLabelElement>("label")]
      .find((label) => label.textContent?.includes("Tự nhận diện tên trong mô tả"))!
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
    assert.equal(autoItem.checked, false)
    assert.ok(document.body.textContent?.includes("Trang bị mặc định chỉ liên kết khi chọn @"))
    await act(async () => {
      filter.value = "term"
      filter.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await act(async () => document.querySelector<HTMLButtonElement>("tbody button")!.click())
    const area = document.querySelector<HTMLTextAreaElement>('[data-slot="entity-rich-text-editor"] textarea')!
    await fill(area, "@Airi")
    assert.match(document.querySelector('[role="listbox"]')!.textContent!, /Airi/)
    await act(async () =>
      area.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })),
    )
    assert.equal(area.value, "<ref=hero:fixture-hero>Airi</ref>")
    await act(async () => button("Lưu thiết lập").click())
    await waitFor(() => !!document.body.textContent?.includes("Đã lưu trên máy chủ Vite."))
    await act(async () => button("Tải lại").click())
    assert.equal(area.value, "<ref=hero:fixture-hero>Airi</ref>")
    const stored = await (await fixture.fetcher("/__storage/00000000-0000-4000-8000-000000000001")).json()
    assert.equal(stored.version, 2)
    assert.equal(stored.rows[0].settings.entities[0].translations[0].description, area.value)
  } finally {
    await act(async () => root.unmount())
    client.clear()
    await logout()
    await new Promise((resolve) => setTimeout(resolve, 30))
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
