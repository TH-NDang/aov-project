import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"

test("publication overview shows flags and hero heads, and only tabs with changes in the selected patch", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/game-configuration" })
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
  for (const kind of ["items", "enchantments", "arcana", "spells"]) cache.setQueryData(warehouseKey(kind), [])
  cache.setQueryData(warehouseKey("items"), [{ id: "other-change", ownerId: "item", patchVariantId: "other-patch" }])
  cache.setQueryData(["publishing-preview", "hero", "revision"], {
    content: {
      PROFILE: { translations: [{ locale: "vi-VN", name: "Airi" }] },
      MEDIA_BINDINGS: { bindings: { HEAD: "head" } },
    },
  })
  cache.setQueryData(["hero-content-asset", "head"], { currentUrl: "/fixture-head.png" })
  const updateCache = async (key: readonly unknown[], value: unknown) => {
    await act(async () => {
      cache.setQueryData(key, value)
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  try {
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
    assert.match(document.body.textContent ?? "", /Shared gameplay/)
    assert.match(document.body.textContent ?? "", /Đang áp dụng/)
    assert.equal(document.querySelector('button[aria-label="Xem thay đổi airi"]'), null)
    const patch = [...document.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")].find((b) =>
      b.textContent?.includes("patch-october"),
    )!
    await act(async () => patch.click())
    assert.ok(document.querySelector('button[aria-label="Xem thay đổi airi"]'))
    assert.ok(document.querySelector("td.sticky"))
    assert.match(document.body.textContent ?? "", /Tăng sức mạnh/)
    const tabs = () => [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    assert.deepEqual(
      tabs().map((tab) => tab.textContent?.trim()),
      ["Tướng1"],
    )
    assert.equal(tabs()[0].getAttribute("aria-selected"), "true", "A stale empty domain falls back to a populated tab")
    assert.ok(tabs()[0].querySelector("svg"))
    assert.ok(document.querySelector('img[src="/fixture-head.png"]'))
    assert.ok(document.querySelectorAll('img[src="/images/flags/vn.svg"]').length >= 3)
    const overview = cache.getQueryData<import("../src/features/publishing/publication-overview").PublicationOverview>([
      "publication-overview",
    ])!
    await updateCache(["publication-overview"], {
      ...overview,
      markets: overview.markets.map((market) => ({ ...market, currentReleaseId: null })),
      releases: overview.releases.map((release) => ({
        ...release,
        status: "DRAFT",
        phase: "AWAITING_CONFIRMATION",
        effectiveAt: null,
        effectiveOn: "2026-10-15",
      })),
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
    assert.match(document.body.textContent ?? "", /Chưa ghi nhận thay đổi trong patch này/)
    await act(async () => patch.click())
    assert.equal(document.querySelector('button[aria-label="Xem thay đổi airi"]'), null)
  } finally {
    await act(async () => root.unmount())
    cache.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
