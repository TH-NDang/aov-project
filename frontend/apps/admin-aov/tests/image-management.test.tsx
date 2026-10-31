import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { intersectionHarness } from "./fixtures/intersection-observer"

test("image management loads on scroll, retries without losing rows and filters the whole library after credit corrections", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/image-management", pretendToBeVisual: true })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const intersections = intersectionHarness()
  const missing = new Set([32, 40, 44])
  const calls: { page: number; needsCredit: boolean; type: string | null }[] = []
  let failNextPage = true
  const originals = new Map<string, PropertyDescriptor | undefined>()
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "test", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({ issuer: "fixture", subject: "reader", type: "HUMAN", capabilities: ["catalog:read"] })
    if (path === "/users/me") return Response.json({ locale: "vi-VN" })
    if (path === "/admin/media/assets") {
      const page = Number(url.searchParams.get("page"))
      const size = Number(url.searchParams.get("size"))
      const needsCredit = url.searchParams.get("needsCredit") === "true"
      const type = url.searchParams.get("semanticType")
      calls.push({ page, needsCredit, type })
      if (!needsCredit && !type && page === 1 && failNextPage) {
        failNextPage = false
        return Response.json({ detail: "Temporary image listing failure" }, { status: 503 })
      }
      const rows = Array.from({ length: 45 }, (_, index) => ({
        id: `asset-${index}`,
        semanticType: index === 32 ? "OTHER" : "HERO_HEAD",
        state: "ACTIVE",
        version: 1,
        currentVersionId: `version-${index}`,
        currentUrl: `/fixture-${index}.png`,
        createdAt: "2026-10-29T00:00:00Z",
        updatedAt: "2026-10-29T00:00:00Z",
        sources: [{ label: "Game capture", ownerName: missing.has(index) ? null : "Garena" }],
      })).filter((row, index) => (!needsCredit || missing.has(index)) && (!type || row.semanticType === type))
      return Response.json({
        items: rows.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: rows.length,
      })
    }
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    HTMLInputElement: dom.window.HTMLInputElement,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle,
    IntersectionObserver: intersections.Observer,
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { ImageManagementPage } = await import("../src/features/media/image-management-page")
  const { invalidateMediaAsset } = await import("../src/features/media/media-cache")
  const { createRoot } = await import("react-dom/client")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 150 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition(), document.body.textContent ?? "")
  }
  const rows = () => document.querySelectorAll("tbody tr")
  const sentinel = () => {
    const node = document.querySelector<HTMLElement>('[aria-label="Đang tải thêm ảnh…"]')
    assert.ok(node)
    return node
  }
  const selectType = async (value: string) => {
    const select = document.querySelector("select")!
    await act(async () => {
      select.value = value
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
  }
  try {
    await verifySession()
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <div style={{ overflowY: "auto" }}>
              <ImageManagementPage />
            </div>
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    )
    await waitFor(() => rows().length === 20)
    assert.equal(document.querySelector('[aria-label="Chọn tất cả ảnh đã tải"]'), null)
    assert.ok(!document.body.textContent?.includes("Bổ sung nguồn / credit hàng loạt"))
    assert.equal(calls.length, 1)
    assert.ok(
      ![...document.querySelectorAll("button")].some((button) => ["Trước", "Sau"].includes(button.textContent ?? "")),
    )
    assert.match(document.body.textContent!, /Đã tải 20 \/ 45 ảnh/)

    const firstSentinel = sentinel()
    await act(async () => {
      intersections.intersect(firstSentinel)
      intersections.intersect(firstSentinel)
    })
    await waitFor(() => !!document.querySelector('[role="alert"]'))
    assert.equal(rows().length, 20)
    assert.equal(calls.length, 2)
    await act(async () => intersections.intersect(firstSentinel))
    assert.equal(calls.length, 2)
    const retry = [...document.querySelectorAll("button")].find((button) => button.textContent === "Thử tải lại")!
    await act(async () => retry.click())
    await waitFor(() => rows().length === 40)
    await act(async () => intersections.intersect(sentinel()))
    await waitFor(() => rows().length === 45)
    assert.equal(document.querySelector('[aria-label="Đang tải thêm ảnh…"]'), null)
    assert.match(document.body.textContent!, /Đã tải hết 45 ảnh/)

    const viewButton = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Kiểu xem ảnh"] button')].find(
        (button) => button.textContent?.trim() === label,
      )!
    const callsBeforeViewChange = calls.length
    await act(async () => viewButton("Lưới").click())
    assert.equal(document.querySelectorAll('[aria-label="Lưới ảnh"] > li').length, 45)
    assert.equal(document.querySelector("table"), null)
    assert.equal(calls.length, callsBeforeViewChange)
    const brokenImage = document.querySelector('[aria-label="Lưới ảnh"] img')!
    await act(async () => brokenImage.dispatchEvent(new dom.window.Event("error")))
    assert.ok(document.querySelector('[aria-label="Không tải được ảnh"]'))
    assert.ok(document.querySelector('[aria-label="Xem ảnh asset-0"]'))
    await act(async () => viewButton("Bảng").click())
    assert.equal(rows().length, 45)

    const filter = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    await act(async () => filter.click())
    await waitFor(() => rows().length === 3)
    assert.deepEqual(calls.at(-1), { page: 0, type: null, needsCredit: true })
    assert.ok(document.querySelector('[aria-label="Chi tiết ảnh asset-32"]'))
    assert.match(document.body.textContent!, /Đã tải 3 \/ 3 ảnh/)
    await selectType("HERO_HEAD")
    await waitFor(() => rows().length === 2)
    assert.deepEqual(calls.at(-1), { page: 0, type: "HERO_HEAD", needsCredit: true })

    missing.delete(40)
    await act(async () => {
      await invalidateMediaAsset(client, "asset-40")
    })
    await waitFor(() => rows().length === 1)
    assert.equal(document.querySelector('[aria-label="Chi tiết ảnh asset-40"]'), null)
    assert.ok(document.querySelector('[aria-label="Chi tiết ảnh asset-44"]'))

    await act(async () => filter.click())
    await waitFor(() => rows().length === 20)
    assert.deepEqual(calls.at(-1), { page: 0, type: "HERO_HEAD", needsCredit: false })
    await selectType("ITEM_ICON")
    await waitFor(() => document.body.textContent!.includes("Chưa có ảnh thuộc loại này."))
    await act(async () => filter.click())
    await waitFor(() => document.body.textContent!.includes("Không có ảnh thiếu nguồn hoặc credit trong bộ lọc này."))
    assert.equal(document.querySelector('[aria-label="Đang tải thêm ảnh…"]'), null)
    await act(async () => viewButton("Lưới").click())
    assert.equal(document.querySelector("table"), null)
    assert.match(document.body.textContent!, /Không có ảnh thiếu nguồn hoặc credit trong bộ lọc này/)
    const reset = [...document.querySelectorAll("button")].find((button) => button.textContent === "Xem tất cả ảnh")!
    await act(async () => reset.click())
    await waitFor(() => document.querySelectorAll('[aria-label="Lưới ảnh"] > li').length === 45)
    assert.equal(document.querySelector("select")!.value, "")
    assert.equal(filter.checked, false)
  } finally {
    await act(async () => root.unmount())
    await logout()
    client.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
