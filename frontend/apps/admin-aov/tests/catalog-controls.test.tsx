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

test("curated change badges retain mixed categories and open an accessible summary", async () => {
  await withDocument(async (root, dom) => {
    const { HeroChangeSummary, ChangeKindBadge, curatedChangeKinds } =
      await import("../src/features/publishing/hero-change-badges")
    assert.deepEqual(curatedChangeKinds(["NERF", "BUFF", "BUFF"]), ["BUFF", "NERF"])
    assert.deepEqual(curatedChangeKinds(["ADJUST", "ADJUSTMENT", "BUG_FIX", "FIX"]), ["ADJUSTMENT", "FIX"])
    const document = dom.window.document
    let opened = 0
    const kinds = ["BUFF", "NERF", "ADJUST", "ADJUSTMENT", "REWORK", "FIX", "CUSTOM_KIND"]
    await act(async () =>
      root.render(
        <HeroChangeSummary
          kinds={kinds}
          summary="Tăng khả năng hồi phục, giảm sát thương đầu trận."
          patchLabel="15/10/2026"
          actualLocale="vi-VN"
          locale="en-US"
          onOpen={() => opened++}
        />,
      ),
    )
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label^="Xem thay đổi gameplay"]')!
    assert.match(trigger.getAttribute("aria-label")!, /Tăng sức mạnh, Giảm sức mạnh, Cân bằng, Làm lại, Sửa lỗi, Khác/)
    assert.equal(trigger.querySelectorAll("[data-change-kind]").length, 3)
    assert.match(trigger.textContent!, /\+3/)
    assert.ok(!document.body.textContent!.includes("Tăng khả năng hồi phục"))
    await act(async () => trigger.click())
    const popover = document.querySelector('[data-slot="popover-content"]')!
    assert.ok(popover)
    assert.match(popover.textContent!, /Tăng khả năng hồi phục, giảm sát thương đầu trận/)
    assert.match(popover.textContent!, /Ngôn ngữ dự phòng: vi-VN/)
    assert.deepEqual(
      [...popover.querySelectorAll("[data-change-kind]")].map((node) => node.getAttribute("data-change-kind")),
      ["BUFF", "NERF", "ADJUSTMENT", "REWORK", "FIX", "OTHER"],
    )
    assert.equal(popover.querySelector('[data-change-kind="OTHER"]')!.getAttribute("title"), "Khác · CUSTOM_KIND")
    await act(async () =>
      [...popover.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.includes("Mở chi tiết thay đổi"))!
        .click(),
    )
    assert.equal(opened, 1)
    assert.equal(document.querySelector('[data-slot="popover-content"]'), null)
    await act(async () => root.render(<HeroChangeSummary kinds={[]} />))
    assert.match(document.body.textContent!, /Chưa có thay đổi gameplay/)
    assert.equal(document.querySelector("button"), null)
    await act(async () => root.render(<ChangeKindBadge kind={'<img src=x onerror="unsafe">'} compact />))
    assert.equal(document.querySelector("img"), null)
    assert.match(document.querySelector("[data-change-kind]")!.getAttribute("title")!, /Khác · <img/)
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
