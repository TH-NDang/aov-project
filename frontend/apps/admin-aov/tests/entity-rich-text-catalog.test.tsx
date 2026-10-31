import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import {
  fillReferenceInput,
  referenceInput,
  referenceInputValue,
  selectReferenceInput,
} from "./fixtures/reference-input"

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
    const parsed = new URL(url, "http://localhost")
    if (parsed.pathname === "/api/community/v1/admin/reference-catalog")
      return Response.json({
        items: [],
        totalElements: 0,
        page: Number(parsed.searchParams.get("page") ?? 0),
        size: Number(parsed.searchParams.get("size") ?? 20),
      })
    if (parsed.pathname === "/api/wiki/v1/admin/reference-catalog")
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
            id: "fixture-florentino",
            kind: "hero",
            translations: [
              { locale: "vi-VN", name: "Florentino", aliases: [], description: "Canonical hero description" },
            ],
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
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (node) => (node.getAttribute("aria-label") || node.textContent?.trim()) === name,
    )!
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
    assert.equal(
      requests.filter((url) => new URL(url, "http://localhost").pathname === "/api/wiki/v1/admin/reference-catalog")
        .length,
      1,
      "Wiki domains share one compact catalog read",
    )
    assert.equal(
      requests.filter(
        (url) => new URL(url, "http://localhost").pathname === "/api/community/v1/admin/reference-catalog",
      ).length,
      1,
      "The separate community catalog stays bounded and shared between consumers",
    )
    assert.equal(
      requests.some((url) =>
        /\/admin\/(?:heroes|items|enchantments|arcana|spells|teams|players|tournaments|series|games)(?:\/|$)/.test(
          new URL(url, "http://localhost").pathname,
        ),
      ),
      false,
      "Reference loading does not download full catalogs or individual hero revisions",
    )
    assert.equal(
      requests.some((url) => url.includes("/data/trang-bi.json")),
      false,
    )
    const aliasAction = document.querySelector<HTMLButtonElement>('[aria-label="Sửa tên gọi khác của Florentino"]')!
    assert.ok(aliasAction)
    await act(async () => aliasAction.click())
    const aliases = document.querySelector<HTMLTextAreaElement>('[aria-label="Tên gọi khác của tướng"]')!
    assert.ok(aliases)
    await act(async () => aliases.click())
    assert.equal(
      document.querySelector('[data-slot="sheet-content"]'),
      null,
      "Clicking the alias popup must not open the underlying reference row",
    )
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value")!.set!.call(aliases, "flo")
      aliases.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    await act(async () => button("Lưu tên gọi khác").click())
    await waitFor(() => !document.querySelector('[aria-label="Tên gọi khác của tướng"]'))
    const aliasSettings = await (await fixture.fetcher("/api/wiki/v1/admin/reference-settings")).json()
    const florentino = aliasSettings.settings.entities.find(
      (entity: { id: string }) => entity.id === "fixture-florentino",
    )
    assert.deepEqual(florentino.translations[0], {
      locale: "vi-VN",
      name: "Florentino",
      aliases: ["flo"],
      description: "Canonical hero description",
    })
    assert.match(document.querySelector("table")!.textContent!, /flo/)
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Chỉnh sửa Florentino"]')!.click())
    const heroSheet = document.querySelector('[data-slot="sheet-content"]')!
    assert.ok(heroSheet)
    assert.equal(
      heroSheet.querySelector("textarea"),
      null,
      "The full hero Sheet must not expose a second merged alias editor",
    )
    await act(async () =>
      heroSheet.querySelector<HTMLButtonElement>('[aria-label="Sửa tên gọi khác của Florentino"]')!.click(),
    )
    const clearingAliases = document.querySelector<HTMLTextAreaElement>('[aria-label="Tên gọi khác của tướng"]')!
    assert.equal(clearingAliases.value, "flo")
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value")!.set!.call(clearingAliases, "")
      clearingAliases.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    await act(async () => button("Lưu tên gọi khác").click())
    await waitFor(() => !document.querySelector('[aria-label="Tên gọi khác của tướng"]'))
    const clearedSettings = await (await fixture.fetcher("/api/wiki/v1/admin/reference-settings")).json()
    assert.equal(
      clearedSettings.settings.entities.some((entity: { id: string }) => entity.id === "fixture-florentino"),
      false,
    )
    await act(async () => button("Close").click())
    assert.equal(document.querySelector("table")!.textContent!.includes("flo"), false)
    const search = document.querySelector<HTMLInputElement>('[aria-label="Tìm danh mục"]')!
    await fill(search, "kiem")
    assert.equal(document.querySelectorAll("tbody tr").length, 1)
    await fill(search, "")
    assert.equal(document.querySelector('[aria-label="Lọc trạng thái tham chiếu"]'), null)
    await act(async () => button("Trang bị").click())
    assert.equal(document.querySelectorAll("tbody tr").length, 1)
    assert.match(document.querySelector("table")!.textContent!, /Kiếm QA/)
    const language = document.querySelector<HTMLSelectElement>('[aria-label="Ngôn ngữ danh mục"]')!
    const changeLanguage = async (value: string) => {
      await act(async () => {
        language.value = value
        language.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
      })
    }
    await changeLanguage("en-US")
    assert.match(document.querySelector("table")!.textContent!, /QA Sword/)
    assert.equal(button("Thiếu bản dịch"), undefined, "Translation filter follows the selected reference kind")
    await act(async () => button("Tướng").click())
    assert.match(button("Thiếu bản dịch").textContent!, /2/)
    await act(async () => button("Thiếu bản dịch").click())
    assert.equal(document.querySelectorAll("tbody tr").length, 2)
    await changeLanguage("vi-VN")
    assert.equal(document.querySelectorAll("tbody tr").length, 0)
    await act(async () => button("Bỏ bộ lọc").click())
    assert.ok(document.querySelectorAll("tbody tr").length > 2)
    assert.equal(button("Tất cả").getAttribute("aria-pressed"), "true")
    await act(async () => button("Trang bị").click())
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
    assert.equal(stored.version, 4)
    assert.equal(
      stored.settings.entities.find((entity: { kind: string }) => entity.kind === "term").translations[0].description,
      referenceInputValue(area),
    )
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
    await act(async () => selectReferenceInput(previewInput, 0, latestPreview.length))
    await act(async () => button("Đậm").click())
    assert.equal(referenceInputValue(previewInput), `<b>${latestPreview}</b>`)
    await act(async () => button("Xếp dọc").click())
    assert.equal(referenceInput(document), previewInput, "Layout changes retain the editor and its history")
    await act(async () => button("Hai cột").click())
    await act(async () => button("Hoàn tác").click())
    assert.equal(referenceInputValue(previewInput), latestPreview)
    await act(async () => button("Làm lại").click())
    assert.equal(referenceInputValue(previewInput), `<b>${latestPreview}</b>`)
    await act(async () => button("Xóa nội dung thử").click())
    assert.equal(referenceInputValue(previewInput), "")
    await act(async () => button("Khôi phục nội dung").click())
    assert.equal(referenceInputValue(previewInput), `<b>${latestPreview}</b>`)
    await act(async () => button("Ví dụ").click())
    assert.ok(referenceInputValue(previewInput).startsWith(`<b>${latestPreview}</b>\n\n`))
    await act(async () => button("Wiki").click())
    assert.equal(button("Wiki").getAttribute("aria-pressed"), "true")
    await act(async () => button("Chèn tham chiếu").click())
    assert.match(document.querySelector('[role="listbox"]')!.textContent!, /Airi/)
    await act(async () => button("Đóng gợi ý").click())
    assert.equal(
      (await (await fixture.fetcher("/api/wiki/v1/admin/reference-settings")).json()).version,
      4,
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
