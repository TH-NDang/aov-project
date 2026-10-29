import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import {
  fillReferenceInput,
  referenceInput,
  referenceInputValue,
  selectReferenceInput,
} from "./fixtures/reference-input"

async function editorHarness(initial: string, catalog: EntityReference[] = []) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", pretendToBeVisual: true })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { EntityRichTextEditor } = await import("@aov/ui/components/entity-rich-text-editor")
  const document = dom.window.document
  const root = createRoot(document.getElementById("root")!)
  let saved = initial
  function Harness() {
    const [value, setValue] = React.useState(initial)
    return (
      <EntityRichTextEditor
        label="Mô tả hiệu năng"
        value={value}
        onChange={(value) => {
          saved = value
          setValue(value)
        }}
        entities={catalog}
        locale="vi-VN"
      />
    )
  }
  await act(async () => root.render(<Harness />))
  return {
    dom,
    document,
    input: () => referenceInput(document),
    saved: () => saved,
    type: (text: string) => act(async () => fillReferenceInput(referenceInput(document), text)),
    select: (start: number, end = start) => act(async () => selectReferenceInput(referenceInput(document), start, end)),
    click: (label: string) =>
      act(async () => {
        const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
          (button) => (button.getAttribute("aria-label") ?? button.textContent?.trim()) === label,
        )
        assert.ok(button, `Expected toolbar action: ${label}`)
        button.click()
      }),
    key: (key: string, extras: KeyboardEventInit = {}) =>
      act(async () =>
        referenceInput(document).dispatchEvent(
          new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extras }),
        ),
      ),
    preview: (open: boolean) =>
      act(async () => {
        const details = document.querySelector("details")!
        details.open = open
        details.dispatchEvent(new dom.window.Event("toggle", { bubbles: false }))
      }),
    close: async () => {
      await act(async () => root.unmount())
      dom.window.close()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}

test("ordinary typing and explicit suggestions reuse prepared indexes without rescanning translations", async () => {
  let translationReads = 0
  const targetName = "Vật phẩm 987 · Kiếm thánh thử nghiệm"
  const catalog = Array.from({ length: 1600 }, (_, index): EntityReference => {
    const translations = [
      {
        locale: "vi-VN",
        name: index === 987 ? targetName : `Vật phẩm ${index}`,
        aliases: [],
        description: "Mô tả tham chiếu",
      },
    ]
    return {
      id: `item-${index}`,
      kind: "item",
      get translations() {
        translationReads++
        return translations
      },
    }
  })
  const editor = await editorHarness("Mô tả ban đầu", catalog)
  try {
    assert.equal(editor.document.querySelector('[role="listbox"]'), null)
    assert.equal(editor.document.querySelector('[data-slot="entity-rich-text"]'), null)
    assert.ok(translationReads >= catalog.length, "The localized indexes are prepared once")
    translationReads = 0
    for (const suffix of [" đ", " đang", " đang gõ", " đang gõ bình", " đang gõ bình thường"])
      await editor.type(`Mô tả${suffix}`)
    assert.equal(editor.saved(), "Mô tả đang gõ bình thường")
    assert.equal(referenceInputValue(editor.input()), editor.saved())
    assert.equal(translationReads, 0, "Each ordinary keystroke must avoid a full localized catalog scan")

    await editor.type("Xin @")
    const list = editor.document.querySelector<HTMLElement>('[role="listbox"]')!
    assert.ok(list)
    assert.equal(
      list.querySelectorAll('[role="option"]').length,
      32,
      "A broad query mounts only its first result batch",
    )
    assert.ok(editor.document.querySelector('[role="status"]')?.textContent?.includes("1600 kết quả"))
    assert.equal(list.textContent?.includes(targetName), false, "The target is beyond the first visible batch")
    await act(async () => {
      Object.defineProperties(list, {
        scrollHeight: { configurable: true, value: 1200 },
        clientHeight: { configurable: true, value: 300 },
      })
      list.scrollTop = 900
      list.dispatchEvent(new editor.dom.window.Event("scroll", { bubbles: true }))
    })
    assert.equal(list.querySelectorAll('[role="option"]').length, 64, "Scrolling appends another result batch")
    assert.ok(editor.document.querySelector('[role="status"]')?.textContent?.includes("1600 kết quả"))
    assert.equal(list.textContent?.includes(targetName), false)

    await editor.type("Xin @Kiếm thánh")
    const options = [...editor.document.querySelectorAll('[role="listbox"] [role="option"]')]
    assert.equal(options.length, 1)
    assert.ok(options[0]!.textContent?.includes("Kiếm thánh thử nghiệm"))
    assert.equal(translationReads, 0, "An open query reuses the same localized search index")
    await editor.key("Enter")
    assert.equal(editor.saved(), `Xin <ref=item:item-987>${targetName}</ref>`)
    assert.equal(editor.input().querySelector("[data-reference-id]")?.getAttribute("data-reference-id"), "item-987")
    assert.equal(editor.document.querySelector('[role="listbox"]'), null)

    await editor.type("Mô tả mới")
    translationReads = 0
    await editor.type("Mô tả mới tiếp tục")
    assert.equal(translationReads, 0, "Closing suggestions restores the cheap typing path")
    assert.equal(editor.saved(), "Mô tả mới tiếp tục")
  } finally {
    await editor.close()
  }
})

