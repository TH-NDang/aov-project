import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { createHeroFixture } from "./fixtures/hero-workspace-data"

test("publication overview shows flags and hero heads, and only tabs with changes in the selected patch", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/game-configuration" })
  const fixture = createHeroFixture()
  const recorded: unknown[] = []
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).endsWith("/admin/me"))
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        capabilities: ["catalog:read", "patch:write", "item:publish"],
      })
    if (String(input).endsWith("/admin/items/owner/changes") && init?.method === "POST") {
      recorded.push(JSON.parse(String(init.body)))
      return Response.json({ id: "recorded" }, { status: 201 })
    }
    return fixture.fetcher(input, init)
  }
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    DocumentFragment: dom.window.DocumentFragment,
    HTMLInputElement: dom.window.HTMLInputElement,
    // The change table picks overall assessments with a Radix select, which looks for its form.
    HTMLFormElement: dom.window.HTMLFormElement,
    fetch: fetcher,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    BroadcastChannel: undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { GameConfigurationPage } = await import("../src/features/publishing/game-configuration-page")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
  cache.setQueryData(["publication-overview"], {
    asOf: "2026-10-16T00:00:00Z",
    rulesets: [{ id: "rules", code: "Shared gameplay", description: null }],
    assignments: [],
    markets: [
      {
        id: "vn",
        code: "vn",
        displayName: "Việt Nam",
        available: true,
        currentRulesetId: "rules",
        currentSeasonId: "season",
        currentReleaseId: "release",
      },
      {
        id: "th",
        code: "TH",
        displayName: "Thái Lan",
        available: false,
        currentRulesetId: null,
        currentSeasonId: null,
        currentReleaseId: null,
      },
    ],
    seasonSchedules: [
      {
        id: "schedule",
        seasonId: "season",
        regionId: "vn",
        startsAt: "2026-10-01T00:00:00Z",
        endsAt: "2027-01-01T00:00:00Z",
        phase: "CURRENT",
      },
    ],
    seasons: [
      {
        id: "season",
        regionId: "vn",
        code: "s4",
        displayName: "S4 2026",
        startsAt: "2026-10-01T00:00:00Z",
        endsAt: "2027-01-01T00:00:00Z",
        phase: "CURRENT",
      },
    ],
    variants: [
      {
        id: "variant",
        patchId: "patch",
        seasonId: "season",
        patchCode: "patch-october",
        rulesetId: "rules",
        rulesetOrdinal: 1,
        status: "PUBLISHED",
      },
    ],
    releases: [
      {
        id: "release",
        variantId: "variant",
        regionId: "vn",
        seasonId: "season",
        effectiveAt: "2026-10-01T00:00:00Z",
        sourceUrl: null,
        status: "SCHEDULED",
        phase: "CURRENT",
      },
    ],
  })
  cache.setQueryData(
    ["patch-changes", "variant", "vi-VN"],
    [
      {
        id: "change",
        heroId: "hero",
        heroCode: "airi",
        toHeroRevisionId: "revision",
        overallKind: "BUFF",
        summary: "Adjusted skill",
        actualLocale: "vi-VN",
        changes: [
          {
            id: "item",
            type: "HERO_SKILL_CHANGE",
            changeKind: "BUFF",
            skillKey: "passive",
            oldValue: "10",
            newValue: "12",
          },
        ],
      },
    ],
  )
  const warehouseKey = (kind: string) => ["warehouse", "changes", kind, "rules", "vi-VN"]
  const noteKey = ["patch-additional-notes", "variant", "vi-VN"]
  cache.setQueryData(noteKey, { body: "", version: 0 })
  for (const kind of ["items", "enchantments", "arcana", "spells"]) cache.setQueryData(warehouseKey(kind), [])
  cache.setQueryData(warehouseKey("items"), [{ id: "other-change", ownerId: "item", patchVariantId: "other-patch" }])
  // Patch change rows name heroes from the reference catalog instead of reading each revision.
  cache.setQueryData(
    ["reference-catalog", "fixture", "editor", ""],
    [
      {
        id: "hero",
        kind: "hero",
        translations: [{ locale: "vi-VN", name: "Airi", aliases: [], description: "" }],
        iconAssetId: "head",
      },
    ],
  )
  cache.setQueryData(["hero-content-asset", "head"], { currentUrl: "/fixture-head.png" })
  const updateCache = async (key: readonly unknown[], value: unknown) => {
    await act(async () => {
      cache.setQueryData(key, value)
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  try {
    await verifySession()
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/game-configuration?domain=items"]}>
          <QueryClientProvider client={cache}>
            <GameConfigurationPage />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    const document = dom.window.document
    const openView = async (name: string) => {
      const tab = [
        ...document.querySelectorAll<HTMLButtonElement>('[aria-label="Quản lý phiên bản và thị trường"] [role="tab"]'),
      ].find((tab) => tab.textContent?.trim() === name)!
      await act(async () => {
        tab.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }))
        tab.click()
      })
    }
    await openView("Thị trường")
    // With a single default ruleset the market overview does not repeat the ruleset name.
    assert.doesNotMatch(document.body.textContent ?? "", /Shared gameplay/)
    assert.match(document.querySelector('[aria-label="Thị trường"]')?.textContent ?? "", /S4 2026.*patch-october/)
    assert.ok(document.querySelector('[aria-label="Gán mùa cho Việt Nam"]'))
    assert.ok(document.querySelector('[aria-label="Ghi lịch mùa cho Thái Lan"]'))
    assert.match(document.querySelector('[aria-label="Phiên bản cho Thái Lan"]')?.textContent ?? "", /Chưa ghi lịch/)
    assert.ok(document.querySelector('[aria-label="Xem patch cho Việt Nam"]'))
    assert.ok(document.querySelector('[aria-label="Thị trường"] img[src="/images/flags/vn.svg"]'))
    await openView("Phiên bản")
    assert.match(document.body.textContent ?? "", /Đang áp dụng/)
    assert.equal(document.querySelector('[aria-label="Phạm vi hiển thị"]'), null)
    assert.ok([...document.querySelectorAll("h2")].some((title) => title.textContent === "patch-october"))
    assert.equal(document.querySelector('[aria-label="Gán mùa cho Việt Nam"]'), null)
    assert.ok(document.querySelector('button[aria-label="Xem thay đổi Airi"]'))
    assert.ok(document.querySelector("td.sticky"))
    assert.match(document.body.textContent ?? "", /Tăng sức mạnh/)
    const tabs = () => [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Nhóm có thay đổi"] [role="tab"]')]
    assert.deepEqual(
      tabs().map((tab) => tab.textContent?.trim()),
      ["Tướng1"],
    )
    assert.equal(tabs()[0].getAttribute("aria-selected"), "true", "A stale empty domain falls back to a populated tab")
    assert.ok(tabs()[0].querySelector("svg"))
    assert.ok(document.querySelector('img[src="/fixture-head.png"]'))
    assert.ok(document.querySelector('td img[src="/images/flags/vn.svg"]'))
    const overview = cache.getQueryData<import("../src/features/publishing/publication-overview").PublicationOverview>([
      "publication-overview",
    ])!
    await updateCache(["publication-overview"], {
      ...overview,
      markets: overview.markets.map((market) => ({ ...market, currentReleaseId: null })),
      releases: [
        ...overview.releases.map((release) => ({
          ...release,
          status: "DRAFT",
          phase: "AWAITING_CONFIRMATION",
          effectiveAt: null,
          effectiveOn: "2026-10-15",
        })),
        {
          ...overview.releases[0],
          id: "th-date",
          regionId: "th",
          status: "DRAFT",
          phase: "AWAITING_CONFIRMATION",
          effectiveAt: null,
          effectiveOn: "2026-10-18",
        },
      ],
    })
    const heroPanel = document.querySelector('[role="tabpanel"][data-state="active"]')!
    assert.ok(heroPanel.querySelector('img[src="/images/flags/vn.svg"]'))
    assert.match(heroPanel.querySelector('[title^="Việt Nam"]')?.getAttribute("title") ?? "", /Chờ xác nhận áp dụng/)
    await updateCache(warehouseKey("enchantments"), [
      {
        id: "enchantment-change",
        domain: "ENCHANTMENT",
        ownerId: "enchantment",
        code: "home",
        name: "Sân nhà",
        iconAssetId: null,
        rulesetId: "rules",
        patchVariantId: "variant",
        fromRevisionId: null,
        toRevisionId: "new-revision",
        kinds: ["ADDED"],
        summary: "Phù hiệu mới",
        actualLocale: "vi-VN",
        sourceUrl: null,
        confirmed: true,
        recordedAt: "2026-10-01",
      },
    ])
    assert.deepEqual(
      tabs().map((tab) => tab.textContent?.trim()),
      ["Tướng1", "Phù hiệu1"],
    )
    const enchantments = tabs().find((tab) => tab.textContent?.includes("Phù hiệu"))!
    await act(async () => {
      enchantments.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }))
      enchantments.click()
    })
    assert.match(document.querySelector('[role="tabpanel"][data-state="active"]')?.textContent ?? "", /Sân nhà/)
    await updateCache(warehouseKey("enchantments"), [])
    assert.deepEqual(
      tabs().map((tab) => tab.textContent?.trim()),
      ["Tướng1"],
    )
    assert.equal(tabs()[0].getAttribute("aria-selected"), "true")
    await updateCache(["patch-changes", "variant", "vi-VN"], [])
    assert.equal(tabs().length, 0)
    assert.match(document.body.textContent ?? "", /Chưa ghi nhận thay đổi gameplay trong patch này/)
    assert.equal(document.querySelector('[aria-label="Ghi chú khác"]'), null)
    await updateCache(noteKey, { body: "Note A\nNote B", version: 1 })
    assert.equal(document.querySelectorAll('[aria-label="Ghi chú khác"] li').length, 2)
    assert.equal(tabs().length, 0, "Editorial notes do not create gameplay changes")
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Lọc mùa S4 2026"]')!.click())
    const seasonPatch = document.querySelector<HTMLButtonElement>('[aria-label="Mở patch patch-october"]')!
    assert.ok(seasonPatch)
    assert.match(
      document.querySelector('[aria-label="Thị trường trong mùa"]')?.textContent ?? "",
      /Thái Lan.*Có lịch patch · Chưa ghi lịch mùa/,
    )
    assert.match(seasonPatch.textContent ?? "", /TH.*Đã ghi ngày phát hành/)
    await act(async () => seasonPatch.click())
    assert.ok([...document.querySelectorAll("h2")].some((title) => title.textContent === "patch-october"))
    const press = async (label: string) =>
      act(async () => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)!.click())
    cache.setQueryData(["hero-content-asset", "item-icon"], { currentUrl: "/item-icon.png" })
    await updateCache(
      ["warehouse", "items", "rules", "vi-VN"],
      [
        {
          id: "owner",
          code: "item",
          content: { iconAssetId: "item-icon", translations: [{ locale: "vi-VN", name: "Item A" }] },
        },
        { id: "other", code: "other", content: { translations: [{ locale: "vi-VN", name: "Item B" }] } },
      ],
    )
    await updateCache(
      ["warehouse", "history", "items", "owner"],
      [
        {
          id: "revision",
          rulesetId: "rules",
          state: "PUBLISHED",
          cause: "DATA_BASELINE",
          revisionNo: 1,
          effectiveFromPatchVariantId: "variant",
        },
      ],
    )
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Thêm ghi chú · Trang bị"]')!.click())
    assert.ok(document.querySelector('[aria-label="Chọn trang bị"] img[src="/item-icon.png"]'))
    await press("Item A")
    await press("Thêm mới")
    assert.equal(document.querySelector('select[aria-label="Bản dữ liệu đã xuất bản"]'), null)
    const summary = document.querySelector<HTMLTextAreaElement>('[aria-label="Tóm tắt thay đổi"]')!
    const source = document.querySelector<HTMLInputElement>('[aria-label="Liên kết nguồn xác minh"]')!
    await act(async () => {
      for (const [node, prototype, value] of [
        [summary, dom.window.HTMLTextAreaElement.prototype, "Note A"],
        [source, dom.window.HTMLInputElement.prototype, "https://source.example/patch"],
      ] as const) {
        Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value)
        node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      }
    })
    assert.equal(recorded.length, 0)
    await press("Xác nhận lịch sử")
    assert.deepEqual(recorded, [
      {
        patchVariantId: "variant",
        toRevisionId: "revision",
        fromRevisionId: null,
        kinds: ["ADDED"],
        translations: [{ locale: "vi-VN", text: "Note A" }],
        sourceUrl: "https://source.example/patch",
      },
    ])
  } finally {
    await act(async () => root.unmount())
    await logout()
    cache.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
