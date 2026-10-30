import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { intersectionHarness } from "./fixtures/intersection-observer"

test("bulk media selection survives scrolling, resets on filtering and applies shared credits with isolated retry", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/image-management", pretendToBeVisual: true })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const intersections = intersectionHarness()
  const saved = new Set<string>()
  const writes: { id: string; body: Record<string, unknown> }[] = []
  let fail = true
  const asset = (index: number) => ({
    id: `bulk-${index}`,
    semanticType: "OTHER",
    state: index === 1 ? "BLOCKED" : "ACTIVE",
    version: 1,
    currentVersionId: index === 0 ? null : `version-${index}`,
    currentUrl: `/image-${index}.png`,
    createdAt: "2026-10-29T00:00:00Z",
    updatedAt: "2026-10-29T00:00:00Z",
    sources: [{ label: "Original source", ownerName: saved.has(`bulk-${index}`) ? "Shared owner" : null }],
  })
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "test", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        capabilities: ["catalog:read", "media:write"],
      })
    if (path === "/users/me") return Response.json({ locale: "vi-VN" })
    if (path === "/admin/media/assets") {
      const page = Number(url.searchParams.get("page")),
        size = Number(url.searchParams.get("size"))
      const rows = Array.from({ length: 22 }, (_, index) => asset(index)).filter(
        (row) => url.searchParams.get("needsCredit") !== "true" || (!!row.currentVersionId && !saved.has(row.id)),
      )
      return Response.json({
        items: rows.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: rows.length,
      })
    }
    const match = path.match(/^\/admin\/media\/assets\/bulk-(\d+)(?:\/versions\/version-\d+\/sources)?$/)
    if (match) {
      const row = asset(Number(match[1]))
      if (init?.method === "POST") {
        writes.push({ id: row.id, body: JSON.parse(String(init.body)) })
        if (row.id === "bulk-3" && fail) {
          fail = false
          return Response.json({ code: "TEMPORARY_FAILURE", status: 503 }, { status: 503 })
        }
        saved.add(row.id)
      }
      return Response.json(row)
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
    getComputedStyle: dom.window.getComputedStyle,
    IntersectionObserver: intersections.Observer,
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
  const { ImageManagementPage } = await import("../src/features/media/image-management-page")
  const { createRoot } = await import("react-dom/client")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const waitFor = async (condition: () => boolean) => {
    for (let i = 0; i < 150 && !condition(); i++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition(), document.body.textContent ?? "")
  }
  const click = async (node: HTMLElement | null | undefined) => {
    assert.ok(node)
    await act(async () => node.click())
  }
  const checkbox = (label: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
  const button = (text: string, scope: ParentNode = document) =>
    [...scope.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent === text)
  const fill = async (label: string, value: string) => {
    const field = [...document.querySelectorAll("[role=dialog] label")]
      .find((node) => node.textContent?.trim() === label)
      ?.querySelector("input")
    assert.ok(field)
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(field, value)
      field.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
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
    await waitFor(() => document.querySelectorAll("tbody tr").length === 20)
    assert.equal(checkbox("Chọn ảnh bulk-0").disabled, true)
    assert.equal(checkbox("Chọn ảnh bulk-1").disabled, true)
    await click(checkbox("Chọn tất cả ảnh đã tải"))
    assert.match(document.body.textContent!, /Đã chọn 18 ảnh/)
    await act(async () => intersections.intersect(document.querySelector('[aria-label="Đang tải thêm ảnh…"]')!))
    await waitFor(() => document.querySelectorAll("tbody tr").length === 22)
    assert.match(document.body.textContent!, /Đã chọn 18 ảnh/)
    assert.equal(checkbox("Chọn tất cả ảnh đã tải").indeterminate, true)
    assert.equal(checkbox("Chọn ảnh bulk-20").checked, false)
    await click(checkbox("Chọn tất cả ảnh đã tải"))
    assert.match(document.body.textContent!, /Đã chọn 20 ảnh/)

    const type = document.querySelector("select")!
    await act(async () => {
      type.value = "OTHER"
      type.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await waitFor(() => !document.body.textContent!.includes("Đã chọn") && !!checkbox("Chọn ảnh bulk-2"))
    const sourceFilter = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    await click(sourceFilter)
    await waitFor(() => document.body.textContent!.includes("/ 21 ảnh"))
    await click(checkbox("Chọn ảnh bulk-2"))
    await click(checkbox("Chọn ảnh bulk-3"))
    await click(button("Bổ sung nguồn / credit hàng loạt"))
    await waitFor(() => !!document.querySelector('[role="dialog"]'))
    assert.equal(document.querySelectorAll('[aria-label="Ảnh được bổ sung nguồn hàng loạt"] li').length, 2)
    await fill("Tên nguồn", "Shared source")
    await fill("Chủ sở hữu / tên cần credit", "Shared owner")
    await fill("URL nguồn ảnh", "https://example.com/source")
    await fill("Trang liên hệ của bên cung cấp (nếu có)", "https://example.com/contact")
    await click(button("Áp dụng cho 2 ảnh"))
    await waitFor(() => !!button("Thử lại / tiếp tục 1 ảnh") && !button("Thử lại / tiếp tục 1 ảnh")!.disabled)
    assert.match(document.body.textContent!, /Đã lưu 1 \/ 2 ảnh/)
    assert.equal(writes.length, 2)
    assert.equal(writes[0].body.label, "Shared source")
    assert.equal(writes[0].body.ownerName, "Shared owner")
    assert.equal(writes[0].body.contactUrl, "https://example.com/contact")
    await click(button("Thử lại / tiếp tục 1 ảnh"))
    await waitFor(() => document.body.textContent!.includes("Đã lưu 2 / 2 ảnh") && !!button("Đóng"))
    assert.equal(writes.filter((write) => write.id === "bulk-2").length, 1)
    assert.equal(writes.filter((write) => write.id === "bulk-3").length, 2)
    await click(button("Đóng", document.querySelector('[role="dialog"]')!))
    await waitFor(() => !document.querySelector('[role="dialog"]'))
    // The selection bar only shows while images are selected.
    assert.doesNotMatch(document.body.textContent!, /Đã chọn/)
    assert.equal(checkbox("Chọn ảnh bulk-2"), null)
    assert.equal(checkbox("Chọn ảnh bulk-3"), null)
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
