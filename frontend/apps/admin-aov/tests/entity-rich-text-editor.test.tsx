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

const entities: EntityReference[] = [
  {
    id: "hero-1",
    kind: "hero",
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
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { EntityRichTextEditor } = await import("@aov/ui/components/entity-rich-text-editor")
  let saved = ""
  function Harness({ initial = "" }: { initial?: string }) {
    const [value, setValue] = React.useState(initial)
    return (
      <EntityRichTextEditor
        label="Mô tả QA"
        value={value}
        onChange={(value) => {
          saved = value
          setValue(value)
        }}
        entities={entities}
        locale="vi-VN"
      />
    )
  }
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const area = () => document.querySelector("textarea")!
  const type = async (text: string) =>
    act(async () => {
      const node = area()
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value")!.set!.call(node, text)
      node.setSelectionRange(text.length, text.length)
      node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
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
    await type("mail@example.com")
    assert.equal(document.querySelector('[role="listbox"]'), null)
    await type("Xin @Lữ")
    assert.ok(document.querySelector('[role="listbox"]'))
    await key("Escape")
    assert.equal(area().value, "Xin @Lữ")
    await type("Xin @Lu")
    await key("ArrowDown")
    await key("Enter")
    assert.equal(saved, "Xin <ref=hero:hero-1>Lữ Bố</ref>")
    assert.equal(area().selectionStart, saved.length)
    await key("z", { ctrlKey: true })
    assert.equal(saved, "Xin @Lu")
    await key("z", { ctrlKey: true, shiftKey: true })
    assert.ok(saved.includes("<ref=hero:hero-1>"))
    await type("Tiếng Việt")
    await act(async () => {
      area().focus()
      area().setSelectionRange(0, 5)
      area().dispatchEvent(new dom.window.Event("select", { bubbles: true }))
    })
    await act(async () => button("Đậm").click())
    assert.equal(saved, "<b>Tiếng</b> Việt")
    await act(async () => button("Hoàn tác").click())
    assert.equal(saved, "Tiếng Việt")
    await act(async () => button("Làm lại").click())
    assert.equal(saved, "<b>Tiếng</b> Việt")
    await act(async () => {
      area().setSelectionRange(saved.length, saved.length)
      const event = new dom.window.Event("paste", { bubbles: true, cancelable: true })
      Object.defineProperty(event, "clipboardData", { value: { getData: () => "<script>alert(1)</script>" } })
      area().dispatchEvent(event)
    })
    assert.ok(saved.endsWith("<script>alert(1)</script>"))
    assert.equal(document.querySelector("script"), null)
    const roundTrip = saved
    await act(async () => root.render(<Harness key="reopen" initial={roundTrip} />))
    assert.equal(area().value, roundTrip)
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
