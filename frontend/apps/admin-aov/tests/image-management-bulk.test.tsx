import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { intersectionHarness } from "./fixtures/intersection-observer"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"

test("bulk media selection survives scrolling, resets on filtering and applies shared credits with isolated retry", async () => {
  const dom = createWindow("http://localhost/image-management")
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
    if (path === "/admin/media/usage-totals")
      return Response.json({
        states: { SHOWN: 0, DRAFT_ONLY: 0, HISTORY_ONLY: 0, STORED_ONLY: 0, NONE: 0 },
        competitionChecked: true,
      })
    if (path === "/admin/media/assets" && url.searchParams.get("withUsage"))
      return Response.json({ items: [], page: 0, size: 20, totalElements: 0 })
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
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window, {
    IntersectionObserver: intersections.Observer,
    fetch: fetcher,
  })
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { ImageManagementPage } = await import("../src/features/media/pages/image-management-page")
  const { createRoot } = await import("react-dom/client")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document

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
    await click(
      [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Lọc theo nguồn"] button')].find((node) =>
        node.textContent?.includes("Thiếu nguồn"),
      ),
    )
    await waitFor(() => document.body.textContent!.includes("/ 21 ảnh"))
    await click(checkbox("Chọn ảnh bulk-2"))
    await click(checkbox("Chọn ảnh bulk-3"))
    const viewButton = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Kiểu xem ảnh"] button')].find(
        (button) => button.textContent?.trim() === label,
      )!
    await click(viewButton("Lưới"))
    assert.equal(checkbox("Chọn ảnh bulk-2 trong lưới").checked, true)
    assert.equal(checkbox("Chọn ảnh bulk-3 trong lưới").checked, true)
    assert.equal(checkbox("Chọn ảnh bulk-1 trong lưới"), null)
    await click(viewButton("Bảng"))
    assert.equal(checkbox("Chọn ảnh bulk-2").checked, true)
    assert.equal(checkbox("Chọn ảnh bulk-3").checked, true)
    await click(button("Bổ sung nguồn / ghi công hàng loạt"))
    await waitFor(() => !!document.querySelector('[role="dialog"]'))
    assert.equal(document.querySelectorAll('[aria-label="Ảnh được bổ sung nguồn hàng loạt"] li').length, 2)
    await fill("Tên nguồn", "Shared source")
    await fill("Chủ sở hữu / tên cần ghi công", "Shared owner")
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
    restoreGlobals()
  }
})
