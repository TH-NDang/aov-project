import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import {
  insertReference,
  mentionAt,
  referenceChoices,
  safeSelection,
  wrapSelection,
} from "@aov/ui/lib/entity-rich-text-editor"
import { createEntityIndex, parseRichText, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import {
  referenceInput,
  fillReferenceInput,
  selectReferenceInput,
  referenceInputValue,
  referenceInputSelection,
} from "./fixtures/reference-input"

const entities: EntityReference[] = [
  {
    id: "hero-1",
    kind: "hero",
    icon: "/images/lu-bo.png",
    translations: [{ locale: "vi-VN", name: "Lữ Bố", aliases: ["Chiến thần"], description: "Mô tả" }],
  },
  {
    id: "term-1",
    kind: "term",
    translations: [{ locale: "en-US", name: "True damage", aliases: [], description: "" }],
  },
]
test("editor serialization preserves source, Unicode, selection boundaries and stable identities", () => {
  assert.equal(mentionAt("mail@example.com", { start: 16, end: 16 }), null)
  assert.equal(mentionAt("@example.com", { start: 12, end: 12 }), null)
  assert.deepEqual(mentionAt("Xin @Lữ Bố", { start: 10, end: 10 }), { start: 4, end: 10, query: "Lữ Bố" })
  assert.equal(mentionAt("@Lữ", { start: 0, end: 3 }), null)
  assert.deepEqual(mentionAt("<b>@Lữ</b>", { start: 6, end: 6 }), { start: 3, end: 6, query: "Lữ" })
  const original = "Tấn công Lữ Bố."
  const bold = wrapSelection(original, { start: 9, end: 14 }, "b")!
  assert.equal(bold.value, "Tấn công <b>Lữ Bố</b>.")
  assert.equal(bold.value.slice(bold.start, bold.end), "Lữ Bố")
  const italic = wrapSelection(bold.value, { start: bold.start, end: bold.end }, "i")!
  assert.equal(italic.value, "Tấn công <b><i>Lữ Bố</i></b>.")
  assert.equal(wrapSelection(original, { start: 0, end: 2 }, "color", "red;display:none"), null)
  const mention = insertReference("Xin @Lữ", { start: 4, end: 7 }, entities[0]!, "Lữ Bố", false)!
  assert.equal(mention.value, "Xin <ref=hero:hero-1>Lữ Bố</ref>")
  assert.equal(mention.start, mention.value.length)
  assert.equal(safeSelection(mention.value, { start: 23, end: 23 }), false)
  assert.equal(insertReference(mention.value, { start: 23, end: 23 }, entities[1]!, "term"), null)
  assert.equal(wrapSelection("<b>text</b>", { start: 1, end: 5 }, "i"), null)
  assert.equal(wrapSelection("<b>text</b>", { start: 3, end: 10 }, "i"), null)
  assert.equal(referenceChoices(entities, "vi-VN", "en-US", "lu bo")[0]?.entity.id, "hero-1")
  assert.equal(referenceChoices(entities, "vi-", "en-US", "")[0]?.translation.locale, "en-US")
  const equipment: EntityReference = {
    id: "phi-tieu",
    kind: "item",
    autoMatch: false,
    icon: "/images/phi-tieu.png",
    translations: [{ locale: "vi-VN", name: "Phi Tiêu", aliases: [], description: "" }],
  }
  assert.equal(referenceChoices([equipment], "vi-VN", "vi-VN", "phi tieu")[0]?.entity.icon, "/images/phi-tieu.png")
  const reopened = JSON.parse(JSON.stringify({ description: italic.value })).description as string
  const nodes = parseRichText(reopened, createEntityIndex(entities, "vi-VN", "en-US"))
  assert.equal(nodes[1]?.type, "strong")
  assert.equal(reopened, italic.value)
})

test("editor mention keyboard, IME, selection, paste, undo/redo and reopening retain exact text", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", pretendToBeVisual: true })
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
    MutationObserver: dom.window.MutationObserver,
    HTMLInputElement: dom.window.HTMLInputElement,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { EntityRichTextEditor } = await import("@aov/ui/components/entity-rich-text-editor")
  let saved = ""
  function Harness({
    initial = "",
    catalog = entities,
    resolveIcon,
  }: {
    initial?: string
    catalog?: EntityReference[]
    resolveIcon?: EntityIconResolver
  }) {
    const [value, setValue] = React.useState(initial)
    return (
      <EntityRichTextEditor
        label="Mô tả QA"
        value={value}
        onChange={(value) => {
          saved = value
          setValue(value)
        }}
        entities={catalog}
        resolveIcon={resolveIcon}
        locale="vi-VN"
      />
    )
  }
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const area = () => referenceInput(document)
  const type = async (text: string) =>
    act(async () => {
      fillReferenceInput(area(), text)
    })
  const key = async (name: string, extras: KeyboardEventInit = {}) =>
    act(async () =>
      area().dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...extras }),
      ),
    )
  const button = (name: string) =>
    [...document.querySelectorAll("button")].find(
      (node) => (node.getAttribute("aria-label") ?? node.textContent) === name,
    )!
  try {
    await act(async () => root.render(<Harness />))
    assert.equal(area().getAttribute("role"), "textbox")
    assert.equal(document.getElementById(area().getAttribute("aria-labelledby")!)?.textContent, "Mô tả QA")
    assert.equal(document.querySelector("textarea, input[type=hidden]"), null)
    await type("mail@example.com")
    assert.equal(document.querySelector('[role="listbox"]'), null)
    await type("Xin @Lữ")
    assert.ok(document.querySelector('[role="listbox"]'))
    const popup = document.querySelector<HTMLElement>('[data-slot="entity-reference-suggestions"]')!
    assert.ok(popup)
    assert.equal(document.querySelector('[data-slot="entity-rich-text-editor"]')!.contains(popup), false)
    assert.ok(popup.style.maxHeight.includes("--radix-popover-content-available-height"))
    assert.ok(document.querySelector('[role="listbox"]')!.classList.contains("overflow-y-auto"))
    await key("Escape")
    assert.equal(referenceInputValue(area()), "Xin @Lữ")
    await type("Xin @Lu")
    await key("ArrowDown")
    await key("Enter")
    assert.equal(saved, "Xin <ref=hero:hero-1>Lữ Bố</ref>")
    assert.equal(referenceInputValue(area()), saved)
    assert.deepEqual(referenceInputSelection(area()), { start: saved.length, end: saved.length })
    const heroChip = area().querySelector<HTMLElement>('[data-reference-kind="hero"]')!
    assert.ok(heroChip)
    assert.equal(heroChip.getAttribute("contenteditable"), "false")
    assert.equal(heroChip.getAttribute("data-reference-id"), "hero-1")
    assert.equal(heroChip.getAttribute("data-reference-token"), "<ref=hero:hero-1>Lữ Bố</ref>")
    assert.ok(heroChip.textContent?.includes("Lữ Bố"))
    assert.ok(heroChip.querySelector('img[src="/images/lu-bo.png"]'))
    assert.ok(!area().textContent?.includes("<ref="))
    await key("z", { ctrlKey: true })
    assert.equal(saved, "Xin @Lu")
    await key("z", { ctrlKey: true, shiftKey: true })
    assert.ok(saved.includes("<ref=hero:hero-1>"))
    await type("Tiếng Việt")
    await act(async () => {
      selectReferenceInput(area(), 0, 5)
    })
    await act(async () => button("Đậm").click())
    assert.equal(saved, "<b>Tiếng</b> Việt")
    await act(async () => button("Hoàn tác").click())
    assert.equal(saved, "Tiếng Việt")
    await act(async () => button("Làm lại").click())
    assert.equal(saved, "<b>Tiếng</b> Việt")
    await act(async () => {
      selectReferenceInput(area(), saved.length)
      const event = new dom.window.Event("paste", { bubbles: true, cancelable: true })
      Object.defineProperty(event, "clipboardData", { value: { getData: () => "<script>alert(1)</script>" } })
      area().dispatchEvent(event)
    })
    assert.ok(saved.endsWith("<script>alert(1)</script>"))
    assert.equal(document.querySelector("script"), null)
    const roundTrip = saved
    await act(async () => root.render(<Harness key="reopen" initial={roundTrip} />))
    assert.equal(referenceInputValue(area()), roundTrip)
    await act(async () => area().dispatchEvent(new dom.window.CompositionEvent("compositionstart", { bubbles: true })))
    await type("@Lữ")
    assert.equal(document.querySelector('[role="listbox"]'), null)
    await key("Enter", { isComposing: true })
    assert.equal(saved, "@Lữ")
    await act(async () =>
      area().dispatchEvent(new dom.window.CompositionEvent("compositionend", { bubbles: true, data: "Lữ" })),
    )
    assert.ok(document.querySelector('[role="listbox"]'))
    await act(async () => document.querySelector<HTMLButtonElement>('[role="option"]')!.click())
    assert.equal(saved, "<ref=hero:hero-1>Lữ Bố</ref>")
    assert.ok(area().querySelector('[data-reference-kind="hero"][contenteditable="false"]'))
    const catalog: EntityReference[] = Array.from({ length: 12 }, (_, index) => ({
      id: `item-${index + 1}`,
      kind: "item",
      translations: [{ locale: "vi-VN", name: `Mục ${String(index + 1).padStart(2, "0")}`, aliases: [] }],
    }))
    await act(async () => root.render(<Harness key="all-results" catalog={catalog} />))
    await type("@Mục")
    assert.equal(document.querySelectorAll('[role="option"]').length, 12)
    await key("ArrowUp")
    assert.ok(document.querySelector('[role="option"][aria-selected="true"]')!.textContent?.includes("Mục 12"))
    await key("Enter")
    assert.equal(saved, "<ref=item:item-12>Mục 12</ref>")
    assert.equal(area().querySelector('[data-reference-kind="item"]')?.getAttribute("data-reference-id"), "item-12")
    const observed = new Set<Element>()
    let intersections!: IntersectionObserverCallback
    let observerCount = 0
    let observerRoot: Element | Document | null | undefined
    originals.set("IntersectionObserver", Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver"))
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          intersections = callback
          observerRoot = options?.root
          observerCount++
        }
        observe(element: Element) {
          observed.add(element)
        }
        unobserve(element: Element) {
          observed.delete(element)
        }
        disconnect() {
          observed.clear()
        }
      },
    })
    const iconRequests: string[] = []
    const withIcons = catalog.map((entry) => ({ ...entry, iconAssetId: entry.id }))
    await act(async () =>
      root.render(
        <Harness
          key="deferred-icons"
          catalog={withIcons}
          resolveIcon={async (entry) => {
            iconRequests.push(entry.id)
            return `/media/${entry.id}.webp`
          }}
        />,
      ),
    )
    await type("@Mục")
    const rows = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    const targets = rows.map((row) => row.querySelector("span")!)
    assert.equal(rows.length, 12)
    assert.equal(observerCount, 1)
    assert.equal(observerRoot, document.querySelector('[role="listbox"]'))
    assert.deepEqual(iconRequests, [])
    const enter = async (target: Element) =>
      act(async () =>
        intersections([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
      )
    await enter(targets[0]!)
    assert.deepEqual(iconRequests, ["item-1"])
    await key("ArrowUp")
    await enter(targets[11]!)
    assert.deepEqual(iconRequests, ["item-1", "item-12"])
    assert.ok(rows[11]!.querySelector('img[src="/media/item-12.webp"]'))
    await key("Escape")
    assert.equal(observed.size, 0)
  } finally {
    await act(async () => root.unmount())
    await new Promise((resolve) => setTimeout(resolve, 30))
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})

