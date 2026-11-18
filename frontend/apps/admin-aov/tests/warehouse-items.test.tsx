import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import type { WarehouseEntry } from "../src/features/warehouse/model/warehouse-types"
import type { ItemContent } from "@aov/ui/lib/warehouse-content"
import { withWarehouseUi, fixtureRevision } from "./fixtures/warehouse-ui"
import { flush, installGlobals } from "./fixtures/dom"

test("item details show verified upgrades and select pictured ingredients only after an explicit choice", async () => {
  await withWarehouseUi(async ({ document, render, click, client }) => {
    document.defaultView!.HTMLElement.prototype.scrollIntoView = () => {}
    const { ItemEditor } = await import("../src/features/warehouse/components/item-editor")
    const make = (id: string, name: string, ingredients: string[] = []): WarehouseEntry<ItemContent> => ({
      id,
      code: id,
      revision: { ...fixtureRevision(id), state: "PUBLISHED" },
      content: {
        iconAssetId: id,
        categoryCode: "thu",
        tier: 1,
        price: 300,
        shopPositions: [],
        recipeStatus: ingredients.length ? "VERIFIED" : "NONE",
        components: ingredients.map((itemId) => ({ itemId, quantity: 1 })),
        stats: [],
        notes: null,
        translations: [{ locale: "vi-VN", name }],
      },
    })
    const ring = make("ring", "Nhẫn hồng ngọc")
    const armor = make("armor", "Giáp hộ mệnh", [ring.id])
    const gem = make("gem", "Hồng thạch")
    const items = [ring, armor, gem, make("sword", "Kiếm ngắn")]
    for (const item of items)
      client.setQueryData(["media", "asset", item.id, "content"], { currentUrl: `/${item.id}.png` })
    const opened: string[] = []
    const saved: ItemContent[] = []
    const props = {
      items,
      relatedItems: items,
      locale: "vi-VN",
      categories: [],
      busy: false,
      onClose() {},
      onView: (item: WarehouseEntry<ItemContent>) => opened.push(item.id),
      onApply: (content: ItemContent) => saved.push(content),
    }
    await render(<ItemEditor {...props} entry={ring} editable={false} />)
    const upgrade = document.querySelector<HTMLButtonElement>('[aria-label="Xem Giáp hộ mệnh"]')!
    assert.equal(upgrade.querySelector("img")?.getAttribute("src"), "/armor.png")
    await act(async () => upgrade.click())
    assert.deepEqual(opened, [armor.id])
    assert.equal(document.querySelector('[aria-label="Thêm nguyên liệu"]'), null)

    const described = {
      ...ring,
      revision: fixtureRevision(ring.id),
      content: {
        ...ring.content,
        translations: [
          { locale: "vi-VN", name: "Nhẫn hồng ngọc", description: "+150 Máu tối đa\n\nHồi phục khi rời giao tranh" },
        ],
      },
    }
    await render(<ItemEditor key="draft" {...props} entry={described} editable />)
    const apply = () =>
      [...document.querySelectorAll("button")].find((button) => button.textContent === "Áp dụng vào bản đang sửa")
    // Applying appears next to the pencil only once something has changed.
    assert.equal(apply(), undefined)
    assert.match(
      document.querySelector('[id="item-section-text"]')?.textContent ?? "",
      /\+150 Máu tối đa[\s\S]*Hồi phục khi rời giao tranh/,
    )
    assert.deepEqual(
      [...document.querySelectorAll("button[aria-label]")]
        .map((button) => button.getAttribute("aria-label")!)
        .filter((label) => /sửa/i.test(label)),
      ["Sửa trang bị"],
    )
    await click("Sửa trang bị")
    assert.ok(document.querySelector('[aria-label="Trạng thái công thức"]'))
    assert.ok(document.querySelector('textarea, [contenteditable="true"]'))
    await click("Thêm nguyên liệu")
    assert.equal(apply(), undefined)
    assert.equal(document.querySelectorAll('[role="option"][cmdk-item]').length, 2)
    const search = document.querySelector<HTMLInputElement>('[aria-label="Tìm nguyên liệu"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(search, "hong thach")
      search.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
    const choices = [...document.querySelectorAll<HTMLElement>('[role="option"][cmdk-item]')]
    assert.equal(choices.length, 1)
    assert.match(choices[0].textContent!, /Hồng thạch/)
    assert.equal(choices[0].querySelector("img")?.getAttribute("src"), "/gem.png")
    await act(async () => choices[0].click())
    assert.ok(apply() && !apply()!.disabled)
    await act(async () => apply()!.click())
    assert.deepEqual(saved[0].components, [{ itemId: gem.id, quantity: 1 }])
    assert.equal(saved[0].recipeStatus, "VERIFIED")
    assert.deepEqual(ring.content.components, [])
  })
})

test("item cards separate recipe selection from opening details and hide ports on outer columns", async () => {
  await withWarehouseUi(async ({ document, render }) => {
    const { ItemShopGraph } = await import("../src/features/warehouse/components/item-shop-graph")
    const { Page } = await import("../src/components/page-header")
    const items: WarehouseEntry<ItemContent>[] = ["base", "middle", "final"].map((id, column) => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: id }],
        tier: column + 1,
        price: 100,
        categoryCode: "attack",
        shopPositions: [{ categoryCode: "attack", row: 0, column, variant: null }],
        recipeStatus: "NONE",
        components: [],
        stats: [],
      },
    }))
    let selected: string | null = null
    let opened: string | undefined
    const focusEvents: (string | null)[] = []
    await render(
      <>
        <div data-outside-blank>Outside page</div>
        <div role="dialog">
          <span data-dialog-blank>Dialog blank space</span>
        </div>
        <div data-page-tab="/arcana">
          <div data-other-tab-blank>Other tab blank space</div>
        </div>
        <div data-page-tab="/items" data-active="true">
          <div data-panel-blank>Tab panel blank space</div>
          <Page data-item-selection-surface>
            <div data-page-blank>Page blank space</div>
            <button type="button" data-page-action>
              Page action
            </button>
            <ItemShopGraph
              items={items}
              categories={[]}
              locale="vi-VN"
              selectedId={null}
              category="attack"
              onCategory={() => {}}
              onSelect={(id) => {
                opened = id
              }}
              onFocus={(id) => {
                selected = id
                focusEvents.push(id)
              }}
              onConnect={() => {}}
              onMove={() => {}}
              editable
            />
          </Page>
        </div>
      </>,
    )
    assert.equal(document.querySelector('button[aria-label="Ghép từ base"]'), null)
    assert.equal(document.querySelector('button[aria-label="Nâng cấp từ final"]'), null)
    assert.ok(document.querySelector('button[aria-label="Nâng cấp từ base"]'))
    assert.ok(document.querySelector('button[aria-label="Ghép từ final"]'))
    const select = document.querySelector<HTMLButtonElement>('button[aria-label="Chọn trang bị middle"]')!
    await act(async () => select.click())
    assert.equal(selected, "middle")
    assert.equal(opened, undefined)
    const open = document.querySelector<HTMLButtonElement>('button[aria-label="Xem trang bị middle"]')!
    await act(async () => open.click())
    assert.equal(opened, "middle")
    assert.equal(selected, "middle")
    assert.equal(open.parentElement?.querySelector("button button"), null)
    await act(async () => document.querySelector<HTMLElement>('[data-item-node="middle"]')!.click())
    assert.equal(selected, "middle", "Card padding does not clear selection")
    const port = document.querySelector<HTMLButtonElement>('[aria-label="Nâng cấp từ base"]')!
    await act(async () => port.click())
    assert.equal(port.getAttribute("aria-pressed"), "true")
    const empty = document.querySelector<HTMLElement>('[aria-label="Bảng vị trí trang bị"] > div')!
    await act(async () => {
      empty.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
      empty.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 40, clientY: 10 }))
      empty.click()
    })
    assert.equal(selected, "middle", "Dragging across blank space does not clear selection")
    await act(async () => empty.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, button: 0 })))
    await act(async () => empty.click())
    assert.equal(selected, null)
    assert.equal(port.getAttribute("aria-pressed"), "false")

    const page = document.querySelector<HTMLElement>("[data-item-selection-surface]")!
    const pageBlank = document.querySelector<HTMLElement>("[data-page-blank]")!
    const panel = document.querySelector<HTMLElement>('[data-page-tab="/items"]')!
    const panelBlank = document.querySelector<HTMLElement>("[data-panel-blank]")!
    const pointerDown = (target: HTMLElement) =>
      target.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
    await act(async () => {
      select.click()
      port.click()
    })
    const beforeControls = focusEvents.length
    await act(async () => document.querySelector<HTMLButtonElement>("[data-page-action]")!.click())
    assert.equal(focusEvents.length, beforeControls, "Same-page controls do not clear selection")
    await act(async () => document.querySelector<HTMLElement>("[data-outside-blank]")!.click())
    await act(async () => document.querySelector<HTMLElement>("[data-dialog-blank]")!.click())
    await act(async () => document.querySelector<HTMLElement>("[data-other-tab-blank]")!.click())
    assert.equal(focusEvents.length, beforeControls, "Other pages and portaled dialogs do not clear selection")
    assert.equal(port.getAttribute("aria-pressed"), "true")

    await act(async () => {
      pointerDown(pageBlank)
      pageBlank.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 40, clientY: 10 }))
      pageBlank.click()
    })
    assert.equal(selected, "middle", "Dragging outside the graph border does not clear selection")
    await act(async () => {
      pointerDown(pageBlank)
      page.dispatchEvent(new window.Event("scroll"))
      pageBlank.click()
    })
    assert.equal(selected, "middle", "Scrolling the page does not turn into a deselection click")

    page.hidden = true
    await act(async () => {
      pointerDown(pageBlank)
      pageBlank.click()
    })
    assert.equal(selected, "middle", "A hidden cached page cannot clear its selection")
    page.hidden = false
    page.setAttribute("inert", "")
    await act(async () => {
      pointerDown(pageBlank)
      pageBlank.click()
    })
    assert.equal(selected, "middle", "An inert cached page cannot clear its selection")
    page.removeAttribute("inert")

    await act(async () => {
      pointerDown(pageBlank)
      pageBlank.click()
    })
    assert.equal(selected, null, "Blank space outside the graph border clears selection after a fresh pointer down")
    assert.equal(port.getAttribute("aria-pressed"), "false", "Clicking the page blank also cancels an armed connector")
    await act(async () => {
      select.click()
      port.click()
      pointerDown(page)
      page.click()
    })
    assert.equal(selected, null, "The page padding outside all child elements clears selection")
    assert.equal(port.getAttribute("aria-pressed"), "false")

    await act(async () => {
      select.click()
      port.click()
    })
    panel.hidden = true
    await act(async () => {
      pointerDown(panelBlank)
      panelBlank.click()
    })
    assert.equal(selected, "middle", "A hidden tab panel cannot clear its selection")
    panel.hidden = false
    await act(async () => {
      pointerDown(panelBlank)
      panelBlank.click()
    })
    assert.equal(selected, null, "Blank tab-panel space outside the Page element clears selection")
    assert.equal(port.getAttribute("aria-pressed"), "false")
    await act(async () => {
      select.click()
      port.click()
      pointerDown(panel)
      panel.click()
    })
    assert.equal(selected, null, "The tab scroll container padding clears selection")
    assert.equal(port.getAttribute("aria-pressed"), "false")
  })
})

