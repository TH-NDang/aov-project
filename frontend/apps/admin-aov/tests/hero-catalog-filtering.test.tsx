import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { catalogOverview, createHeroCatalogFixture } from "./fixtures/hero-catalog-data"
import { intersectionHarness } from "./fixtures/intersection-observer"
import type { CatalogFilter } from "../src/features/publishing/catalog-context"

test("catalog transport encodes search and keeps every server filter in its cache identity", async () => {
  const { createPublishingApi, heroCatalogKey } = await import("../src/features/publishing/publishing-api")
  let requested = ""
  const api = createPublishingApi(async <T,>(path: string) => {
    requested = path
    return { items: [], page: 2, size: 20, totalElements: 0 } as T
  })
  const query = {
    q: "Triệu Vân & Airi",
    seasonId: "season-new",
    patchVariantId: "patch-current",
    rulesetId: "standard",
    locale: "vi-VN",
    sort: "edited-desc" as const,
    role: "MAGE,SUPPORT",
    position: "mid,tro-thu",
    hasWarnings: "true",
  }
  await api.heroes(2, query)
  const params = new URL(requested, "http://localhost").searchParams
  assert.equal(params.get("page"), "2")
  for (const [key, value] of Object.entries(query)) assert.equal(params.get(key), value)
  const original = heroCatalogKey(query)
  for (const variant of [
    { ...query, q: "Airi" },
    { ...query, seasonId: "season-old" },
    { ...query, patchVariantId: "patch-early" },
    { ...query, rulesetId: "alternate" },
    { ...query, locale: "en-US" },
    { ...query, sort: "code" as const },
    { ...query, role: "MAGE" },
    { ...query, position: "mid" },
    { ...query, hasWarnings: "" },
  ])
    assert.notDeepEqual(heroCatalogKey(variant), original)
  assert.deepEqual(
    heroCatalogKey({}),
    heroCatalogKey({ q: "", seasonId: "", patchVariantId: "", rulesetId: "", locale: "vi-VN", sort: "code" }),
  )
})

