import assert from "node:assert/strict"
import { test } from "node:test"
import type { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import type { Root } from "react-dom/client"
import type { PublicationOverview } from "../src/features/publishing/api/publication-overview"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"
import { type CatalogFilter } from "@/lib/catalog-scope"

async function withDocument(run: (root: Root, dom: JSDOM) => Promise<void>) {
  const dom = createWindow("http://localhost/publishing")
  Object.defineProperty(dom.window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window, {
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    fetch: async () => {
      throw new Error("Catalog controls must not request live data")
    },
  })
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  try {
    await run(root, dom)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    restoreGlobals()
  }
}

test("hero timeline defaults to all heroes and keeps a patch selected when returning to current", async () => {
  await withDocument(async (root, dom) => {
    const { MemoryRouter, useSearchParams } = await import("react-router")
    const { CatalogTimeline } = await import("../src/features/publishing/components/catalog/catalog-timeline")
    const { catalogOverview } = await import("./fixtures/hero-catalog-data")
    const { patchHeroLocation } = await import("../src/features/publishing/model/hero-location")
    let current = new URLSearchParams()
    function Host() {
      const [params, setParams] = useSearchParams()
      current = params
      return (
        <CatalogTimeline
          data={catalogOverview}
          allLabel="Tất cả tướng"
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
    assert.equal(button("Tất cả tướng"), undefined)
    await act(async () => button("Tùy chọn dòng thời gian").click())
    assert.equal(button("Tất cả tướng").getAttribute("aria-pressed"), "true")
    assert.equal(button("Bỏ lọc"), undefined)
    await act(async () => button("Chỉ thay đổi").click())
    assert.equal(current.get("show"), "changes")
    await act(async () =>
      dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Lọc patch early-season-patch"]')!.click(),
    )
    assert.equal(current.get("patch"), "patch-early")
    assert.equal(current.get("show"), "changes")
    if (!button("Về patch hiện tại")) await act(async () => button("Tùy chọn dòng thời gian").click())
    await act(async () => button("Về patch hiện tại").click())
    assert.equal(current.get("patch"), "patch-current")
    assert.equal(current.get("q"), "Airi")
    await act(async () => button("Tùy chọn dòng thời gian").click())
    await act(async () => button("Tất cả tướng").click())
    assert.equal(current.get("show"), "all")
    assert.equal(current.get("patch"), "patch-current")
  })
})

test("phones select patches directly on the rail and open only the options in a bottom sheet", async () => {
  await withDocument(async (root, dom) => {
    Object.defineProperty(dom.window, "matchMedia", {
      value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    })
    const { MemoryRouter } = await import("react-router")
    const { CatalogTimeline } = await import("../src/features/publishing/components/catalog/catalog-timeline")
    const { catalogOverview } = await import("./fixtures/hero-catalog-data")
    let selected: CatalogFilter | undefined
    await act(async () =>
      root.render(
        <MemoryRouter>
          <CatalogTimeline
            data={catalogOverview}
            allLabel="Tất cả tướng"
            value={{ seasonId: "season-new", variantId: "patch-current" }}
            onChange={(value) => {
              selected = value
            }}
          />
        </MemoryRouter>,
      ),
    )
    const document = dom.window.document
    const rail = document.querySelector('[role="group"][aria-label="Chọn patch"]')!
    assert.equal(document.querySelector('button[aria-label="Chọn mùa hoặc patch"]'), null)
    await act(async () => rail.querySelector<HTMLButtonElement>('[aria-label="Lọc patch early-season-patch"]')!.click())
    assert.deepEqual(selected, { seasonId: "season-new", variantId: "patch-early" })
    assert.equal(document.querySelector('[role="dialog"]'), null)
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Tùy chọn dòng thời gian"]')!
    assert.match(trigger.textContent!, /Tùy chọn/)
    await act(async () => trigger.click())
    const sheet = document.querySelector('[data-slot="sheet-content"]')!
    assert.ok(sheet.classList.contains("bottom-0"))
    const buttons = [...sheet.querySelectorAll<HTMLButtonElement>("button")]
    assert.equal(
      buttons.find((button) => button.textContent?.includes("Tất cả tướng"))?.getAttribute("aria-pressed"),
      "true",
    )
    const changes = buttons.find((button) => button.textContent?.includes("Chỉ thay đổi"))!
    await act(async () => changes.click())
    assert.equal(changes.getAttribute("aria-pressed"), "true")
    // A bottom sheet has no visible close; its hidden one, for screen readers, still closes it.
    await act(async () => buttons.find((button) => button.textContent?.trim() === "Đóng")!.click())
    assert.equal(document.querySelector('[data-slot="sheet-content"]'), null)
  })
})

test("catalog navigation remembers the season or patch, pins empty selections and respects explicit links", async () => {
  await withDocument(async (root, dom) => {
    const { MemoryRouter, useNavigate, useSearchParams } = await import("react-router")
    const { useCatalogScopePreference, useSavedCatalogScope } =
      await import("../src/features/publishing/components/catalog/catalog-scope-memory")
    const { CatalogTimeline } = await import("../src/features/publishing/components/catalog/catalog-timeline")
    const { catalogOverview } = await import("./fixtures/hero-catalog-data")
    let go: (to: string) => void
    let saved = ""
    function Host() {
      go = useNavigate()
      saved = useSavedCatalogScope()
      const [params] = useSearchParams()
      const value = useCatalogScopePreference(catalogOverview, {
        seasonId: params.get("season") ?? "",
        variantId: params.get("patch") ?? "",
      })
      return (
        <CatalogTimeline
          data={catalogOverview}
          value={value}
          allLabel="Tất cả"
          onChange={() => {}}
          currentFilter={{ seasonId: "season-new", variantId: "patch-current" }}
          counts={new Map(catalogOverview.variants.map((v) => [v.id, { changes: 0, baseline: 1 }]))}
        />
      )
    }
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/items?season=season-old&patch=patch-old"]}>
          <Host />
        </MemoryRouter>,
      ),
    )
    const patch = (name: string) => dom.window.document.querySelector(`button[aria-label="Lọc patch ${name}"]`)
    await act(async () => go("/arcana?color=RED"))
    assert.equal(patch("old-season-patch")?.getAttribute("aria-pressed"), "true")
    assert.ok(patch("old-season-patch")?.querySelector('[aria-label="Mốc đã chọn"]'))
    assert.ok(patch("current-patch"), "The current patch stays visible even in a different season")
    assert.equal(patch("early-season-patch"), null)
    await act(async () => go("/spells?emptyPatches=show&show=changes&season=season-old&patch=patch-old"))
    const trigger = dom.window.document.querySelector<HTMLButtonElement>(
      'button[aria-label="Tùy chọn dòng thời gian"]',
    )!
    await act(async () => {
      const enter = new dom.window.Event("pointerover", { bubbles: true })
      Object.defineProperty(enter, "pointerType", { value: "mouse" })
      trigger.dispatchEvent(enter)
    })
    const check = await waitFor(() =>
      dom.window.document.querySelector<HTMLInputElement>('[data-slot="popover-content"] input[type=checkbox]'),
    )
    assert.ok(check?.checked)
    await act(async () => check.click())
    assert.equal(patch("current-patch")?.getAttribute("aria-pressed"), "true")
    assert.equal(patch("old-season-patch"), null)
    assert.equal(new URLSearchParams(saved).get("patch"), "patch-current")
    await act(async () => go("/spells?season=season-old&patch=patch-old"))
    assert.equal(patch("old-season-patch")?.getAttribute("aria-pressed"), "true")
    await act(async () => go("/items?season=season-old"))
    await act(async () => go("/enchantments"))
    assert.equal(dom.window.document.querySelector('[aria-label="Lọc mùa S3"]')?.getAttribute("aria-pressed"), "true")
    assert.equal(patch("old-season-patch"), null)
  })
})

test("hero change summaries show a single overall assessment and open accessible details", async () => {
  await withDocument(async (root, dom) => {
    const { HeroChangeSummary, ChangeKindBadge, curatedChangeKinds } =
      await import("../src/features/publishing/components/patch-changes/hero-change-badges")
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
    const { HeroChangeSummary } = await import("../src/features/publishing/components/patch-changes/hero-change-badges")
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
    const { CatalogContext } = await import("../src/features/publishing/components/catalog/catalog-context")
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

test("timeline preserves catalog display mode across patches and hides data filters in market configuration", async () => {
  await withDocument(async (root, dom) => {
    const { MemoryRouter, useSearchParams } = await import("react-router")
    const { CatalogTimeline } = await import("../src/features/publishing/components/catalog/catalog-timeline")
    const { catalogScopePatch } = await import("@/lib/catalog-scope")
    const { patchHeroLocation } = await import("../src/features/publishing/model/hero-location")
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
    function Host({ configuration = false }: { configuration?: boolean }) {
      const [params, setParams] = useSearchParams()
      current = params
      return (
        <CatalogTimeline
          data={data}
          value={{ seasonId: params.get("season") ?? "", variantId: params.get("patch") ?? "" }}
          onChange={(next) => setParams((previous) => patchHeroLocation(previous, catalogScopePatch(next)))}
          allLabel={configuration ? undefined : "Tất cả trang bị"}
          showCounts={!configuration}
          counts={new Map([["late", { changes: 0, baseline: 3 }]])}
        />
      )
    }
    const render = async (configuration = false) =>
      act(async () =>
        root.render(
          <MemoryRouter initialEntries={["/hero?q=Lauriel&domain=heroes"]}>
            <Host configuration={configuration} />
          </MemoryRouter>,
        ),
      )
    const document = dom.window.document
    const button = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label)
    const click = async (element: HTMLElement | undefined | null) => {
      assert.ok(element)
      await act(async () => element.click())
    }
    const status = () => document.querySelector('[role="status"]')!.textContent!
    await render()
    assert.equal(button("Danh mục chung"), undefined)
    assert.equal(button("Chỉ thay đổi"), undefined)
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Lọc mùa S4 2026"]'))
    assert.equal(current.get("season"), "s4")
    assert.equal(document.querySelector('[aria-label="Lọc patch 15/11"]'), null)
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Tùy chọn dòng thời gian"]'))
    await click(document.querySelector<HTMLInputElement>('[data-slot="popover-content"] input[type=checkbox]'))
    assert.ok(document.querySelector('[aria-label="Lọc patch 15/11"]'))
    assert.equal(current.get("emptyPatches"), "show")
    assert.equal(button("Tất cả trang bị")!.getAttribute("aria-pressed"), "true")
    await click(button("Chỉ thay đổi"))
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Lọc patch 30/10"]'))
    assert.equal(current.get("show"), "changes")
    assert.match(status(), /S4 2026 · 30.10 · Chỉ thay đổi/)
    await render(true)
    assert.equal(button("Chỉ thay đổi"), undefined)
    assert.equal(button("Tất cả trang bị"), undefined)
    assert.equal(button("Danh mục chung"), undefined)
    assert.ok(document.querySelector('[aria-label="Lọc patch 15/11"]'))
    await render()
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Lọc mùa S4 2026"]'))
    assert.equal(current.get("show"), "changes")
    assert.equal(current.has("patch"), false)
    assert.equal(current.get("season"), "s4")
    assert.equal(current.get("q"), "Lauriel")
    assert.equal(current.get("domain"), "heroes")

    await click(document.querySelector<HTMLButtonElement>('[aria-label="Lọc patch 15/11"]'))
    assert.equal(current.get("patch"), "late")
    assert.equal(document.querySelector('[data-slot="sheet-content"]'), null)
    assert.match(status(), /S4 2026 · 15\/11 · Nháp · Chỉ thay đổi/)
  })
})

test("the track opens only the season being read and keeps the others as stops", async () => {
  await withDocument(async (root, dom) => {
    const { MemoryRouter } = await import("react-router")
    const { CatalogTimeline } = await import("../src/features/publishing/components/catalog/catalog-timeline")
    const variant = (id: string, patchCode: string, seasonId: string | null, rulesetOrdinal: number) => ({
      id,
      patchId: id,
      patchCode,
      seasonId,
      rulesetId: "rules",
      rulesetOrdinal,
      status: "PUBLISHED" as const,
    })
    const data: PublicationOverview = {
      asOf: "2026-11-28T00:00:00Z",
      rulesets: [{ id: "rules", code: "standard", description: null }],
      markets: [],
      assignments: [],
      seasonSchedules: [],
      releases: [],
      seasons: [
        { id: "s3", code: "s3", displayName: "S3 2026", ordinal: 3 },
        { id: "s4", code: "s4", displayName: "S4 2026", ordinal: 4 },
      ],
      variants: [
        variant("old-a", "2023-12-20", null, 1),
        variant("old-b", "2024-01-24", null, 2),
        variant("summer", "2026-08-26", "s3", 3),
        variant("autumn", "2026-10-30", "s4", 4),
        variant("now", "2026-11-17", "s4", 5),
      ],
    }
    let selected: CatalogFilter | undefined
    const render = (value: CatalogFilter) =>
      act(async () =>
        root.render(
          <MemoryRouter>
            <CatalogTimeline
              data={data}
              value={value}
              showCounts={false}
              currentFilter={{ seasonId: "s4", variantId: "now" }}
              onChange={(next) => {
                selected = next
              }}
            />
          </MemoryRouter>,
        ),
      )
    const document = dom.window.document
    const patch = (code: string) => document.querySelector<HTMLButtonElement>(`[aria-label="Lọc patch ${code}"]`)
    const chapter = () => document.querySelector("[data-chapter]")!

    await render({ seasonId: "s3", variantId: "summer" })
    assert.equal(document.querySelectorAll("[data-chapter]").length, 1)
    assert.match(chapter().textContent!, /S3 2026.*26\/08/)
    assert.equal(patch("2026-10-30"), null, "A closed season hides its patches")
    assert.ok(patch("2026-11-17"), "but keeps the current one beside its name")
    const older = document.querySelector<HTMLButtonElement>('[aria-label="Mở patch chưa gắn mùa"]')!
    assert.equal(older.textContent, "2023–2024")
    await act(async () => older.click())
    assert.deepEqual(selected, { seasonId: "", variantId: "old-b" })

    await render({ seasonId: "", variantId: "old-a" })
    assert.match(chapter().textContent!, /2023–2024.*20\/12.*2024.*24\/01/, "A group over years marks each new year")
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Lọc mùa S4 2026"]')!.click())
    assert.deepEqual(selected, { seasonId: "s4", variantId: "" })

    await render({ seasonId: "s4", variantId: "" })
    assert.equal(document.querySelector('[aria-label="Lọc mùa S4 2026"]')!.getAttribute("aria-pressed"), "true")
    assert.ok(patch("2026-10-30"))
    assert.equal(patch("2026-08-26"), null)
  })
})
