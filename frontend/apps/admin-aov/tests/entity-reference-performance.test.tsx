import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { EntityReferenceInputHandle } from "@aov/ui/components/entity-reference-input"
import { readReferenceInputSnapshot, setReferenceInputSelection } from "@aov/ui/lib/reference-input-dom"
import { createWindow, installWindow } from "./fixtures/dom"

test("ordinary typing preserves the native range, text nodes, chip content and editor listeners", async () => {
  const dom = createWindow()
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window)
  const { createRoot } = await import("react-dom/client")
  const { EntityReferenceInput } = await import("@aov/ui/components/entity-reference-input")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const handle = React.createRef<EntityReferenceInputHandle>()
  const heroId = "00000000-0000-4000-8000-000000000001"
  const token = `<ref=hero:${heroId}>Airi</ref>`
  const initial = `<b>Đậm ${token}</b>`
  const entities: EntityReference[] = [
    {
      id: heroId,
      kind: "hero",
      icon: "/hero.webp",
      translations: [{ locale: "vi-VN", name: "Airi", aliases: [], description: "" }],
    },
  ]
  let saved = initial
  let notifications = 0
  function Harness() {
    const [value, setValue] = React.useState(initial)
    return (
      <EntityReferenceInput
        ref={handle}
        value={value}
        entities={entities}
        locale="vi-VN"
        onSelectionChange={() => notifications++}
        onChange={(snapshot) => {
          saved = snapshot.value
          setValue(saved)
          return true
        }}
      />
    )
  }
  try {
    await act(async () => root.render(<Harness />))
    const input = handle.current!.element!
    await act(async () => {
      input.focus()
      setReferenceInputSelection(input, initial.length, initial.length)
      dom.window.document.dispatchEvent(new dom.window.Event("selectionchange"))
    })
    const strong = input.querySelector("strong")!
    const chip = input.querySelector("[data-reference-token]")!
    const image = chip.querySelector("img")!
    const selection = dom.window.document.getSelection()!
    const removeRanges = selection.removeAllRanges.bind(selection)
    let resets = 0
    selection.removeAllRanges = () => {
      resets++
      removeRanges()
    }
    const addListener = input.addEventListener.bind(input)
    const removeListener = input.removeEventListener.bind(input)
    let listenerChanges = 0
    input.addEventListener = (...args: Parameters<typeof input.addEventListener>) => {
      if (args[0] === "beforeinput") listenerChanges++
      addListener(...args)
    }
    input.removeEventListener = (...args: Parameters<typeof input.removeEventListener>) => {
      if (args[0] === "beforeinput") listenerChanges++
      removeListener(...args)
    }
    const startNotifications = notifications
    const text = " chữ thường sau định dạng"
    for (const character of text) {
      await act(async () => {
        const event = new dom.window.InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: character,
        })
        input.dispatchEvent(event)
        assert.equal(event.defaultPrevented, true)
        input.dispatchEvent(new dom.window.KeyboardEvent("keyup", { bubbles: true, key: character }))
        dom.window.document.dispatchEvent(new dom.window.Event("selectionchange"))
      })
    }
    assert.equal(saved, initial + text)
    assert.deepEqual(readReferenceInputSnapshot(input), { value: saved, start: saved.length, end: saved.length })
    assert.equal(resets, 0, "Typing beside formatting does not replace the live native selection")
    assert.equal(listenerChanges, 0, "Typing does not detach and reattach the native beforeinput listener")
    assert.equal(
      notifications - startNotifications,
      text.length,
      "Repeated selection events report each caret only once",
    )
    assert.equal(input.querySelector("strong"), strong)
    assert.equal(input.querySelector("[data-reference-token]"), chip)
    assert.equal(chip.querySelector("img"), image)
    const plainNodes = [...input.childNodes].filter((node) => node.nodeType === 3 && node.nodeValue)
    assert.equal(plainNodes.length, 1, "Typing after turning formatting off uses one text node, not one per character")
    assert.equal(plainNodes[0]!.nodeValue, text)
    assert.ok(selection.anchorNode?.nodeType === 3)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    restoreGlobals()
  }
})