test("Vietnamese mention groups narrow names across all warehouse kinds and preserve stable references", () => {
  const rows: EntityReference[] = (
    [
      ["item", "Kiếm phép"],
      ["enchantment", "Cứu viện"],
      ["arcana", "Xanh III Giáp phép"],
      ["spell", "Tốc biến"],
    ] as const
  ).map(([kind, name]) => ({
    id: kind + "-1",
    kind,
    translations: [{ locale: "vi-VN", name, aliases: [], description: "" }],
  }))
  for (const [query, kind] of [
    ["@Trang bị", "item"],
    ["phu hieu cuu", "enchantment"],
    ["@Bảng ngọc xanh", "arcana"],
    ["Ngọc xanh", "arcana"],
    ["Phụ trợ", "spell"],
    ["Cứu viện", "enchantment"],
  ]) {
    const choices = referenceChoices(rows, "vi-VN", "vi-VN", query!)
    assert.equal(choices.length, 1, query)
    assert.equal(choices[0]!.entity.kind, kind)
    const inserted = insertReference("", { start: 0, end: 0 }, choices[0]!.entity, choices[0]!.translation.name)!
    assert.equal(parseRichText(inserted.value, createEntityIndex(rows, "vi-VN", "vi-VN"))[0]!.type, "reference")
  }
})
