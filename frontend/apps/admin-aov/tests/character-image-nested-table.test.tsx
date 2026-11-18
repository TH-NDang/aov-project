import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"
import type { Request } from "../src/features/publishing/api/publishing-api"
import type { CharacterImageGroup } from "../src/features/media/api/character-image-api"
import { intersectionHarness } from "./fixtures/intersection-observer"
import { createWindow, flush, installWindow, waitFor } from "./fixtures/dom"

test("full-width hero groups load on scroll, keep every candidate and separate expanding, copying and previewing", async () => {
  const dom = createWindow("http://localhost/hero/media")
  const copied: string[] = []
  Object.defineProperty(dom.window.navigator, "clipboard", {
    value: {
      writeText: async (value: string) => {
        copied.push(value)
      },
    },
  })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  let restoreGlobals = () => {}
  const intersections = intersectionHarness()
  const imageCalls: number[] = []
  let finishNextPage: (() => void) | undefined
  const group: CharacterImageGroup = {
    heroId: fixtureRevision.heroId,
    code: "airi",
    name: "Airi",
    actualLocale: "vi-VN",
    revision: fixtureRevision,
    entries: [
      { ownerType: "HERO", skinKey: null, name: "Airi", assetId: null, label: null, main: true, rarityCode: null },
      {
        ownerType: "HERO",
        skinKey: null,
        name: "Airi",
        assetId: "hero-alt",
        label: "airi-portrait-2.png",
        main: false,
        rarityCode: null,
      },
      {
        ownerType: "SKIN",
        skinKey: "skin-a",
        name: "Bạch Vân",
        assetId: null,
        label: null,
        main: true,
        rarityCode: "ss",
      },
      {
        ownerType: "SKIN",
        skinKey: "skin-a",
        name: "Bạch Vân",
        assetId: "skin-alt",
        label: "skin-portrait-2.png",
        main: false,
        rarityCode: "ss",
      },
    ],
  }
  const other: CharacterImageGroup = { ...group, heroId: "other", code: "biron", name: "Biron", entries: [] }
  const content = structuredClone(fixtureContent)
  content.MEDIA_BINDINGS = {
    bindings: {},
    images: { PORTRAIT: [{ assetId: "hero-alt", label: "airi-portrait-2.png" }] },
    sources: [],
  }
  const request: Request = async <T,>(path: string) => {
    if (path === "/admin/rulesets")
      return [{ id: fixtureRevision.rulesetId, code: "aov-standard", description: "" }] as T
    if (path.startsWith("/admin/hero-media?")) {
      const page = Number(new URL(path, "http://fixture").searchParams.get("page"))
      imageCalls.push(page)
      if (page === 1) await new Promise<void>((resolve) => (finishNextPage = resolve))
      return { items: page ? [other] : [group], page, size: 1, totalElements: 2 } as T
    }
    if (path.startsWith("/admin/skin-badges?"))
      return {
        items: [
          {
            id: "badge",
            code: "ss",
            displayName: "Bậc SS",
            iconAssetId: null,
            actualLocale: "vi-VN",
            fallbackApplied: false,
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
      } as T
    if (path === `/admin/heroes/${fixtureRevision.heroId}/revisions/${fixtureRevision.id}`)
      return { revision: fixtureRevision, content } as T
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  const fetcher: typeof fetch = async (input) => {
    const path = new URL(String(input), "http://localhost").pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "fixture", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "reader",
        type: "HUMAN",
        displayName: "Reader",
        capabilities: ["catalog:read"],
      })
    if (path === "/users/me") return Response.json({ locale: "vi-VN" })
    if (path.startsWith("/admin/media/assets/")) {
      const id = path.split("/").at(-1)
      return Response.json({ id, currentVersionId: "v1", versions: [{ id: "v1", url: `/${id}.png` }], provenance: [] })
    }
    throw new Error(`Unexpected fixture fetch: ${path}`)
  }
  restoreGlobals = installWindow(dom.window, {
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    IntersectionObserver: intersections.Observer,
    fetch: fetcher,
  })
  const { CharacterImagesPage } = await import("../src/features/media/pages/character-images-page")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { TooltipProvider } = await import("@aov/ui/components/tooltip")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document

  const click = async (element: Element | null | undefined) => {
    assert.ok(element)
    await act(async () => (element as HTMLElement).click())
  }
  const headers = (table: Element) =>
    Array.from(table.querySelectorAll(":scope > thead th")).map((header) => header.textContent)
  try {
    await verifySession()
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={client}>
            <TooltipProvider>
              <CharacterImagesPage role="PORTRAIT" request={request} />
            </TooltipProvider>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => !!document.querySelector('[aria-label="Mở nhóm ảnh Airi"]'))
    const outer = document.querySelector('[aria-label="Nhóm tướng · Portrait"]')!
    assert.equal(outer.tagName, "DIV")
    assert.equal(outer.querySelectorAll(":scope > section").length, 1)
    assert.deepEqual(imageCalls, [0])
    const sentinel = document.querySelector('[aria-label="Đang tải thêm tướng…"]')!
    const scrollRoot = document.querySelector('[aria-label="Danh sách ảnh Portrait"]')!
    assert.ok(scrollRoot.contains(sentinel))
    assert.equal(intersections.root(sentinel), scrollRoot)
    assert.ok(
      !Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Tải thêm")),
    )
    await act(async () => {
      intersections.intersect(sentinel)
      intersections.intersect(sentinel)
    })
    await waitFor(() => !!finishNextPage)
    assert.deepEqual(imageCalls, [0, 1], "Repeated intersections must not duplicate an in-flight page")
    await waitFor(() => !!sentinel.textContent?.includes("Đang tải thêm tướng"))
    await act(async () => finishNextPage!())
    await waitFor(() => outer.querySelectorAll(":scope > section").length === 2)
    assert.equal(document.querySelector('[aria-label="Đang tải thêm tướng…"]'), null)
    assert.equal(intersections.observing(sentinel), false)
    assert.equal(outer.querySelectorAll(":scope > section").length, 2)
    assert.equal(document.querySelector('table[aria-label="Ảnh tướng Airi"]'), null)
    assert.ok(document.querySelector('[data-hero-identity="airi"] [aria-label="Xem Portrait chính Airi"]'))
    assert.equal(document.querySelector('table[aria-label="Ảnh trang phục Airi"]'), null)
    assert.doesNotMatch(document.body.textContent!, /airi-portrait-2\.png/)
    await click(document.querySelector('[aria-label="Sao chép mã tướng airi"]'))
    assert.deepEqual(copied, ["airi"])
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(document.querySelector('[aria-label="Mở nhóm ảnh Airi"]')?.getAttribute("aria-expanded"), "false")
    const heading = document.querySelector('[aria-label="Mở nhóm ảnh Airi"]')!
    assert.match(heading.textContent!, /2 ảnh/)
    assert.match(heading.textContent!, /1 trang phục/)
    assert.match(heading.textContent!, /Airi/)
    await click(document.querySelector('[aria-label="Mở nhóm ảnh Airi"]'))
    const identity = document.querySelector('[data-hero-identity="airi"]')!
    assert.doesNotMatch(identity.textContent!, /Bậc|Phiên bản|Bản nháp|Đã xuất bản/)
    assert.ok(identity.classList.contains("sticky"))
    assert.ok(identity.classList.contains("top-0"))
    const scroll = identity.closest('[role="region"][aria-label="Danh sách ảnh Portrait"]')!
    assert.ok(scroll.classList.contains("overflow-auto"))
    let ancestor = identity.parentElement
    while (ancestor && ancestor !== scroll) {
      assert.ok(
        !Array.from(ancestor.classList).some((value) => /^overflow-(auto|scroll|x-auto|y-auto)$/.test(value)),
        "A nested scroller must not trap the vertical sticky identity",
      )
      ancestor = ancestor.parentElement
    }
    const heroTable = document.querySelector('table[aria-label="Ảnh tướng Airi"]')!
    const skinTable = document.querySelector('table[aria-label="Ảnh trang phục Airi"]')!
    assert.equal(heroTable.querySelectorAll(":scope > tbody > tr").length, 1)
    assert.equal(skinTable.querySelectorAll(":scope > tbody > tr").length, 2)
    assert.deepEqual(headers(heroTable), ["Portrait", "Tên tệp"])
    assert.deepEqual(headers(skinTable), ["Portrait", "Trang phục", "Tên tệp", "Bậc / Nhãn"])
    assert.equal(document.querySelectorAll("table table").length, 0)
    assert.equal(document.querySelectorAll("button button").length, 0)
    assert.ok(skinTable.querySelector('[aria-label="Xem chi tiết trang phục Bạch Vân"]'))
    assert.match(heroTable.textContent!, /airi-portrait-2\.png/)
    assert.match(skinTable.textContent!, /skin-portrait-2\.png/)
    assert.match(skinTable.textContent!, /Chưa chọn ảnh chính/)
    assert.equal(document.querySelectorAll('a[href^="/hero/"]').length, 0)
    await click(document.querySelector('[aria-label="Sao chép mã trang phục skin-a"]'))
    assert.deepEqual(copied, ["airi", "skin-a"])
    assert.equal(document.querySelector('[role="dialog"]'), null)
    const originalBounds = identity.getBoundingClientRect
    const scroller = scroll as HTMLElement
    identity.getBoundingClientRect = () =>
      ({
        top: identity.querySelector('[aria-expanded="true"]') ? 200 : 200 + 160 - scroller.scrollTop,
      }) as DOMRect
    scroller.scrollTop = 480
    await click(document.querySelector('[aria-label="Thu gọn Airi"]'))
    assert.equal(scroller.scrollTop, 160, "Collapsing a pinned group must keep its header at the same screen position")
    assert.equal(identity.getBoundingClientRect().top, 200)
    assert.equal(document.querySelector('table[aria-label="Ảnh trang phục Airi"]'), null)
    await click(document.querySelector('[aria-label="Mở nhóm ảnh Airi"]'))
    identity.getBoundingClientRect = () => ({ top: 300 }) as DOMRect
    scroller.scrollTop = 60
    await click(document.querySelector('[aria-label="Thu gọn Airi"]'))
    assert.equal(scroller.scrollTop, 60, "A header that has not reached the top must not cause a scroll correction")
    identity.getBoundingClientRect = originalBounds
    await click(document.querySelector('[aria-label="Mở nhóm ảnh Airi"]'))
    await click(document.querySelector('[aria-label="Xem Portrait Airi"]'))
    await waitFor(
      () => document.querySelector('[aria-label="Ảnh đang xem"] img')?.getAttribute("src") === "/hero-alt.png",
    )
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /airi-portrait-2\.png/)

    // A skin head is no longer managed in the image space, even when the response still lists one.
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={client}>
            <TooltipProvider>
              <CharacterImagesPage key="head" role="HEAD" request={request} />
            </TooltipProvider>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => !!document.querySelector('[aria-label="Nhóm tướng · Head"] [aria-label="Mở nhóm ảnh Airi"]'))
    const headGroup = document.querySelector('[aria-label="Mở nhóm ảnh Airi"]')!
    assert.doesNotMatch(headGroup.textContent!, /trang phục/)
    await click(headGroup)
    assert.equal(document.querySelector('table[aria-label="Ảnh trang phục Airi"]'), null)
    assert.ok(document.querySelector('table[aria-label="Ảnh tướng Airi"]'))
    assert.doesNotMatch(document.body.textContent!, /Bạch Vân/)
  } finally {
    await act(async () => finishNextPage?.())
    await act(async () => root.unmount())
    client.clear()
    await logout()
    await flush()
    dom.window.close()
    restoreGlobals()
  }
})
