import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"

test("publication overview groups markets and lazily reveals the cached patch change table", async () => {
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
        code: "VN",
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
  try {
    await act(async () =>
      root.render(
        <MemoryRouter>
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