test("item row picker keeps cancellation local, supports physical row selection and blocks undefined columns", async () => {
  await withWarehouseUi(async ({ document, render, click }) => {
    const { ItemRowPicker } = await import("../src/features/warehouse/components/item-row-picker")
    const entry: WarehouseEntry<ItemContent> = {
      id: "edited",
      code: "edited",
      revision: fixtureRevision("edited"),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: "Kiếm thử" }],
        tier: 2,
        price: 100,
        categoryCode: "attack",
        shopPositions: [{ categoryCode: "attack", row: 2, column: 1, variant: null }],
        recipeStatus: "NONE",
        components: [],
        stats: [],
      },
    }
    let selected: number | null | undefined
    const props = {
      entry,
      items: [entry],
      positionIndex: 0,
      locale: "vi-VN",
      contextLabel: "Công",
      disabled: false,
      onChange: (row: number | null) => {
        selected = row
      },
    }
    await render(<ItemRowPicker {...props} />)
    const open = () => document.querySelector<HTMLButtonElement>('[aria-label="Điều chỉnh hàng vị trí 1"]')!
    await act(async () => open().click())
    assert.ok(document.querySelector('[aria-label="Kéo Kiếm thử"]'))
    await click("Lên")
    await click("Hủy")
    assert.equal(selected, undefined)
    await act(async () => open().click())
    assert.equal(document.querySelector('[aria-label="Chọn hàng 3"]')?.getAttribute("aria-pressed"), "true")
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Chọn hàng 1"]')!.click())
    await click("Chọn hàng 1")
    assert.equal(selected, 0)
    assert.equal(entry.content.shopPositions[0].row, 2)
    await render(<ItemRowPicker key="disabled" {...props} disabled />)
    assert.equal(open().disabled, true)
    await render(
      <ItemRowPicker
        key="unassigned"
        {...props}
        entry={{
          ...entry,
          content: {
            ...entry.content,
            shopPositions: [{ categoryCode: "attack", row: null, column: null, variant: null }],
          },
        }}
      />,
    )
    assert.equal(open().disabled, true)
    assert.match(document.body.textContent!, /Chọn cột trước khi xếp hàng/)
    assert.equal(document.querySelector('input[type="number"]'), null)
  })
})

