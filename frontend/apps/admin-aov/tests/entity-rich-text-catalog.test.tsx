import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import { fillReferenceInput, referenceInput, referenceInputValue } from "./fixtures/reference-input"

test("catalog lists backend heroes, warehouse items and glossary; filters, mentions and server round-trip work", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/terminology", pretendToBeVisual: true })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const fixture = createHeroFixture(true)
  const requests: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input)
    requests.push(url)
    if (url.includes("/admin/reference-catalog"))
      return Response.json({
        items: [
          {
            id: "fixture-hero",
            kind: "hero",
            iconAssetId: "fixture-head",
            translations: [{ locale: "vi-VN", name: "Airi", aliases: [], description: "Ninja rồng" }],
            destinations: { admin: "/hero/fixture-hero?revision=fixture-draft" },
          },
          {
            id: "7c407f1b-cb6a-47ca-aeb8-7cc72753074d",
            kind: "item",
            autoMatch: false,
            translations: [
              { locale: "vi-VN", name: "Kiếm QA", aliases: [], description: "Trang bị tổng hợp cho QA." },
              { locale: "en-US", name: "QA Sword", aliases: [], description: "Test equipment" },
            ],
          },
        ],
        rulesetId: "fixture-rules",
      })
    if (url.endsWith("/admin/media/assets/fixture-head"))
      return Response.json({
        id: "fixture-head",
        currentVersionId: "head-v1",
        currentUrl: "http://localhost:9000/head.png",
        versions: [{ id: "head-v1", url: "http://localhost:9000/head.png" }],
      })
    return fixture.fetcher(input, init)
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    Element: dom.window.Element,
    HTMLInputElement: dom.window.HTMLInputElement,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MouseEvent: dom.window.MouseEvent,
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
  const fill = async (node: HTMLInputElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(node, value)
      node.setSelectionRange(value.length, value.length)
      node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  try {
    await verifySession()
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/terminology"]}>
            <TerminologyPage />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    )
    await waitFor(() => document.querySelectorAll("tbody tr").length === 1)
    await act(async () =>
      button("Tham chiếu danh mục").dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 })),
    )
    await waitFor(() => !!document.querySelector('img[src="http://localhost:9000/head.png"]'))
    assert.match(document.querySelector("table")!.textContent!, /Airi/)
    assert.match(document.querySelector("table")!.textContent!, /Kiếm QA/)
    assert.equal(document.querySelector("table")!.textContent!.includes("Sát thương chuẩn"), false)
    assert.equal(requests.filter((url) => url.includes("/admin/reference-catalog")).length, 1)
    assert.equal(
      requests.some((url) => /\/admin\/(?:heroes|items|enchantments|arcana|spells)[/?]/.test(url)),
      false,
      "Reference loading does not download full catalogs or individual hero revisions",
    )
    assert.equal(
      requests.some((url) => url.includes("/data/trang-bi.json")),
      false,
    )
    const search = document.querySelector<HTMLInputElement>('[aria-label="Tìm danh mục"]')!
    await fill(search, "kiem")
    assert.equal(document.querySelectorAll("tbody tr").length, 1)
    await fill(search, "")
    assert.equal(document.querySelector('[aria-label="Lọc trạng thái tham chiếu"]'), null)
    await act(async () => button("Trang bị").click())
    assert.equal(document.querySelectorAll("tbody tr").length, 1)
    assert.match(document.querySelector("table")!.textContent!, /Kiếm QA/)
    await act(async () => document.querySelector<HTMLButtonElement>("tbody button")!.click())
    const autoItem = [...document.querySelectorAll<HTMLLabelElement>("label")]
      .find((label) => label.textContent?.includes("Tự nhận diện tên trong mô tả"))!
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
    assert.equal(autoItem.checked, false)
    assert.ok(document.body.textContent?.includes("Trang bị mặc định chỉ liên kết khi chọn @"))
    await act(async () => button("Close").click())
    await act(async () =>
      button("Thuật ngữ").dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 })),
    )
    await act(async () => document.querySelector<HTMLButtonElement>("tbody button")!.click())
    const area = referenceInput(document)
    await act(async () => fillReferenceInput(area, "@Airi"))
    assert.match(document.querySelector('[role="listbox"]')!.textContent!, /Airi/)
    await act(async () =>
      area.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })),
    )
    assert.equal(referenceInputValue(area), "<ref=hero:fixture-hero>Airi</ref>")
    assert.ok(area.querySelector('[data-reference-kind="hero"][data-reference-id="fixture-hero"]'))
    assert.ok(area.textContent?.includes("Airi"), "The editable input displays a chip label")
    assert.equal(area.textContent?.includes("<ref="), false, "Raw reference syntax is hidden while editing")
    await act(async () => button("Lưu thay đổi").click())
    await waitFor(() => !!document.body.textContent?.includes("Đã lưu. Admin và wiki dùng chung thiết lập này."))
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Tải lại thiết lập"]')!.click())
    assert.equal(referenceInputValue(area), "<ref=hero:fixture-hero>Airi</ref>")
    const stored = await (await fixture.fetcher("/api/wiki/v1/admin/reference-settings")).json()
    assert.equal(stored.version, 2)
    assert.equal(stored.settings.entities[0].translations[0].description, referenceInputValue(area))
    await act(async () => button("Close").click())
    assert.match(document.querySelector("tbody")!.textContent!, /Airi/)
    assert.equal(
      document.querySelector("tbody")!.textContent!.includes("<ref="),
      false,
      "Definition summaries display reference labels instead of serialized markup",
    )
    await act(async () =>
      button("Thử hiển thị").dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 })),
    )
    assert.ok(document.querySelector('[role="toolbar"][aria-label="Định dạng Nội dung thử"]'))
    await act(async () => button("Ví dụ").click())
    assert.match(referenceInputValue(referenceInput(document)), /sát thương phép/)
    assert.ok(document.body.textContent?.includes("Kết quả hiển thị"))
    assert.equal(document.querySelector('[aria-label="Nguồn xem trước"]'), null)
    const previewInput = referenceInput(document)
    const latestPreview = "Nội dung mới nhất sau khi gõ liên tục"
    await act(async () => {
      fillReferenceInput(previewInput, "Nội dung cũ")
      fillReferenceInput(previewInput, "Nội dung đang gõ")
      fillReferenceInput(previewInput, latestPreview)
    })
    assert.equal(referenceInputValue(previewInput), latestPreview, "Typing retains the latest editable value")
    await waitFor(() => document.querySelector('[data-slot="entity-rich-text"]')?.textContent === latestPreview)
    assert.equal(
      (await (await fixture.fetcher("/api/wiki/v1/admin/reference-settings")).json()).version,
      2,
      "Deferred preview updates do not save changes to the shared settings",
    )
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
