import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { referenceFormatState, toggleReferenceFormat } from "@aov/ui/lib/reference-input-formatting"
import {
  referenceInput,
  referenceInputSelection,
  referenceInputValue,
  selectReferenceInput,
} from "./fixtures/reference-input"

const heroId = "00000000-0000-4000-8000-000000000001"
const skill: EntityReference = {
  id: `${heroId}.skill-1-2`,
  kind: "skill",
  heroId,
  skillKey: "skill-1-2",
  revisionId: "00000000-0000-4000-8000-000000000002",
  sourceSlot: 1,
  variantNo: 2,
  icon: "/skill.webp",
  translations: [{ locale: "vi-VN", name: "Phi tiêu", aliases: [], description: "" }],
  owner: {
    id: heroId,
    kind: "hero",
    icon: "/hero.webp",
    translations: [{ locale: "vi-VN", name: "Airi", aliases: [], description: "" }],
  },
}
const token = `<ref=skill:${skill.id}>Phi tiêu</ref>`

test("format transformations toggle mixed visible runs and retain atomic identities and collapsed styles", () => {
  const mixed = "a<b>b</b>c"
  assert.deepEqual(toggleReferenceFormat(mixed, { start: 0, end: mixed.length }, "b"), {
    value: "<b>abc</b>",
    start: 3,
    end: 6,
  })
  const nested = "<b>a<i>b</i>c</b>"
  assert.equal(toggleReferenceFormat(nested, { start: 0, end: nested.length }, "b")?.value, "a<i>b</i>c")
  const colored = "<color=#ff0000>ab</color>cd"
  assert.equal(
    toggleReferenceFormat(colored, { start: 0, end: colored.length }, "color", "#16a34a")?.value,
    "<color=#16a34a>abcd</color>",
  )
  const pending = toggleReferenceFormat("abc", { start: 1, end: 1 }, "b")!
  assert.deepEqual(pending, { value: "a<b></b>bc", start: 4, end: 4 })
  assert.equal(referenceFormatState(pending.value, pending).bold, true)
  assert.equal(referenceFormatState(mixed, { start: 0, end: mixed.length }).bold, false)
  assert.deepEqual(toggleReferenceFormat(pending.value, pending, "b"), { value: "abc", start: 1, end: 1 })
  assert.deepEqual(toggleReferenceFormat("<b>abc</b>", { start: 4, end: 4 }, "b"), {
    value: "<b>a</b><b>bc</b>",
    start: 8,
    end: 8,
  })
  const styledChip = `<b>${token}</b>`
  assert.equal(
    toggleReferenceFormat(styledChip, { start: 3, end: 3 + token.length }, "i")?.value,
    `<b><i>${token}</i></b>`,
  )
  assert.equal(
    toggleReferenceFormat(styledChip, { start: 3 + token.length, end: 3 + token.length }, "b")?.value,
    styledChip,
  )
  assert.equal(toggleReferenceFormat(token, { start: 1, end: token.length }, "b"), null)
  assert.equal(toggleReferenceFormat("<b>x</b>", { start: 1, end: 4 }, "i"), null)
  assert.equal(toggleReferenceFormat("text", { start: 0, end: 4 }, "color", "red;display:none"), null)
})

