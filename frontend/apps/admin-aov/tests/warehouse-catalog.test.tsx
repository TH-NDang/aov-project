import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import type { WarehouseEntry } from "../src/features/warehouse/warehouse-types"
import type { EnchantmentContent } from "@aov/ui/lib/warehouse-content"
import { withWarehouseUi, fixtureRevision } from "./fixtures/warehouse-ui"

test("timeline keeps baseline separate, selects a patch, and suppresses selection after horizontal dragging", async () => {
  await withWarehouseUi(async ({ document, render }) => {
    const { CatalogTimeline } = await import("../src/features/publishing/catalog-timeline")
    const data = {
      markets: [],
      seasons: [
        { id: "s3", displayName: "S3" },
        { id: "s4", displayName: "S4" },
      ],
      rulesets: [],
      releases: [],
      variants: [
        {
          id: "base",
          seasonId: "s3",
          rulesetId: "standard",
          rulesetOrdinal: 1,
          patchCode: "Nền S3",
          status: "PUBLISHED",
        },
        {
          id: "added",
          seasonId: "s4",
          rulesetId: "standard",
          rulesetOrdinal: 2,
          patchCode: "29/09",
          status: "PUBLISHED",
        },
        {
          id: "empty",
          seasonId: "s4",
          rulesetId: "standard",
          rulesetOrdinal: 3,
          patchCode: "15/10",
          status: "PUBLISHED",
        },
      ],
    } as unknown as import("../src/features/publishing/publication-overview").PublicationOverview
    let selected = { seasonId: "", variantId: "" }
    await render(
      <CatalogTimeline
        data={data}
        value={selected}
        onChange={(next) => {
          selected = next
        }}
        counts={
          new Map([
            ["base", { changes: 0, baseline: 31 }],
            ["added", { changes: 2, baseline: 0 }],
            ["empty", { changes: 0, baseline: 0 }],
          ])
        }
      />,
    )
    const button = (label: string) => document.querySelector<HTMLButtonElement>(`[aria-label="Lọc patch ${label}"]`)!
    assert.match(button("Nền S3").textContent!, /31 mục nhập dữ liệu/)
    assert.match(button("29/09").textContent!, /2 mục thay đổi/)
    assert.match(button("15/10").textContent!, /Chưa ghi nhận thay đổi/)
    await act(async () => button("29/09").click())
    assert.deepEqual(selected, { seasonId: "s4", variantId: "added" })
    const rail = button("29/09").closest<HTMLElement>('[aria-label="Chọn patch"]')!
    Object.defineProperties(rail, { clientWidth: { value: 300 }, scrollWidth: { value: 600 } })
    Object.assign(rail, { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} })
    const pointer = (type: string, x: number) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        pointerType: { value: "mouse" },
        pointerId: { value: 1 },
        button: { value: 0 },
        buttons: { value: 1 },
        clientX: { value: x },
      })
      rail.dispatchEvent(event)
    }
    await act(async () => {
      pointer("pointerdown", 220)
      pointer("pointermove", 100)
      pointer("pointerup", 100)
      button("15/10").click()
    })
    assert.equal(rail.scrollLeft, 120)
    await act(async () => {
      rail.dispatchEvent(new window.Event("scroll"))
    })
    assert.equal(document.querySelector('button[aria-label^="Cuộn "]'), null)
    assert.equal(selected.variantId, "added", "Dragging does not accidentally select a patch")
    await act(async () => button("15/10").click())
    assert.equal(selected.variantId, "empty")
    data.variants.find((v) => v.id === "empty")!.dataReviewState = "COMPLETE"
    await render(
      <CatalogTimeline
        data={data}
        value={{ seasonId: "", variantId: "" }}
        onChange={(next) => {
          selected = next
        }}
        counts={
          new Map([
            ["base", { changes: 0, baseline: 31 }],
            ["added", { changes: 2, baseline: 0 }],
            ["empty", { changes: 0, baseline: 0 }],
          ])
        }
      />,
    )
    assert.ok(button("15/10"), "A reviewed patch without changes remains available to inspect the catalog")
    assert.ok(button("29/09"))
    assert.deepEqual(
      [...document.querySelectorAll('[aria-label^="Lọc mùa"]')].map((season) => season.textContent),
      ["S3", "S4"],
    )
  })
})