test("shop paints wire underlays first and skips unchanged layout measurements during scrolling", async () => {
  await withWarehouseUi(async ({ document, render }) => {
    const { ItemShopGraph } = await import("../src/features/warehouse/components/item-shop-graph")
    const callbacks: (() => void)[] = []
    // The fixture puts its globals back when the test ends, this observer included.
    installGlobals({
      ResizeObserver: class {
        constructor(private callback: () => void) {}
        observe(node: Element) {
          if (node.hasAttribute("data-item-node") && !callbacks.includes(this.callback)) callbacks.push(this.callback)
        }
        unobserve() {}
        disconnect() {}
      },
    })
    const items: WarehouseEntry<ItemContent>[] = ["base", "other", "target"].map((id, column) => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: id }],
        tier: column + 1,
        price: 100,
        categoryCode: "attack",
        shopPositions: [{ categoryCode: "attack", row: 0, column, variant: null }],
        recipeStatus: "VERIFIED",
        components:
          id === "target"
            ? [
                { itemId: "base", quantity: 1 },
                { itemId: "other", quantity: 1 },
              ]
            : [],
        stats: [],
      },
    }))
    let commits = 0
    const shop = (selectedId: string | null) => (
      <React.Profiler id="shop" onRender={() => commits++}>
        <ItemShopGraph
          items={items}
          categories={[]}
          locale="vi-VN"
          selectedId={selectedId}
          category="attack"
          onCategory={() => {}}
          onSelect={() => {}}
          onFocus={() => {}}
          onConnect={() => {}}
          onMove={() => {}}
          editable={false}
        />
      </React.Profiler>
    )
    await render(shop(null))
    assert.equal(callbacks.length, 0, "No geometry observation is needed without visible recipe wires")
    await render(shop("target"))
    const resize = callbacks.at(-1)!
    assert.ok(resize)
    const canvas = document.querySelector<HTMLElement>('[aria-label="Bảng vị trí trang bị"] > div')!
    let scrollOffset = 0
    const bounds = (x: number, y: number, width: number, height: number) =>
      ({ left: x, right: x + width, top: y - scrollOffset, bottom: y + height - scrollOffset }) as DOMRect
    canvas.getBoundingClientRect = () => bounds(0, 0, 968, 300)
    for (const [index, node] of [...canvas.querySelectorAll<HTMLElement>("[data-item-node]")].entries())
      node.getBoundingClientRect = () => bounds(28 + index * 320, 40, 272, 80)
    const notify = async () => {
      await act(async () => {
        resize()
        resize()
      })
      await flush()
    }
    await notify()
    const wires = [...canvas.querySelectorAll("[data-recipe-line]")]
    const halos = [...canvas.querySelectorAll("[data-recipe-halo]")]
    assert.equal(wires.length, 2)
    assert.equal(halos.length, 2)
    for (const halo of halos)
      for (const wire of wires)
        assert.ok(
          halo.compareDocumentPosition(wire) & document.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING,
          "Every underlay must paint before every recipe wire so overlapping paths cannot erase earlier lines",
        )
    const before = commits
    scrollOffset = 240
    canvas.parentElement!.dispatchEvent(new window.Event("scroll"))
    await notify()
    assert.equal(commits, before, "Moving the viewport without changing card geometry must not rerender the shop")
    assert.equal(
      canvas.querySelector('svg[aria-label="Đường ghép của trang bị được chọn"]')?.hasAttribute("width"),
      false,
      "The wire layer sizes itself without layout state",
    )
  })
})