async function editorHarness(initial: string, catalog: EntityReference[] = [], withSidebar = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", pretendToBeVisual: true })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
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
  const sidebar = withSidebar ? await import("@aov/ui/components/sidebar") : null
  const document = dom.window.document
  const root = createRoot(document.getElementById("root")!)
  let saved = initial
  const changes: string[] = []
  function Harness({ catalog }: { catalog: EntityReference[] }) {
    const [value, setValue] = React.useState(initial)
    const editor = (
      <EntityRichTextEditor
        label="Mô tả định dạng"
        value={value}
        onChange={(value) => {
          saved = value
          changes.push(value)
          setValue(value)
        }}
        entities={catalog}
        locale="vi-VN"
        renderPreview={false}
      />
    )
    if (!sidebar) return editor
    const { SidebarProvider, Sidebar } = sidebar
    return (
      <SidebarProvider>
        <Sidebar collapsible="icon">Menu kiểm thử</Sidebar>
        <button type="button" data-testid="outside-editor">
          Ngoài ô nhập
        </button>
        {editor}
      </SidebarProvider>
    )
  }
  await act(async () => root.render(<Harness catalog={catalog} />))
  return {
    dom,
    document,
    input: () => referenceInput(document),
    saved: () => saved,
    changes,
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
    renderCatalog: (catalog: EntityReference[]) => act(async () => root.render(<Harness catalog={catalog} />)),
    clipboard: async (type: "copy" | "paste", entries: Record<string, string> = {}) => {
      const data = new Map(Object.entries(entries))
      await act(async () => {
        const event = new dom.window.Event(type, { bubbles: true, cancelable: true })
        Object.defineProperty(event, "clipboardData", {
          value: {
            getData: (kind: string) => data.get(kind) ?? "",
            setData: (kind: string, value: string) => data.set(kind, value),
          },
        })
        referenceInput(document).dispatchEvent(event)
      })
      return data
    },
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

test("editor bold shortcuts do not toggle the real sidebar while outside shortcuts still work", async () => {
  const editor = await editorHarness("Đậm ở đây", [], true)
  const sidebarState = () =>
    editor.document.querySelector('[data-slot="sidebar"][data-state]')!.getAttribute("data-state")
  try {
    assert.equal(sidebarState(), "expanded")
    await editor.select(0, 3)
    await editor.key("b", { ctrlKey: true })
    assert.equal(editor.saved(), "<b>Đậm</b> ở đây")
    assert.equal(editor.input().querySelector("strong")?.textContent, "Đậm")
    assert.equal(sidebarState(), "expanded", "Ctrl+B belongs to the focused editor")
    await editor.key("b", { metaKey: true })
    assert.equal(editor.saved(), "Đậm ở đây")
    assert.equal(sidebarState(), "expanded", "The editor also owns the platform-equivalent shortcut")

    const outside = editor.document.querySelector<HTMLButtonElement>('[data-testid="outside-editor"]')!
    const shortcut = async (prevented = false) =>
      act(async () => {
        outside.focus()
        const event = new editor.dom.window.KeyboardEvent("keydown", {
          key: "b",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
        if (prevented) event.preventDefault()
        outside.dispatchEvent(event)
      })
    await shortcut()
    assert.equal(sidebarState(), "collapsed", "The global sidebar shortcut remains available outside editable controls")
    await shortcut(true)
    assert.equal(sidebarState(), "collapsed", "A shortcut already handled by another control is not reused")
    await shortcut()
    assert.equal(sidebarState(), "expanded")
    assert.equal(editor.saved(), "Đậm ở đây")
  } finally {
    await editor.close()
  }
})

test("formatting toolbar renders bold, italic and color directly while preserving source and undo", async () => {
  const editor = await editorHarness("Tiếng Việt an toàn")
  try {
    await editor.select(0, 5)
    await editor.click("Đậm")
    assert.equal(editor.saved(), "<b>Tiếng</b> Việt an toàn")
    assert.equal(editor.input().querySelector("strong")?.textContent, "Tiếng")
    assert.equal(editor.input().textContent, "Tiếng Việt an toàn")
    assert.deepEqual(referenceInputSelection(editor.input()), { start: 3, end: 8 })

    await editor.click("Đậm")
    assert.equal(editor.saved(), "Tiếng Việt an toàn", "The same selection toggles bold off")
    assert.equal(editor.input().querySelector("strong"), null)
    await editor.click("Đậm")
    assert.equal(editor.saved(), "<b>Tiếng</b> Việt an toàn")

    await editor.select(3, 8)
    await editor.click("Nghiêng")
    const italic = "<b><i>Tiếng</i></b> Việt an toàn"
    assert.equal(editor.saved(), italic)
    assert.equal(editor.input().querySelector("strong em")?.textContent, "Tiếng")
    const from = italic.indexOf("Việt")
    await editor.select(from, from + 4)
    await editor.click("Áp dụng màu")
    const colored = "<b><i>Tiếng</i></b> <color=#2563eb>Việt</color> an toàn"
    assert.equal(editor.saved(), colored)
    const color = [...editor.input().querySelectorAll<HTMLElement>("[data-format-open]")].find(
      (element) => element.getAttribute("data-format-open") === "<color=#2563eb>",
    )
    assert.ok(color)
    assert.equal(color.textContent, "Việt")
    assert.equal(color.style.color, "rgb(37, 99, 235)")
    assert.equal(editor.input().textContent, "Tiếng Việt an toàn")
    assert.equal(referenceInputValue(editor.input()), colored)
    assert.equal(editor.input().querySelector("textarea, input[type=hidden]"), null)

    await editor.click("Hoàn tác")
    assert.equal(editor.saved(), italic)
    assert.equal(editor.input().querySelector("strong em")?.textContent, "Tiếng")
    assert.equal(editor.input().querySelector('[data-format-open="<color=#2563eb>"]'), null)
    await editor.click("Làm lại")
    assert.equal(referenceInputValue(editor.input()), colored)
    await editor.select(0, colored.length)
    const copied = await editor.clipboard("copy")
    assert.equal(copied.get("text/plain"), "Tiếng Việt an toàn")
    assert.equal(copied.get("application/x-aov-rich-text"), colored)
  } finally {
    await editor.close()
  }
})

test("reopening nested formatting retains chips and source-mapped editing across metadata and IME", async () => {
  const source = `Trước <b>đậm <i>nghiêng</i> ${token}</b>, <color=#16a34a>xanh</color><noauto> nhắc Airi</noauto>.`
  const editor = await editorHarness(source)
  try {
    const chip = editor.input().querySelector<HTMLElement>("[data-reference-token]")!
    assert.ok(chip)
    assert.ok(chip.closest("strong"))
    assert.equal(editor.input().querySelector("strong em")?.textContent, "nghiêng")
    assert.equal(editor.input().textContent?.includes("<b>"), false)
    assert.equal(editor.input().textContent?.includes("<color="), false)
    assert.equal(editor.input().textContent?.includes("<noauto>"), false)
    assert.equal(referenceInputValue(editor.input()), source)
    const cursor = source.indexOf("nghiêng") + 3
    await editor.select(cursor)
    const before = editor.changes.length
    await editor.renderCatalog([skill])
    assert.equal(editor.changes.length, before, "Metadata hydration does not rewrite the description")
    assert.equal(editor.input().querySelector("[data-reference-token]"), chip)
    assert.deepEqual(referenceInputSelection(editor.input()), { start: cursor, end: cursor })
    assert.ok(chip.querySelector('img[src="/hero.webp"]'))
    assert.ok(chip.querySelector('img[src="/skill.webp"]'))
    const image = chip.querySelector('img[src="/skill.webp"]')!
    const text = editor.input().querySelector("em")!.firstChild!
    await act(async () => {
      text.nodeValue += " mới"
      const at = source.indexOf("nghiêng") + "nghiêng mới".length
      selectReferenceInput(editor.input(), at)
      editor.input().dispatchEvent(new editor.dom.window.Event("input", { bubbles: true }))
    })
    const changed = source.replace("nghiêng", "nghiêng mới")
    assert.equal(editor.saved(), changed)
    assert.equal(editor.input().querySelector("strong em")?.textContent, "nghiêng mới")
    assert.equal(editor.input().querySelector("[data-reference-token]"), chip)
    assert.equal(chip.querySelector('img[src="/skill.webp"]'), image)

    await act(async () =>
      editor.input().dispatchEvent(new editor.dom.window.CompositionEvent("compositionstart", { bubbles: true })),
    )
    const composingText = editor.input().querySelector("em")!.firstChild!
    await act(async () => {
      composingText.nodeValue += " nữa"
      const at = source.indexOf("nghiêng") + "nghiêng mới nữa".length
      selectReferenceInput(editor.input(), at)
      editor.input().dispatchEvent(new editor.dom.window.Event("input", { bubbles: true }))
    })
    assert.equal(editor.input().querySelector("em")!.firstChild, composingText)
    await act(async () =>
      editor.input().dispatchEvent(new editor.dom.window.CompositionEvent("compositionend", { bubbles: true })),
    )
    assert.equal(editor.saved(), source.replace("nghiêng", "nghiêng mới nữa"))
    assert.equal(editor.input().querySelector("strong em")?.textContent, "nghiêng mới nữa")
    assert.equal(editor.input().querySelector("[data-reference-token]"), chip)
    await editor.key("z", { ctrlKey: true })
    assert.equal(editor.saved(), changed)
    assert.equal(editor.input().querySelector("strong em")?.textContent, "nghiêng mới")
    const from = changed.indexOf("nghiêng mới")
    await editor.select(from, from + "nghiêng mới".length)
    await editor.clipboard("paste", { "text/plain": "đã thay" })
    assert.equal(editor.saved(), source.replace("nghiêng", "đã thay"))
    assert.equal(editor.input().querySelector("strong em")?.textContent, "đã thay")
  } finally {
    await editor.close()
  }
})

test("collapsed styles retain a native caret anchor and style subsequent beforeinput typing", async () => {
  const editor = await editorHarness("")
  try {
    await editor.select(0)
    await editor.key("b", { ctrlKey: true })
    assert.equal(editor.saved(), "<b></b>")
    const strong = editor.input().querySelector("strong")!
    assert.ok(strong)
    assert.equal(strong.contains(editor.document.getSelection()!.anchorNode), true)
    assert.ok(
      strong.querySelector("br[data-input-tail]"),
      "An empty Text node alone is not a stable typing location in native Chrome",
    )
    assert.equal(referenceInputValue(editor.input()), "<b></b>", "The caret anchor adds no source content")
    const typeAtCaret = async (text: string) =>
      act(async () => {
        const before = new editor.dom.window.InputEvent("beforeinput", {
          inputType: "insertText",
          data: text,
          bubbles: true,
          cancelable: true,
        })
        editor.input().dispatchEvent(before)
        if (before.defaultPrevented) return

        // JSDOM has no native editing action, so insert at the current DOM caret without source remapping.
        const range = editor.document.getSelection()!.getRangeAt(0)
        const node = editor.document.createTextNode(text)
        range.deleteContents()
        range.insertNode(node)
        range.setStartAfter(node)
        range.collapse(true)
        editor.document.getSelection()!.removeAllRanges()
        editor.document.getSelection()!.addRange(range)
        editor
          .input()
          .dispatchEvent(
            new editor.dom.window.InputEvent("input", { inputType: "insertText", data: text, bubbles: true }),
          )
      })
    await typeAtCaret("Đang gõ")
    assert.equal(editor.saved(), "<b>Đang gõ</b>")
    assert.equal(editor.input().querySelector("strong")?.textContent, "Đang gõ")
    await editor.key("b", { ctrlKey: true })
    assert.equal(editor.saved(), "<b>Đang gõ</b>")
    assert.equal(editor.input().querySelector("strong")!.contains(editor.document.getSelection()!.anchorNode), false)
    await typeAtCaret(" thường")
    assert.equal(editor.saved(), "<b>Đang gõ</b> thường")

    await editor.key("i", { ctrlKey: true })
    assert.ok(editor.input().querySelector("em br[data-input-tail]"))
    await typeAtCaret(" nghiêng")
    assert.equal(editor.saved(), "<b>Đang gõ</b> thường<i> nghiêng</i>")
    assert.equal(editor.input().querySelector("em")?.textContent, " nghiêng")
    await editor.key("i", { ctrlKey: true })
    await editor.click("Áp dụng màu")
    const colored = editor.input().querySelector<HTMLElement>('[data-format-open="<color=#2563eb>"]')!
    assert.ok(colored.querySelector("br[data-input-tail]"))
    await typeAtCaret(" xanh")
    assert.equal(editor.saved(), "<b>Đang gõ</b> thường<i> nghiêng</i><color=#2563eb> xanh</color>")
    assert.equal(colored.textContent, " xanh")
    assert.equal(editor.input().textContent, "Đang gõ thường nghiêng xanh")
  } finally {
    await editor.close()
  }
})

test("only valid formatting becomes DOM markup and pasted HTML stays inert plain text", async () => {
  const source =
    '<script>alert(1)</script> <b onclick="bad()">x</b> <color=red>y</color> <color=#16a34a>Đúng</color> <i>chưa đóng'
  const editor = await editorHarness(source)
  try {
    assert.equal(editor.input().querySelector("script, img, strong, em"), null)
    assert.equal(editor.input().textContent?.includes("<script>alert(1)</script>"), true)
    assert.equal(editor.input().textContent?.includes('<b onclick="bad()">x</b>'), true)
    assert.equal(editor.input().textContent?.includes("<color=red>y</color>"), true)
    assert.equal(editor.input().textContent?.includes("<i>chưa đóng"), true)
    const color = editor.input().querySelector<HTMLElement>('[data-format-open="<color=#16a34a>"]')!
    assert.ok(color)
    assert.equal(color.style.color, "rgb(22, 163, 74)")
    assert.equal(color.textContent, "Đúng")
    assert.equal(referenceInputValue(editor.input()), source)
    await editor.select(source.length)
    const literal = '<img src="x" onerror="alert(2)">'
    await editor.clipboard("paste", { "text/html": literal, "text/plain": literal })
    assert.equal(editor.saved(), source + literal)
    assert.equal(editor.input().querySelector("img, script"), null)
    assert.equal(editor.input().textContent?.endsWith(literal), true)
  } finally {
    await editor.close()
  }
})
