import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"
import type { Request } from "../src/features/publishing/publishing-api"
import type { CharacterImageGroup, SkinBadgeRecord } from "../src/features/media/character-image-api"

test("backend media groups retain missing main rows, select alternatives with expected version and protect published bindings", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/portraits" })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  const saves: Record<string, unknown>[] = []
  const content = structuredClone(fixtureContent)
  content.MEDIA_BINDINGS = {
    bindings: { HEAD: "other-role" },
    images: { PORTRAIT: [{ assetId: "alt", label: "airi-portrait-2.png" }] },
    sources: [],
  }
  let published = false
  let relatedCalls = 0
  const group: CharacterImageGroup = {
    heroId: fixtureRevision.heroId,
    code: "airi",
    name: "Airi",
    actualLocale: "vi-VN",
    revision: { ...fixtureRevision, version: 5 },
    entries: [
      { ownerType: "HERO", skinKey: null, name: "Airi", assetId: null, label: null, main: true, rarityCode: null },
      {
        ownerType: "HERO",
        skinKey: null,
        name: "Airi",
        assetId: "alt",
        label: "airi-portrait-2.png",
        main: false,
        rarityCode: null,
      },
      {
        ownerType: "SKIN",
        skinKey: "default",
        name: "Mặc định",
        assetId: null,
        label: null,
        main: true,
        rarityCode: null,
      },
    ],
  }
  const badge: SkinBadgeRecord = {
    id: "badge",
    code: "ss",
    displayName: "SS",
    iconAssetId: null,
    kind: "UNKNOWN",
    version: 9,
    translations: [
      { locale: "vi-VN", displayName: "SS Việt Nam", iconAssetId: "vn-icon" },
      { locale: "en-US", displayName: "SS", iconAssetId: null },
    ],
    actualLocale: "en-US",
    fallbackApplied: false,
    skinCount: 1,
  }
  const request: Request = async <T,>(path: string, init?: RequestInit) => {
    if (path === "/admin/rulesets")
      return [{ id: fixtureRevision.rulesetId, code: "aov-standard", description: "" }] as T
    if (path.startsWith("/admin/hero-media?")) return { items: [group], page: 0, size: 20, totalElements: 1 } as T
    if (path === `/admin/heroes/${group.heroId}/revisions/${group.revision.id}`)
      return { revision: { ...group.revision, state: published ? "PUBLISHED" : "DRAFT" }, content } as T
    if (init?.method === "PUT") {
      saves.push(JSON.parse(String(init.body)))
      return group.revision as T
    }
    if (path.includes("/skin-badges/badge/skins?")) {
      relatedCalls++
      return {
        items: [
          {
            heroId: group.heroId,
            heroCode: "airi",
            heroName: "Airi",
            skinKey: "default",
            skinName: "Mặc định",
            revisionId: group.revision.id,
            artAssetId: null,
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
      } as T
    }
    if (path.startsWith("/admin/skin-badges?")) return { items: [badge], page: 0, size: 20, totalElements: 1 } as T
    if (path.startsWith("/admin/skin-badge-groups?"))
      return {
        items: [
          {
            id: null,
            code: "__ungrouped",
            kind: null,
            version: 0,
            translations: [],
            displayName: null,
            actualLocale: null,
            fallbackApplied: true,
            badgeCount: 1,
            matchedByGroup: false,
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
      } as T
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  const fetcher: typeof fetch = async (input) => {
    const path = new URL(String(input), "http://localhost").pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "test", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        displayName: "Editor",
        capabilities: ["hero:write"],
      })
    if (path === "/users/me") return Response.json({ locale: "vi-VN" })
    if (path.startsWith("/admin/media/assets/"))
      return Response.json({ id: path.split("/").at(-1), currentUrl: "/fixture.png", provenance: [] })
    throw new Error(`Unexpected fixture fetch: ${path}`)
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
    HTMLSelectElement: dom.window.HTMLSelectElement,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
    cancelAnimationFrame: clearTimeout,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { CharacterImagesPage } = await import("../src/features/media/character-images-page")
  const { BadgesPage } = await import("../src/features/media/badges-page")
  const { SkinBadgeEditor } = await import("../src/features/media/skin-badge-editor")
  const { createRoot } = await import("react-dom/client")
  const { TooltipProvider } = await import("@aov/ui/components/tooltip")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document
  const waitFor = async (condition: () => boolean) => {
    for (let count = 0; count < 150 && !condition(); count++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition(), document.body.textContent ?? "")
  }
  const click = async (button: Element | undefined | null) => {
    assert.ok(button)
    await act(async () => (button as HTMLElement).click())
  }
  const button = (label: string) =>
    Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.includes(label))
  const render = async (element: React.ReactNode) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={client}>
            <TooltipProvider>{element}</TooltipProvider>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
  try {
    await verifySession()
    await render(<CharacterImagesPage role="PORTRAIT" request={request} />)
    await waitFor(() => !!document.querySelector('[aria-label="Mở nhóm ảnh Airi"]'))
    assert.equal(document.querySelectorAll('a[href^="/hero/"]').length, 0)
    assert.equal(document.querySelector('[aria-label="Mở trang tướng"]'), null)
    assert.equal(document.querySelector('table[aria-label="Nhóm tướng · Portrait"]'), null)
    assert.ok(document.querySelector('section[aria-label="Nhóm ảnh Airi"]'))
    assert.equal(document.querySelector('table[aria-label="Ảnh trang phục Airi"]'), null)
    assert.match(document.body.textContent!, /Chưa chọn ảnh chính/)
    assert.doesNotMatch(document.body.textContent!, /airi-portrait-2\.png/)
    await click(document.querySelector('[aria-label="Mở nhóm ảnh Airi"]'))
    assert.match(document.body.textContent!, /airi-portrait-2\.png/)
    assert.match(document.body.textContent!, /Mặc định/)
    await click(document.querySelector('[aria-label="Xem Portrait Airi"]'))
    await waitFor(() => !!button("Dùng ảnh này làm ảnh chính"))
    await click(button("Dùng ảnh này làm ảnh chính"))
    await waitFor(() => saves.length === 1)
    assert.equal(saves[0].expectedDraftVersion, 5)
    assert.deepEqual(saves[0].bindings, { HEAD: "other-role", PORTRAIT: "alt" })
    assert.deepEqual(saves[0].images, { PORTRAIT: [{ assetId: "alt", label: "airi-portrait-2.png" }] })
    published = true
    await click(document.querySelector('[aria-label="Xem Portrait Airi"]'))
    await waitFor(() => document.body.textContent?.includes("Bản đã xuất bản được giữ nguyên") ?? false)
    assert.equal(button("Dùng ảnh này làm ảnh chính"), undefined)
    assert.equal(button("Lưu vào bản nháp"), undefined)
    assert.ok(document.querySelector(`a[href="/hero/${group.heroId}?revision=${group.revision.id}&tab=media"]`))
    await render(<BadgesPage request={request} />)
    await waitFor(() => !!document.querySelector('[aria-label="Xem trang phục dùng nhãn ss"]'))
    assert.equal(relatedCalls, 0)
    await click(document.querySelector('[aria-label="Xem trang phục dùng nhãn ss"]'))
    await waitFor(() => relatedCalls === 1 && document.body.textContent?.includes("Mặc định") === true)
    assert.ok(document.querySelector('button[aria-label="Xem trang phục Mặc định"]'))
    assert.equal(
      document.querySelector(`a[href="/hero/${group.heroId}?revision=${group.revision.id}&tab=skins"]`),
      null,
    )
    await render(<SkinBadgeEditor badge={badge} locale="en-US" request={request} onClose={() => {}} />)
    await waitFor(() =>
      Array.from(document.querySelectorAll("label")).some((element) => element.textContent?.includes("Tên hiển thị")),
    )
    assert.equal(
      document.querySelectorAll('img[src="/fixture.png"]').length,
      0,
      "An exact translation with no icon must not borrow another locale's icon",
    )
    const input = Array.from(document.querySelectorAll("label"))
      .find((element) => element.textContent?.includes("Tên hiển thị"))!
      .querySelector("input")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, "Limited")
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    await click(button("Lưu nhãn trang phục"))
    await waitFor(() => saves.length === 2)
    assert.equal(saves[1].expectedVersion, 9)
    assert.deepEqual(saves[1].translations, [
      badge.translations[0],
      { locale: "en-US", displayName: "Limited", iconAssetId: null },
    ])
  } finally {
    await act(async () => root.unmount())
    client.clear()
    await logout()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