test("connector drag previews its wire, snaps near compatible targets, and cancels without creating a recipe", async () => {
  await withWarehouseUi(async ({ document, render }) => {
    const { ItemShopGraph } = await import("../src/features/warehouse/components/item-shop-graph")
    const items: WarehouseEntry<ItemContent>[] = ["base", "target"].map((id, column) => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: id }],
        tier: column + 1,
        price: 100,
        categoryCode: "attack",
        shopPositions: [{ categoryCode: "attack", row: 0, column, variant: null }],
        recipeStatus: "NONE",
        components: [],
        stats: [],
      },
    }))
    const connected: string[][] = []
    await render(
      <ItemShopGraph
        items={items}
        categories={[]}
        locale="vi-VN"
        selectedId={null}
        category="attack"
        onCategory={() => {}}
        onSelect={() => {}}
        onFocus={() => {}}
        onConnect={(from, to) => {
          connected.push([from, to])
        }}
        onMove={() => {}}
        editable
      />,
    )
    const source = document.querySelector<HTMLButtonElement>('[aria-label="Nâng cấp từ base"]')!
    const target = document.querySelector<HTMLButtonElement>('[aria-label="Ghép từ target"]')!
    const canvas = document.querySelector<HTMLElement>('[aria-label="Bảng vị trí trang bị"] > div')!
    const rect = (left: number, right: number, top = 78, bottom = 122) => ({
      left,
      right,
      top,
      bottom,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      toJSON() {},
    })
    source.getBoundingClientRect = () => rect(100, 132)
    target.getBoundingClientRect = () => rect(300, 332)
    canvas.getBoundingClientRect = () => rect(0, 800, 0, 300)
    Object.assign(source, { setPointerCapture() {}, hasPointerCapture: () => false })
    const pointer = (type: string, x: number, y = 100) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        pointerId: { value: 7 },
        pointerType: { value: "mouse" },
        button: { value: 0 },
        buttons: { value: 1 },
        clientX: { value: x },
        clientY: { value: y },
      })
      source.dispatchEvent(event)
    }
    await act(async () => {
      pointer("pointerdown", 116)
      pointer("pointermove", 220)
    })
    await flush()
    const preview = document.querySelector('[data-connection-preview="dragging"]')!
    assert.ok(preview)
    assert.match(preview.querySelectorAll("path")[1].getAttribute("d")!, /^M.* C/)
    assert.equal(target.getAttribute("data-connection-compatible"), "true")
    await act(async () => {
      pointer("pointermove", 284)
    })
    await flush()
    assert.ok(document.querySelector('[data-connection-preview="snapped"]'))
    assert.equal(target.getAttribute("data-connection-target"), "true")
    await act(async () => pointer("pointerup", 284))
    assert.deepEqual(connected, [["base", "target"]])
    assert.equal(document.querySelector("[data-connection-preview]"), null)
    assert.equal(target.getAttribute("data-connection-target"), null)
    await act(async () => {
      pointer("pointerdown", 116)
      pointer("pointermove", 220)
    })
    await flush()
    await act(async () =>
      window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })),
    )
    assert.equal(document.querySelector("[data-connection-preview]"), null)
    await act(async () => pointer("pointerup", 316))
    assert.equal(connected.length, 1)
  })
})

