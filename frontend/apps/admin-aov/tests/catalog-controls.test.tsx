import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import type { Root } from "react-dom/client"
import type { CatalogFilter } from "../src/features/publishing/catalog-context"
import type { PublicationOverview } from "../src/features/publishing/publication-overview"

async function withDocument(run: (root: Root, dom: JSDOM) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing", pretendToBeVisual: true })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    BroadcastChannel: undefined,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    Element: dom.window.Element,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    fetch: async () => {
      throw new Error("Catalog controls must not request live data")
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  try {
    await run(root, dom)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test("hero timeline defaults to all heroes and keeps a patch selected when returning to current", async () => {
  await withDocument(async (root, dom) => {
    const { MemoryRouter, useSearchParams } = await import("react-router")
    const { CatalogTimeline } = await import("../src/features/publishing/catalog-timeline")
    const { catalogOverview } = await import("./fixtures/hero-catalog-data")
    const { patchHeroLocation } = await import("../src/features/publishing/hero-location")
    let current = new URLSearchParams()
    function Host() {
      const [params, setParams] = useSearchParams()
      current = params
      return (
        <CatalogTimeline
          data={catalogOverview}
          heroCatalog
          value={{ seasonId: params.get("season") ?? "", variantId: params.get("patch") ?? "" }}
          currentFilter={{ seasonId: "season-new", variantId: "patch-current" }}
          onChange={(next) =>
            setParams((previous) => patchHeroLocation(previous, { season: next.seasonId, patch: next.variantId }))
          }
        />
      )
    }
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/hero?season=season-new&patch=patch-current&q=Airi"]}>
          <Host />
        </MemoryRouter>,
      ),
    )
    const button = (name: string) =>
      [...dom.window.document.querySelectorAll<HTMLButtonElement>("button")].find(
        (entry) => entry.textContent?.trim() === name || entry.getAttribute("aria-label") === name,
      )!
    assert.equal(button("Tất cả tướng").getAttribute("aria-pressed"), "true")
    assert.equal(button("Bỏ lọc"), undefined)
    await act(async () => button("Chỉ thay đổi").click())
    assert.equal(current.get("show"), "changes")
    await act(async () =>
      dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Lọc patch early-season-patch"]')!.click(),
    )
    assert.equal(current.get("patch"), "patch-early")
    assert.equal(current.get("show"), "changes")
    await act(async () => button("Patch hiện tại").click())
    assert.equal(current.get("patch"), "patch-current")
    assert.equal(current.get("q"), "Airi")
    await act(async () => button("Tất cả tướng").click())
    assert.equal(current.get("show"), "all")
    assert.equal(current.get("patch"), "patch-current")
  })
})

test("hero change summaries show a single overall assessment and open accessible details", async () => {
  await withDocument(async (root, dom) => {
    const { HeroChangeSummary, ChangeKindBadge, curatedChangeKinds } =
      await import("../src/features/publishing/hero-change-badges")
    assert.deepEqual(curatedChangeKinds(["NERF", "BUFF", "BUFF"]), ["BUFF", "NERF"])
    assert.deepEqual(curatedChangeKinds(["ADJUST", "ADJUSTMENT", "BUG_FIX", "FIX"]), ["ADJUSTMENT", "FIX"])
    const document = dom.window.document
    let opened = 0
    await act(async () =>
      root.render(
        <HeroChangeSummary
          overallKind="ADJUSTMENT"
          summary="Tăng khả năng hồi phục, giảm sát thương đầu trận."
          patchLabel="15/10/2026"
          actualLocale="vi-VN"
          locale="en-US"
          onOpen={() => opened++}
        />,
      ),
    )
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label^="Xem thay đổi gameplay"]')!
    assert.match(trigger.getAttribute("aria-label")!, /Điều chỉnh/)
    assert.equal(trigger.querySelectorAll("[data-change-kind]").length, 1)
    assert.ok(!document.body.textContent!.includes("Tăng khả năng hồi phục"))
    await act(async () => trigger.click())
    const popover = document.querySelector('[data-slot="popover-content"]')!
    assert.ok(popover)
    assert.match(popover.textContent!, /Tăng khả năng hồi phục, giảm sát thương đầu trận/)
    assert.match(popover.textContent!, /Ngôn ngữ dự phòng: vi-VN/)
    assert.deepEqual(
      [...popover.querySelectorAll("[data-change-kind]")].map((node) => node.getAttribute("data-change-kind")),
      ["ADJUSTMENT"],
    )
    await act(async () =>
      [...popover.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.includes("Mở chi tiết thay đổi"))!
        .click(),
    )
    assert.equal(opened, 1)
    assert.equal(document.querySelector('[data-slot="popover-content"]'), null)
    await act(async () => root.render(<ChangeKindBadge kind={'<img src=x onerror="unsafe">'} compact />))
    assert.equal(document.querySelector("img"), null)
    assert.match(document.querySelector("[data-change-kind]")!.getAttribute("title")!, /Khác · <img/)
  })
})

