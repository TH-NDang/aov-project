import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { createWindow, installWindow } from "./fixtures/dom"

test("hero catalog keeps every loaded row and exposes the hero code and actions at all widths", async () => {
  const dom = createWindow("http://localhost/publishing")
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window)
  const { HeroCatalog } = await import("../src/features/publishing/components/catalog/hero-catalog")
  const { publishingKeys } = await import("@/lib/api/publishing-api")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } } })
  const items = Array.from({ length: 25 }, (_, i) => ({ id: `database-id-${i}`, code: `hero-${i}`, revisions: [] }))
  cache.setQueryData(publishingKeys.heroCatalog({ locale: "vi-VN" }), {
    pages: [
      { items: items.slice(0, 20), page: 0, size: 20, totalElements: 25 },
      { items: items.slice(20), page: 1, size: 20, totalElements: 25 },
    ],
    pageParams: [0, 1],
  })
  try {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={cache}>
            <HeroCatalog ruleset="" locale="vi-VN" />
          </QueryClientProvider>
        </MemoryRouter>,
      )
    })
    const document = dom.window.document
    assert.equal(document.querySelectorAll("tbody tr").length, 25)
    assert.equal(document.querySelectorAll("thead th[scope=col]").length, 5)
    assert.ok([...document.querySelectorAll("tbody tr")].every((row) => row.children.length === 5))
    const heroButton = document.querySelector('button[aria-label="Xem tướng hero-24"]')!
    assert.ok(heroButton)
    assert.equal(heroButton.closest("td")!.querySelectorAll("button, a, [tabindex]").length, 1)
    assert.equal(document.querySelector('button[aria-label="Xem nhanh hero-24"]'), null)
    assert.equal(document.querySelectorAll('[aria-label="Chưa có ảnh head"]').length, 25)
    assert.ok(heroButton.querySelector('[aria-label="Chưa có ảnh head"]'))
    assert.ok(heroButton.querySelector('svg[aria-hidden="true"]'))
    assert.match(heroButton.getAttribute("title")!, /Mở chi tiết/)
    assert.ok(!document.body.textContent?.includes("database-id-"))
    assert.ok(
      ![...document.querySelectorAll("button")].some((button) => ["Trước", "Sau"].includes(button.textContent ?? "")),
    )
  } finally {
    await act(async () => root.unmount())
    cache.clear()
    dom.window.close()
    restoreGlobals()
  }
})