test("shop separates terminal column two items and renders external attributes beneath their real columns", async () => {
  await withWarehouseUi(async ({ document, render }) => {
    const { ItemShopGraph } = await import("../src/features/warehouse/components/item-shop-graph")
    const make = (
      id: string,
      name: string,
      tier: number,
      categoryCode: string,
      column: number,
      row: number,
      components: ItemContent["components"] = [],
    ): WarehouseEntry<ItemContent> => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name }],
        tier,
        price: 100,
        categoryCode,
        shopPositions: [{ categoryCode, row, column, variant: null }],
        recipeStatus: "VERIFIED",
        components,
        stats: [],
      },
    })
    const items = [
      make("sword", "Kiếm ngắn", 1, "attack", 0, 0),
      make("mace", "Chùy cổ", 3, "attack", 1, 1, [{ itemId: "sword", quantity: 1 }]),
      make("gloves", "Găng giác đấu", 1, "defense", 0, 2),
      make("uriel", "Gươm Uriel", 3, "attack", 1, 7, [
        { itemId: "mace", quantity: 1 },
        { itemId: "gloves", quantity: 1 },
      ]),
    ]
    items[0].changeKinds = ["INHERITED"]
    items[3].changeKinds = ["BUFF"]
    const original = structuredClone(items)
    let focus: string | null = "uriel",
      opened: string | undefined
    await render(
      <ItemShopGraph
        items={items}
        categories={[{ code: "defense", translations: [{ locale: "vi-VN", name: "Thủ" }] }] as never}
        locale="vi-VN"
        selectedId="uriel"
        category="attack"
        onCategory={() => {}}
        onSelect={(id) => {
          opened = id
        }}
        onFocus={(id) => {
          focus = id
        }}
        onConnect={() => {}}
        onMove={() => {}}
        editable
      />,
    )
    const terminal = document.querySelector('[aria-label^="Trang bị hoàn chỉnh · Cột 2"]')!
    assert.match(terminal.textContent!, /Gươm Uriel/)
    assert.doesNotMatch(terminal.textContent!, /Cấp 3/)
    assert.match(document.querySelector('[data-item-node="mace"]')!.textContent!, /Cấp 3/)
    assert.equal(document.querySelector('[data-catalog-change="INHERITED"]'), null)
    assert.ok(terminal.querySelector('[data-catalog-change="BUFF"]'))
    assert.equal(terminal.querySelector('[aria-label="Nâng cấp từ Gươm Uriel"]'), null)
    assert.ok(terminal.querySelector('[aria-label="Ghép từ Gươm Uriel"]'))
    assert.ok(document.querySelector('[aria-label="Nâng cấp từ Chùy cổ"]'))
    const external = document.querySelector('[aria-label="Thuộc tính khác · Thủ · Cột 1"]')!
    assert.match(external.textContent!, /Thủ.*Thuộc tính khác.*Găng giác đấu/)
    assert.equal(
      external.closest('[aria-label="Cột 1"]')?.querySelector("[data-item-node]")?.getAttribute("data-item-node"),
      "sword",
    )
    assert.equal(document.querySelectorAll('[data-item-node="gloves"]').length, 1)
    assert.equal(external.querySelector('[aria-label="Di chuyển Găng giác đấu"]'), null)
    assert.equal(document.querySelector('[aria-label^="Vùng ghép của"]'), null)
    const terminalHelp = terminal.querySelector<HTMLButtonElement>(
      '[aria-label="Giải thích vùng trang bị hoàn chỉnh"]',
    )!
    await act(async () => terminalHelp.click())
    const terminalExplanation = document.querySelector('[role="dialog"]')!
    assert.ok(terminalExplanation)
    assert.match(terminalExplanation.textContent!, /Các món này không dùng làm nguyên liệu/)
    assert.match(terminalExplanation.textContent!, /không tạo thành từ trang bị ở cột 3/)
    assert.equal(focus, "uriel", "Opening region help preserves the selected item")
    assert.equal(opened, undefined)
    await act(async () => terminalHelp.click())
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(focus, "uriel", "Closing region help preserves the selected item")
    await act(async () => {
      terminalHelp.focus()
      terminalHelp.click()
    })
    assert.ok(document.querySelector('[role="dialog"]'))
    assert.equal(document.activeElement, terminalHelp)
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(focus, "uriel", "Escape closes region help without clearing the selected item")
    const externalHelp = external.querySelector<HTMLButtonElement>('[aria-label="Giải thích vùng thuộc tính Thủ"]')!
    await act(async () => externalHelp.click())
    const externalExplanation = document.querySelector('[role="dialog"]')!
    assert.ok(externalExplanation)
    assert.match(externalExplanation.textContent!, /thuộc nhóm Thủ/i)
    assert.match(externalExplanation.textContent!, /quan hệ ghép với Gươm Uriel/)
    assert.equal(focus, "uriel")
    await act(async () => externalHelp.click())
    assert.equal(document.querySelector('[role="dialog"]'), null)
    await act(async () =>
      external.querySelector<HTMLButtonElement>('[aria-label="Chọn trang bị Găng giác đấu"]')!.click(),
    )
    assert.equal(focus, "gloves")
    assert.equal(opened, undefined)
    await act(async () => terminal.querySelector<HTMLButtonElement>('[aria-label="Xem trang bị Gươm Uriel"]')!.click())
    assert.equal(opened, "uriel")
    assert.deepEqual(items, original)
    const magic = [
      make("orb", "Cầu chiêm tinh", 2, "magic", 1, 8),
      make("penetration", "Xuyên tâm lệnh", 3, "magic", 1, 9),
      make("emerald", "Dây chuyền lục bảo", 3, "magic", 1, 7),
      make("burst", "Trượng bùng nổ", 3, "magic", 2, 0, [{ itemId: "orb", quantity: 1 }]),
    ]
    await render(
      <ItemShopGraph
        items={magic}
        categories={[]}
        locale="vi-VN"
        selectedId="orb"
        category="magic"
        onCategory={() => {}}
        onSelect={() => {}}
        onFocus={() => {}}
        onConnect={() => {}}
        onMove={() => {}}
        editable
      />,
    )
    const secondColumn = document.querySelector('[aria-label="Cột 2"]')!
    assert.deepEqual(
      [...secondColumn.querySelectorAll("[data-item-node]")].map((node) => node.getAttribute("data-item-node")),
      ["emerald", "orb", "penetration"],
    )
    const orb = secondColumn.querySelector('[data-item-node="orb"]')!
    assert.equal(orb.closest('[aria-label^="Trang bị hoàn chỉnh"]'), null)
    assert.ok(orb.querySelector('[aria-label="Nâng cấp từ Cầu chiêm tinh"]'))
    assert.equal(secondColumn.querySelectorAll('[aria-label^="Trang bị hoàn chỉnh"]').length, 2)
  })
})
