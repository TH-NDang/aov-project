import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import {
  getReferenceInputSelection,
  referenceInputCaretRect,
  referenceInputParts,
  serializeReferenceInput,
  setReferenceInputSelection,
} from "@aov/ui/lib/reference-input-dom"
import type { EntityReferenceInputHandle } from "@aov/ui/components/entity-reference-input"

const heroId = "00000000-0000-4000-8000-000000000001"
const token = `<ref=skill:${heroId}.skill-1-2>Phi tiêu</ref>`
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

test("reference DOM maps atomic token boundaries without including icon or owner text", () => {
  const dom = new JSDOM('<div id="root"></div>')
  const root = dom.window.document.getElementById("root")!
  const chip = dom.window.document.createElement("span")
  chip.setAttribute("data-reference-token", token)
  chip.setAttribute("contenteditable", "false")
  chip.textContent = "Airi › Phi tiêu ↔ 2"
  root.append("Trước ", chip, " sau")
  assert.equal(serializeReferenceInput(root), `Trước ${token} sau`)
  setReferenceInputSelection(root, 6 + token.length, 6 + token.length + 4)
  assert.deepEqual(getReferenceInputSelection(root), { start: 6 + token.length, end: 10 + token.length })
  setReferenceInputSelection(root, 7, token.length + 2)
  assert.deepEqual(getReferenceInputSelection(root), { start: 6, end: token.length + 6 })
  assert.ok(referenceInputCaretRect(root, token.length + 6))
  assert.deepEqual(referenceInputParts(`<ref=skill:${heroId}.BAD>x</ref>`), [
    { type: "text", text: `<ref=skill:${heroId}.BAD>x</ref>` },
  ])
  const bounded = referenceInputParts(token.repeat(700))
  assert.equal(bounded.filter((part) => part.type === "reference").length, 500)
  assert.equal(bounded.map((part) => (part.type === "text" ? part.text : part.token)).join(""), token.repeat(700))
  root.replaceChildren(dom.window.document.createElement("br"))
  assert.equal(serializeReferenceInput(root), "", "The browser's empty editable placeholder is not stored as a newline")
  dom.window.close()
})

test("IME changes remain undecorated until commit, overflow rolls back, and disabled fieldsets reject mutations", async () => {
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
    MutationObserver: dom.window.MutationObserver,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { EntityReferenceInput } = await import("@aov/ui/components/entity-reference-input")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const handle = React.createRef<EntityReferenceInputHandle>()
  const highlights = new Map<string, unknown>()
  Object.defineProperty(dom.window, "CSS", { value: { highlights }, configurable: true })
  Object.defineProperty(dom.window, "Highlight", {
    value: class {
      constructor(..._ranges: Range[]) {}
    },
  })
  const recognitionEntities: EntityReference[] = [
    {
      id: "hero-ime",
      kind: "hero",
      translations: [{ locale: "vi-VN", name: "abcđ", aliases: [], description: "" }],
    },
  ]
  let saved = "abc",
    changes = 0,
    ends = 0
  function Harness({ disabled = false }: { disabled?: boolean }) {
    const [value, setValue] = React.useState(saved)
    return (
      <fieldset disabled={disabled}>
        <EntityReferenceInput
          ref={handle}
          value={value}
          locale="vi-VN"
          entities={recognitionEntities}
          maxLength={5}
          onChange={(snapshot) => {
            changes++
            saved = snapshot.value
            setValue(saved)
            return true
          }}
          onCompositionEnd={(snapshot) => {
            ends++
            saved = snapshot.value
            setValue(saved)
            return true
          }}
        />
      </fieldset>
    )
  }
  const input = () => handle.current!.element!
  const type = async (text: string) =>
    act(async () => {
      input().replaceChildren(dom.window.document.createTextNode(text))
      setReferenceInputSelection(input(), text.length, text.length)
      input().dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  try {
    await act(async () => root.render(<Harness />))
    await act(async () => input().dispatchEvent(new dom.window.CompositionEvent("compositionstart", { bubbles: true })))
    await type("abcđường")
    assert.equal(saved, "abc")
    assert.equal(input().textContent, "abcđường", "IME DOM stays untouched while composition is active")
    await act(async () => input().dispatchEvent(new dom.window.CompositionEvent("compositionend", { bubbles: true })))
    assert.equal(saved, "abc")
    assert.equal(input().textContent, "abc")
    assert.equal(ends, 1)
    await act(async () => input().dispatchEvent(new dom.window.CompositionEvent("compositionstart", { bubbles: true })))
    await type("abcđ")
    assert.equal(saved, "abcđ")
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)))
    assert.equal(highlights.size, 0, "Composition pauses do not decorate unfinished input")
    await act(async () => input().dispatchEvent(new dom.window.CompositionEvent("compositionend", { bubbles: true })))
    assert.equal(saved, "abcđ")
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)))
    assert.equal(highlights.size, 1, "Finishing composition schedules recognition even when the value is unchanged")
    assert.equal(input().textContent, "abcđ")
    const before = changes
    await act(async () => root.render(<Harness disabled />))
    assert.equal(input().getAttribute("contenteditable"), "false")
    await type("x")
    assert.equal(saved, "abcđ")
    assert.equal(input().textContent, "abcđ")
    assert.equal(changes, before)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})