test("ordinary full or partial names never open a picker and explicit mentions still insert chips", async () => {
  const hero: EntityReference = {
    id: "florentino",
    kind: "hero",
    translations: [{ locale: "vi-VN", name: "Florentino", aliases: [], description: "" }],
  }
  const editor = await editorHarness("", [hero])
  try {
    await editor.type("Chọn flo")
    assert.equal(editor.document.querySelector('[role="listbox"]'), null)
    assert.equal(editor.saved(), "Chọn flo")
    await editor.type("Chọn Florentino")
    assert.equal(editor.document.querySelector('[role="listbox"]'), null)
    assert.equal(editor.saved(), "Chọn Florentino")
    await editor.type("Chọn @flor")
    assert.ok(editor.document.querySelector('[role="option"]')?.textContent?.includes("Florentino"))
    await editor.key("Enter")
    assert.equal(editor.saved(), "Chọn <ref=hero:florentino>Florentino</ref>")
    assert.ok(editor.input().querySelector('[data-reference-kind="hero"]'))
    await editor.key("z", { ctrlKey: true })
    assert.equal(editor.saved(), "Chọn @flor")
  } finally {
    await editor.close()
  }
})

test("a collapsed preview stays unmounted and opening it renders the latest exact source through undo", async () => {
  const editor = await editorHarness("<b>Bản đầu</b>")
  try {
    const rendered = () => editor.document.querySelector<HTMLElement>('[data-slot="entity-rich-text"]')
    assert.equal(editor.document.querySelector("details")?.open, false)
    assert.equal(rendered(), null, "A closed details element must not mount the full reference renderer")
    await editor.type("Bản mới nhất")
    await editor.select(0, 3)
    await editor.click("Đậm")
    const formatted = "<b>Bản</b> mới nhất"
    assert.equal(editor.saved(), formatted)
    assert.equal(rendered(), null, "Editing while collapsed does not eagerly create the preview")

    await editor.preview(true)
    assert.ok(rendered())
    assert.equal(rendered()!.textContent, "Bản mới nhất")
    assert.equal(rendered()!.querySelector("strong")?.textContent, "Bản")
    assert.equal(referenceInputValue(editor.input()), formatted)
    await editor.type("Nội dung tiếp theo")
    assert.equal(editor.saved(), "Nội dung tiếp theo")
    assert.equal(rendered()!.textContent, "Nội dung tiếp theo")
    await editor.key("z", { ctrlKey: true })
    assert.equal(editor.saved(), formatted)
    assert.equal(referenceInputValue(editor.input()), formatted)
    assert.equal(rendered()!.textContent, "Bản mới nhất")
    assert.equal(rendered()!.querySelector("strong")?.textContent, "Bản")

    await editor.preview(false)
    await editor.type("Sau khi đóng")
    await editor.key("z", { ctrlKey: true })
    assert.equal(editor.saved(), formatted)
    await editor.preview(true)
    assert.equal(rendered()!.textContent, "Bản mới nhất")
    assert.equal(referenceInputValue(editor.input()), formatted)
  } finally {
    await editor.close()
  }
})