test("hero catalog uses server changes-only filters, global search, edited sorting and isolated query caches", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing" })
  const fixture = createHeroCatalogFixture()
  const intersections = intersectionHarness()
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const original = new Map<string, PropertyDescriptor | undefined>()
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
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle,
    fetch: fixture.fetcher,
    BroadcastChannel: undefined,
    IntersectionObserver: intersections.Observer,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { HeroCatalog } = await import("../src/features/publishing/hero-catalog")
  const { CatalogViewMode } = await import("../src/features/publishing/catalog-view-mode")
  const { heroCatalogKey } = await import("../src/features/publishing/publishing-api")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
  const document = dom.window.document
  const emptyFilter: CatalogFilter = { seasonId: "", variantId: "" }
  const mount = async (filter = emptyFilter, ruleset = "", locale = "vi-VN") =>
    act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/hero?show=changes"]}>
          <QueryClientProvider client={cache}>
            <div id="catalog-scroll" style={{ overflowY: "auto" }}>
              <CatalogViewMode defaultAll allLabel="Tất cả tướng" />
              <HeroCatalog ruleset={ruleset} locale={locale} overview={catalogOverview} filter={filter} />
            </div>
          </QueryClientProvider>
        </MemoryRouter>,
      )
    })
  const waitFor = async (condition: () => boolean, message: string) => {
    for (let attempt = 0; attempt < 400 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    assert.ok(condition(), message)
  }
  const codes = () =>
    [...document.querySelectorAll<HTMLButtonElement>('tbody button[aria-label^="Xem tướng "]')].map((button) =>
      button.getAttribute("aria-label")!.replace("Xem tướng ", ""),
    )
  const row = (code: string) => document.querySelector(`button[aria-label="Xem tướng ${code}"]`)!.closest("tr")!
  const cell = (code: string, title: RegExp) => {
    const column = [...document.querySelectorAll("thead th")].findIndex((heading) =>
      title.test(heading.textContent ?? ""),
    )
    assert.ok(column >= 0, `Expected catalog column matching ${title}`)
    return row(code).querySelectorAll("td")[column]
  }
  const search = () => document.querySelector<HTMLInputElement>('[aria-label="Tìm tướng"]')!
  const fill = async (value: string) =>
    act(async () => {
      const input = search()
      assert.ok(input, "The catalog exposes a labeled search control")
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value)
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  const sort = async (value: string) =>
    act(async () => {
      const control = document.querySelector<HTMLSelectElement>('[aria-label="Sắp xếp tướng"]')!
      assert.ok(control, "The catalog exposes a labeled server sort control")
      control.value = value
      control.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
  let releaseSlow: (() => void) | undefined
  try {
    await verifySession()
    await mount()
    await waitFor(() => codes().length === 20, "The initial catalog shows only the first server page")
    assert.ok(
      document.querySelector('a[href="/hero/publish-readiness"]'),
      "The catalog leads to the readiness overview",
    )
    assert.ok(codes().includes("aa-baseline-only"), "An unfiltered catalog retains heroes with no curated change")
    assert.ok(!codes().includes("zz-search-target"), "The search target starts beyond the loaded page")
    const button = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label)!
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Lọc tướng"]')!.click())
    await act(async () => button("Pháp sư").click())
    await act(async () => button("Đường giữa").click())
    await act(async () =>
      document.querySelector<HTMLInputElement>('[aria-label="Bộ lọc tướng"] input[type="checkbox"]')!.click(),
    )
    await waitFor(
      () => fixture.requests.at(-1)?.hasWarnings === "true" && codes().length === 1,
      "All facets are sent to the server before pagination",
    )
    assert.deepEqual(codes(), ["zz-search-target"])
    assert.equal(fixture.requests.at(-1)?.role, "MAGE")
    assert.equal(fixture.requests.at(-1)?.position, "mid")
    await act(async () => button("Xóa bộ lọc").click())
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Lọc tướng"]')!.click())
    await waitFor(() => codes().length === 20, "Clearing facets restores the original catalog")
    const lastEdit = cell("af-no-edit", /chỉnh sửa|sửa.*gần|biên tập/i)
    assert.ok(!lastEdit.querySelector("time"))
    assert.ok(
      !/1999|2099|2026/.test(lastEdit.textContent ?? ""),
      "Unknown editing history must not use publication, overview or current time",
    )
    assert.equal(lastEdit.querySelector("span:not([aria-hidden])")?.textContent, "Chưa ghi nhận")
    const { chooseTimeZone } = await import("@aov/ui/lib/time-zone")
    await act(async () => chooseTimeZone("Asia/Tokyo"))
    await waitFor(
      () => !!cell("ad-current-change", /chỉnh sửa|sửa.*gần|biên tập/i).querySelector("time"),
      "The editing timestamp is shown",
    )
    const recordedEdit = cell("ad-current-change", /chỉnh sửa|sửa.*gần|biên tập/i).querySelector("time")!
    assert.equal(recordedEdit.getAttribute("datetime"), "2026-10-15T01:02:03Z")
    assert.deepEqual(
      [...recordedEdit.querySelectorAll("span:not(.local-time-hidden)")].map((part) => part.textContent),
      [
        new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "Asia/Tokyo",
        }).format(new Date("2026-10-15T01:02:03Z")),
        new Intl.DateTimeFormat("vi-VN", { timeStyle: "short", timeZone: "Asia/Tokyo" }).format(
          new Date("2026-10-15T01:02:03Z"),
        ),
      ],
    )
    assert.match(cell("ad-current-change", /đánh giá/i).textContent ?? "", /current-patch/)
    assert.ok(
      !/early-season-patch|unconfirmed-future-patch/.test(cell("ad-current-change", /đánh giá/i).textContent ?? ""),
      "The all-heroes view labels the latest curated change instead of an unconfirmed draft",
    )

    await mount({ seasonId: "season-new", variantId: "" })
    await waitFor(
      () => codes().length === 2 && codes().includes("ac-early-change") && codes().includes("ad-current-change"),
      "A season returns heroes changed during that season, excluding carried-forward baselines",
    )
    assert.ok(!codes().includes("aa-baseline-only"))
    assert.ok(!codes().includes("ab-old-change"))
    assert.ok(
      document.querySelector('[aria-label="Xem thay đổi gameplay của ad-current-change tại 2 patch"]'),
      "A season retains each curated patch entry instead of reducing history to a single latest change",
    )
    await mount({ seasonId: "season-new", variantId: "patch-current" })
    await waitFor(
      () => codes().length === 1 && codes()[0] === "ad-current-change",
      "A patch shows only its curated changes rather than every applicable hero",
    )
    await mount({ seasonId: "season-old", variantId: "" })
    await waitFor(
      () => codes().length === 1 && codes()[0] === "ab-old-change",
      "Changing seasons replaces the previous query result",
    )
    assert.ok(
      fixture.requests.some(
        (request) =>
          request.seasonId === "season-new" && request.patchVariantId === "patch-current" && request.page === 0,
      ),
    )

    await mount()
    await waitFor(() => codes().length === 20, "Removing filters restores the full cached catalog")
    await fill("Voyage")
    await waitFor(
      () => codes().length === 1 && codes()[0] === "zz-search-target",
      "Server search finds a localized name beyond the previously loaded page",
    )
    assert.ok(fixture.requests.some((request) => request.q === "Voyage" && request.page === 0))
    assert.ok(
      !fixture.requests.some((request) => request.page === 1),
      "Searching must not require loading the entire unfiltered catalog first",
    )

    releaseSlow = fixture.hold("Slow response")
    await fill("Slow response")
    await waitFor(
      () => fixture.requests.some((request) => request.q === "Slow response"),
      "The delayed query reaches the server",
    )
    await fill("Voyage")
    await waitFor(
      () => search().value === "Voyage" && codes().length === 1 && codes()[0] === "zz-search-target",
      "Returning to a cached search restores its own rows",
    )
    await act(async () => {
      releaseSlow!()
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    releaseSlow = undefined
    assert.deepEqual(
      codes(),
      ["zz-search-target"],
      "A late response for a previous search must not overwrite the current result",
    )

    await fill("change")
    await waitFor(
      () => codes().join(",") === "ab-old-change,ac-early-change,ad-current-change",
      "Code ordering comes from the requested server sort",
    )
    await sort("edited-desc")
    await waitFor(
      () => codes().join(",") === "ad-current-change,ac-early-change,ab-old-change",
      "Edited sorting re-fetches the matching collection in server order",
    )
    assert.ok(
      fixture.requests.some(
        (request) => request.q === "change" && request.sort === "edited-desc" && request.page === 0,
      ),
    )

    await fill("")
    await waitFor(() => codes().length === 20, "Clearing search resets pagination for the current sort")
    assert.ok(
      ![...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Tải thêm"),
      "Scrolling loads the next page without a manual load-more control",
    )
    const sentinel = document.querySelector('[aria-label="Đang tải thêm tướng…"]')!
    assert.ok(sentinel)
    assert.equal(intersections.root(sentinel), document.getElementById("catalog-scroll"))
    await act(async () => intersections.intersect(sentinel, false))
    assert.ok(!fixture.requests.some((request) => request.page === 1), "Pages wait until the list end approaches")
    await act(async () => {
      intersections.intersect(sentinel)
      intersections.intersect(sentinel)
    })
    await waitFor(() => codes().length === fixture.heroes.length, "Scrolling appends the next server page")
    assert.equal(
      fixture.requests.filter((request) => request.page === 1 && !request.q && request.sort === "edited-desc").length,
      1,
      "Repeated intersections request each page only once",
    )
    assert.equal(intersections.observing(sentinel), false)
    assert.equal(document.querySelector('[aria-label="Đang tải thêm tướng…"]'), null)
    assert.match(document.body.textContent ?? "", /Đã tải tất cả tướng/)

    await mount(emptyFilter, "alternate")
    await waitFor(
      () => codes().length === 1 && codes()[0] === "ae-alternate",
      "Ruleset changes use a distinct cache and reset the accumulated pages",
    )
    await mount(emptyFilter, "alternate", "en-US")
    await waitFor(
      () => fixture.requests.some((request) => request.rulesetId === "alternate" && request.locale === "en-US"),
      "The display locale participates in the server request",
    )
    for (const query of [
      { locale: "vi-VN" },
      { locale: "vi-VN", seasonId: "season-new" },
      { locale: "vi-VN", seasonId: "season-new", patchVariantId: "patch-current" },
      { locale: "vi-VN", q: "Voyage" },
      { locale: "vi-VN", q: "change", sort: "edited-desc" as const },
      { locale: "vi-VN", rulesetId: "alternate", sort: "edited-desc" as const },
      { locale: "en-US", rulesetId: "alternate", sort: "edited-desc" as const },
    ])
      assert.ok(
        cache.getQueryData(heroCatalogKey(query)),
        `Expected independent cache entry for ${JSON.stringify(query)}`,
      )
    await act(async () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.trim() === "Tất cả tướng")!
        .click(),
    )
    await mount({ seasonId: "season-new", variantId: "patch-current" })
    await waitFor(
      () =>
        codes().includes("aa-baseline-only") &&
        !!document.querySelector('[aria-label^="Xem thay đổi gameplay tại current-patch"]'),
      "All mode keeps unchanged identities and loads the selected patch's changes",
    )
    assert.ok(!row("aa-baseline-only").querySelector('[aria-label^="Xem thay đổi gameplay"]'))
    assert.ok(!document.body.textContent!.includes("tướng có thay đổi"))
    await mount({ seasonId: "season-new", variantId: "patch-early" })
    await waitFor(
      () => !!row("ad-current-change").querySelector('[aria-label^="Xem thay đổi gameplay tại early-season-patch"]'),
      "Historical patch badges do not reuse the latest catalog change",
    )
    assert.ok(!row("ad-current-change").textContent!.includes("current-patch"))
    await act(async () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.trim() === "Chỉ thay đổi")!
        .click(),
    )
    await waitFor(
      () => codes().length === 2 && !codes().includes("aa-baseline-only"),
      "Changing mode keeps the selected historical patch",
    )
  } finally {
    releaseSlow?.()
    await act(async () => root.unmount())
    cache.clear()
    await logout()
    dom.window.close()
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