test("reference input keeps chips atomic, stable during typing and hydration, and serializes clipboard/newlines safely", async () => {
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
    MutationObserver: dom.window.MutationObserver,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { EntityReferenceInput } = await import("@aov/ui/components/entity-reference-input")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const handle = React.createRef<EntityReferenceInputHandle>()
  let saved = `${token} Đầu`
  let changes = 0
  let setValue!: React.Dispatch<React.SetStateAction<string>>
  function Harness({ catalog = [] }: { catalog?: EntityReference[] }) {
    const [value, update] = React.useState(saved)
    setValue = update
    return (
      <EntityReferenceInput
        ref={handle}
        value={value}
        entities={catalog}
        locale="vi-VN"
        aria-label="Soạn"
        onChange={(snapshot) => {
          saved = snapshot.value
          changes++
          update(snapshot.value)
          return true
        }}
      />
    )
  }
  const input = () => handle.current!.element!
  const select = (start: number, end = start) => {
    input().focus()
    setReferenceInputSelection(input(), start, end)
  }
  const key = (key: string) =>
    act(async () =>
      input().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })),
    )
  const clipboard = async (type: "copy" | "cut" | "paste", entries: Record<string, string> = {}) => {
    const result = new Map(Object.entries(entries))
    await act(async () => {
      const event = new dom.window.Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, "clipboardData", {
        value: {
          getData: (kind: string) => result.get(kind) ?? "",
          setData: (kind: string, value: string) => result.set(kind, value),
        },
      })
      input().dispatchEvent(event)
    })
    return result
  }
  try {
    await act(async () => root.render(<Harness />))
    const chip = input().querySelector("[data-reference-token]")!
    assert.equal(chip.textContent, "Phi tiêu")
    assert.equal(chip.getAttribute("contenteditable"), "false")
    assert.equal(input().textContent?.includes("<ref="), false)
    assert.equal(serializeReferenceInput(input()), saved)
    await act(async () => {
      select(saved.length)
      input().lastChild!.nodeValue += " mới"
      setReferenceInputSelection(input(), saved.length + 4, saved.length + 4)
      input().dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    assert.equal(saved, `${token} Đầu mới`)
    assert.equal(input().querySelector("[data-reference-token]"), chip, "Typing beside a chip retains its DOM host")
    const beforeMetadata = changes
    const selection = getReferenceInputSelection(input())
    await act(async () => root.render(<Harness catalog={[skill]} />))
    assert.equal(changes, beforeMetadata, "Late metadata never changes stored content")
    assert.equal(input().querySelector("[data-reference-token]"), chip)
    assert.deepEqual(getReferenceInputSelection(input()), selection)
    assert.match(chip.textContent!, /Airi.*Phi tiêu/)
    assert.ok(chip.querySelector('img[src="/hero.webp"]'))
    const image = chip.querySelector('img[src="/skill.webp"]')!
    assert.ok(image)
    await act(async () => {
      input().lastChild!.nodeValue += "!"
      const length = saved.length + 1
      select(length)
      input().dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    assert.equal(chip.querySelector('img[src="/skill.webp"]'), image, "Typing does not remount loaded icon images")
    select(0, token.length)
    const copied = await clipboard("copy")
    assert.equal(copied.get("application/x-aov-rich-text"), token)
    assert.equal(copied.get("text/plain"), "Phi tiêu")
    select(saved.length)
    await key("Enter")
    assert.ok(saved.endsWith("\n"))
    assert.ok(input().lastChild instanceof dom.window.HTMLBRElement)
    assert.ok((input().lastChild as Element).hasAttribute("data-input-tail"))
    assert.equal(serializeReferenceInput(input()), saved, "The terminal caret placeholder contributes no source text")
    assert.deepEqual(getReferenceInputSelection(input()), { start: saved.length, end: saved.length })
    assert.equal(dom.window.document.getSelection()!.anchorNode, input())
    assert.equal(dom.window.document.getSelection()!.anchorOffset, input().childNodes.length - 1)
    await clipboard("paste", { "text/plain": "<img src=x onerror=alert(1)>" })
    assert.ok(saved.endsWith("\n<img src=x onerror=alert(1)>"))
    assert.equal(input().querySelector("img[src=x]"), null)
    select(0, token.length)
    await clipboard("cut")
    assert.equal(saved.includes("<ref="), false)
    await clipboard("paste", { "application/x-aov-rich-text": token, "text/plain": "Phi tiêu" })
    assert.ok(saved.startsWith(token))
    assert.equal(input().querySelectorAll("[data-reference-token]").length, 1)
    select(token.length)
    await key("Backspace")
    assert.equal(saved.includes("<ref="), false)
    await act(async () => setValue(`${token}X`))
    select(0)
    await key("Delete")
    assert.equal(saved, "X")
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