test("unassessed changes remain neutral and selected patch dates are not repeated in each row", async () => {
  await withDocument(async (root, dom) => {
    const { HeroChangeSummary } = await import("../src/features/publishing/hero-change-badges")
    const document = dom.window.document
    const render = async (overallKind: string | null) =>
      act(async () =>
        root.render(
          <HeroChangeSummary
            overallKind={overallKind}
            summary="Thay đổi đã ghi nhận."
            patchLabel="30/10/2026"
            showPatchLabel={false}
          />,
        ),
      )
    const trigger = () => document.querySelector<HTMLButtonElement>('button[aria-label^="Xem thay đổi gameplay"]')!
    await render(null)
    assert.equal(trigger().querySelectorAll("[data-change-kind]").length, 0)
    assert.match(trigger().textContent!, /Chưa đánh giá/)
    assert.ok(!trigger().textContent!.includes("30/10/2026"))
    assert.match(trigger().getAttribute("aria-label")!, /30\/10\/2026/)
    await act(async () => trigger().click())
    const popover = document.querySelector('[data-slot="popover-content"]')!
    assert.match(popover.textContent!, /Đánh giá tổng thểChưa đánh giá/)
    assert.equal(popover.querySelectorAll("[data-change-kind]").length, 0)
    await act(async () => trigger().click())
    await render("NERF")
    assert.deepEqual(
      [...trigger().querySelectorAll("[data-change-kind]")].map((entry) => entry.getAttribute("data-change-kind")),
      ["NERF"],
    )
    assert.match(trigger().getAttribute("title")!, /^Đánh giá tổng thể/)
  })
})

test("catalog filters explain change-only scope, clear stale patch selection, and reset explicitly", async () => {
  await withDocument(async (root, dom) => {
    const { CatalogContext } = await import("../src/features/publishing/catalog-context")
    const data: PublicationOverview = {
      asOf: "2026-10-18T00:00:00Z",
      rulesets: [{ id: "rules", code: "aov-standard", description: "Shared rules" }],
      markets: [],
      assignments: [],
      seasonSchedules: [],
      releases: [],
      seasons: [
        { id: "s3", code: "s3-2026", displayName: "S3 2026", ordinal: 3 },
        { id: "s4", code: "s4-2026", displayName: "S4 2026", ordinal: 4 },
      ],
      variants: [
        {
          id: "p3",
          patchId: "patch3",
          seasonId: "s3",
          patchCode: "Trước S4",
          rulesetId: "rules",
          rulesetOrdinal: 1,
          status: "PUBLISHED",
        },
        {
          id: "p4",
          patchId: "patch4",
          seasonId: "s4",
          patchCode: "29/09/2026",
          rulesetId: "rules",
          rulesetOrdinal: 2,
          status: "PUBLISHED",
        },
      ],
    }
    const changes: CatalogFilter[] = []
    function Host() {
      const [value, setValue] = React.useState<CatalogFilter>({ seasonId: "", variantId: "" })
      return (
        <CatalogContext
          data={data}
          value={value}
          onChange={(next) => {
            changes.push(next)
            setValue(next)
          }}
        />
      )
    }
    await act(async () => root.render(<Host />))
    const document = dom.window.document
    const season = () => document.querySelector<HTMLSelectElement>('[aria-label="Mùa có thay đổi"]')!
    const patch = () => document.querySelector<HTMLSelectElement>('[aria-label="Patch có thay đổi"]')!
    const reset = () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
        button.textContent?.includes("Bỏ lọc"),
      )!
    const choose = async (select: HTMLSelectElement, value: string) =>
      act(async () => {
        select.value = value
        select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
      })
    assert.match(document.querySelector('[role="status"]')!.textContent!, /Hiển thị toàn bộ tướng/)
    assert.equal(reset().disabled, true)
    assert.equal(patch().options[0].textContent, "Tất cả patch")
    assert.match(patch().options[2].textContent!, /S4 2026/)
    await choose(patch(), "p4")
    assert.deepEqual(changes.at(-1), { seasonId: "", variantId: "p4" })
    assert.match(
      document.querySelector('[role="status"]')!.textContent!,
      /Chỉ hiển thị tướng có thay đổi gameplay đã ghi nhận/,
    )
    assert.equal(reset().disabled, false)
    await choose(season(), "s3")
    assert.deepEqual(changes.at(-1), { seasonId: "s3", variantId: "" })
    assert.deepEqual(
      [...patch().options].map((option) => option.value),
      ["", "p3"],
    )
    await choose(patch(), "p3")
    assert.deepEqual(changes.at(-1), { seasonId: "s3", variantId: "p3" })
    await act(async () => reset().click())
    assert.deepEqual(changes.at(-1), { seasonId: "", variantId: "" })
    assert.equal(season().value, "")
    assert.equal(patch().value, "")
    assert.equal(reset().disabled, true)
    assert.match(document.querySelector('[role="status"]')!.textContent!, /Hiển thị toàn bộ tướng/)
  })
})