test("compact references use real identities, all translations and lazy media in the selected ruleset", async () => {
  await withWarehouseUi(async ({ requests }) => {
    const { referenceCatalogApi } = await import("../src/features/terminology/reference-api")
    const references = await referenceCatalogApi.list()
    assert.equal(references[0].id, "item-uuid")
    assert.equal(references[0].iconAssetId, "item-icon")
    assert.deepEqual(
      references[0].translations.map((text) => text.locale),
      ["vi-VN", "en-US"],
    )
    assert.equal(references[0].autoMatch, false)
    assert.equal(references[0].destinations?.admin, "/items?item=item-uuid&ruleset=standard")
    assert.ok(requests.includes("/admin/reference-catalog"))
    assert.equal(requests.filter((path) => path.startsWith("/admin/media/")).length, 0)
    assert.equal(
      requests.some((path) => path.includes("resources")),
      false,
    )
    await referenceCatalogApi.list("regional")
    assert.ok(requests.includes("/admin/reference-catalog?rulesetId=regional"))
    assert.equal(requests.filter((path) => path.startsWith("/admin/reference-catalog")).length, 2)
    assert.equal(
      requests.some((path) => /^\/admin\/(items|heroes|rulesets)(\?|$)/.test(path)),
      false,
    )
  })
})

test("enchantment scope controls clear dependent patches and show both matching branches without hero-specific copy", async () => {
  await withWarehouseUi(async ({ document, render, click }) => {
    const { CatalogContext } = await import("../src/features/publishing/catalog-context")
    const { EnchantmentBranches } = await import("../src/features/warehouse/enchantment-branches")
    const data = {
      seasons: [
        { id: "s3", displayName: "S3 2026" },
        { id: "s4", displayName: "S4 2026" },
      ],
      variants: [
        { id: "baseline", patchCode: "s3-observed", seasonId: "s3", rulesetId: "standard", status: "PUBLISHED" },
        { id: "september", patchCode: "2026-09-29", seasonId: "s4", rulesetId: "standard", status: "PUBLISHED" },
        { id: "october", patchCode: "2026-10-15", seasonId: "s4", rulesetId: "standard", status: "PUBLISHED" },
      ],
      rulesets: [{ id: "standard", code: "aov-standard" }],
    } as unknown as import("../src/features/publishing/publication-overview").PublicationOverview
    const branches = ["tower", "chaos", "forest"].map((code, index) => ({
      code,
      version: 1,
      displayOrder: index,
      iconAssetId: null,
      backgroundAssetId: null,
      color: null,
      translations: [{ locale: "vi-VN", name: code }],
    }))
    const entries: WarehouseEntry<EnchantmentContent>[] = ["chaos", "forest"].map((branchCode) => ({
      id: branchCode,
      code: branchCode,
      revision: fixtureRevision(branchCode),
      changeKinds: ["INHERITED"],
      missingFields: [],
      content: {
        branchCode,
        tier: 2,
        position: 2,
        iconAssetId: null,
        translations: [{ locale: "vi-VN", name: branchCode }],
        notes: null,
      },
    }))
    let selected = { seasonId: "", variantId: "" }
    function Fixture() {
      const [scope, setScope] = React.useState(selected)
      selected = scope
      return (
        <>
          <CatalogContext
            data={data}
            value={scope}
            onChange={setScope}
            filteredDescription="Các phù hiệu tại mốc đã chọn."
            unfilteredDescription="Tất cả phù hiệu."
          />
          <EnchantmentBranches
            records={entries}
            branches={branches}
            active=""
            scoped
            onSelect={() => {}}
            onOpen={() => {}}
            selectedId=""
            locale="vi-VN"
            search=""
            canWrite={false}
            onEditBranch={() => {}}
          />
        </>
      )
    }
    await render(<Fixture />)
    const select = async (label: string, value: string) => {
      await act(async () => {
        const input = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
        input.value = value
        input.dispatchEvent(new document.defaultView!.Event("change", { bubbles: true }))
      })
    }
    await select("Mùa có thay đổi", "s4")
    assert.equal(document.querySelector('[data-catalog-change="INHERITED"]'), null)
    assert.deepEqual(selected, { seasonId: "s4", variantId: "" })
    assert.equal(document.querySelector('select[aria-label="Patch có thay đổi"] option[value="baseline"]'), null)
    await select("Patch có thay đổi", "september")
    assert.equal(selected.variantId, "september")
    assert.deepEqual(
      [...document.querySelectorAll("h2")].map((heading) => heading.textContent),
      ["chaos", "forest"],
    )
    assert.equal(document.querySelectorAll('[aria-label="Phù hiệu cấp II"]').length, 2)
    assert.equal(document.querySelector('[aria-label="Phù hiệu cấp I"]'), null)
    assert.equal(document.querySelector('[aria-label="Phù hiệu cấp III"]'), null)
    assert.equal(document.body.textContent?.includes("tướng"), false)
    await select("Mùa có thay đổi", "s3")
    assert.equal(selected.variantId, "")
    await click("Bỏ lọc")
    assert.deepEqual(selected, { seasonId: "", variantId: "" })
  })
})