test("timeline separates scope from mode, explains season endpoints, and resets the scoped mode atomically", async () => {
  await withDocument(async (root, dom) => {
    const { MemoryRouter, useSearchParams } = await import("react-router")
    const { CatalogTimeline } = await import("../src/features/publishing/catalog-timeline")
    const { catalogScopePatch } = await import("../src/features/publishing/catalog-scope")
    const { patchHeroLocation } = await import("../src/features/publishing/hero-location")
    const data: PublicationOverview = {
      asOf: "2026-11-03T00:00:00Z",
      rulesets: [{ id: "rules", code: "standard", description: null }],
      markets: [],
      assignments: [],
      seasonSchedules: [],
      releases: [],
      seasons: [{ id: "s4", code: "s4", displayName: "S4 2026", ordinal: 4 }],
      variants: [
        {
          id: "early",
          patchId: "early",
          seasonId: "s4",
          patchCode: "30/10",
          rulesetId: "rules",
          rulesetOrdinal: 1,
          status: "PUBLISHED",
        },
        {
          id: "late",
          patchId: "late",
          seasonId: "s4",
          patchCode: "15/11",
          rulesetId: "rules",
          rulesetOrdinal: 2,
          status: "DRAFT",
        },
      ],
    }
    let current = new URLSearchParams()
    function Host({ eachPatch = false }: { eachPatch?: boolean }) {
      const [params, setParams] = useSearchParams()
      current = params
      return (
        <CatalogTimeline
          data={data}
          value={{ seasonId: params.get("season") ?? "", variantId: params.get("patch") ?? "" }}
          onChange={(next) => setParams((previous) => patchHeroLocation(previous, catalogScopePatch(next)))}
          seasonView={eachPatch ? "each-patch" : "latest"}
        />
      )
    }
    const render = async (eachPatch = false) =>
      act(async () =>
        root.render(
          <MemoryRouter initialEntries={["/hero?q=Lauriel&domain=heroes"]}>
            <Host eachPatch={eachPatch} />
          </MemoryRouter>,
        ),
      )
    const document = dom.window.document
    const button = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label)
    const click = async (element: HTMLButtonElement | undefined | null) => {
      assert.ok(element)
      await act(async () => element.click())
    }
    const status = () => document.querySelector('[role="status"]')!.textContent!
    await render()
    assert.equal(button("Tất cả"), undefined)
    assert.equal(button("Tất cả patch"), undefined)
    assert.equal(button("Bỏ lọc"), undefined)
    assert.equal(button("Dữ liệu tại mốc"), undefined)
    assert.match(status(), /Danh sách chung/)

    await click(document.querySelector<HTMLButtonElement>('[aria-label="Lọc mùa S4 2026"]'))
    assert.equal(current.get("season"), "s4")
    assert.equal(button("Chỉ thay đổi")!.getAttribute("aria-pressed"), "true")
    assert.match(status(), /Thay đổi trong mùa S4 2026/)
    await click(button("Dữ liệu tại mốc"))
    assert.equal(current.get("show"), "all")
    assert.match(status(), /Dữ liệu đến patch cuối của mùa: 15\/11 \(nháp\)/)
    await render(true)
    assert.match(status(), /Dữ liệu tại từng patch trong mùa S4 2026/)
    await render()

    await click(document.querySelector<HTMLButtonElement>('[aria-label="Lọc patch 30/10"]'))
    assert.equal(current.get("show"), "all", "Changing time scope retains the chosen display mode")
    assert.match(status(), /Dữ liệu đến patch S4 2026 · 30\/10/)
    await click(button("Bỏ lọc"))
    assert.equal(current.has("season"), false)
    assert.equal(current.has("patch"), false)
    assert.equal(current.has("show"), false, "Reset must not leave a hidden snapshot mode")
    assert.equal(current.get("q"), "Lauriel")
    assert.equal(current.get("domain"), "heroes")
    assert.equal(button("Dữ liệu tại mốc"), undefined)
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Lọc patch 30/10"]'))
    assert.equal(button("Chỉ thay đổi")!.getAttribute("aria-pressed"), "true")

    await click(document.querySelector<HTMLButtonElement>('[aria-label="Chọn mùa hoặc patch"]'))
    const popover = document.querySelector('[data-slot="popover-content"]')!
    assert.ok(popover)
    assert.ok(!popover.textContent!.includes("Tất cả"))
    const mobilePatch = [...popover.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes("15/11"),
    )!
    await click(mobilePatch)
    assert.equal(current.get("patch"), "late")
    assert.equal(document.querySelector('[data-slot="popover-content"]'), null)
    assert.match(status(), /Thay đổi tại patch S4 2026 · 15\/11 · Nháp/)
  })
})
