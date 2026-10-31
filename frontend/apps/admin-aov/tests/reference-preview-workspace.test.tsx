import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import {
  fillReferenceInput,
  referenceInput,
  referenceInputSelection,
  referenceInputValue,
  selectReferenceInput,
} from "./fixtures/reference-input"

test("mobile preview preserves editing through resizing, keyboard changes and desktop layout", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/terminology", pretendToBeVisual: true })
  const document = dom.window.document
  let width = 360
  let resized = () => {}
  let disconnected = false
  const visual = Object.assign(new dom.window.EventTarget(), {
    height: 800,
    width: 390,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
  })
  Object.defineProperty(dom.window, "visualViewport", { configurable: true, value: visual })
  Object.defineProperty(dom.window, "innerHeight", { configurable: true, value: 800 })
  const bounds = dom.window.HTMLElement.prototype.getBoundingClientRect
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    return this.getAttribute("aria-label") === "Soạn và xem trước nội dung"
      ? new dom.window.DOMRect(16, 160, width, 600)
      : bounds.call(this)
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    Element: dom.window.Element,
    MutationObserver: dom.window.MutationObserver,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    ResizeObserver: class {
      constructor(callback: () => void) {
        resized = callback
      }
      observe() {}
      disconnect() {
        disconnected = true
      }
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { ReferencePreviewWorkspace } = await import("../src/features/terminology/reference-preview-workspace")
  const root = createRoot(document.getElementById("root")!)
  function Harness() {
    const [value, setValue] = React.useState("Nội dung ban đầu")
    return (
      <ReferencePreviewWorkspace
        value={value}
        onChange={setValue}
        locale="vi-VN"
        onLocaleChange={() => {}}
        context="admin"
        onContextChange={() => {}}
      />
    )
  }
  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 35))
    })
  const separator = () => document.querySelector<HTMLElement>('[role="separator"]')!
  const key = async (value: string) =>
    act(async () => separator().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: value, bubbles: true })))
  try {
    await act(async () => root.render(<Harness />))
    const input = referenceInput(document.body)
    await act(async () => fillReferenceInput(input, "Nội dung đang viết"))
    await act(async () => selectReferenceInput(input, 4, 8))
    const selection = referenceInputSelection(input)
    assert.equal(separator().getAttribute("aria-valuenow"), "60")
    await key("ArrowDown")
    assert.equal(separator().getAttribute("aria-valuenow"), "65")
    await key("Home")
    assert.equal(separator().getAttribute("aria-valuenow"), "40")
    await key("End")
    await key("ArrowDown")
    assert.equal(separator().getAttribute("aria-valuenow"), "75")

    const divider = separator()
    Object.defineProperty(divider.parentElement, "clientHeight", { configurable: true, value: 528 })
    Object.defineProperty(divider, "clientHeight", { configurable: true, value: 28 })
    let captured = false
    divider.setPointerCapture = () => {
      captured = true
    }
    divider.releasePointerCapture = () => {
      captured = false
    }
    const pointer = async (type: string, y: number) =>
      act(async () => {
        const event = new dom.window.MouseEvent(type, { bubbles: true, button: 0, clientY: y })
        Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
        divider.dispatchEvent(event)
      })
    await pointer("pointerdown", 300)
    await pointer("pointermove", 225)
    assert.equal(captured, true)
    assert.equal(separator().getAttribute("aria-valuenow"), "60")
    await pointer("pointerup", 225)
    await pointer("pointermove", 800)
    assert.equal(captured, false)
    assert.equal(separator().getAttribute("aria-valuenow"), "60")

    visual.height = 410
    visual.offsetTop = 24
    visual.dispatchEvent(new dom.window.Event("resize"))
    await flush()
    const fixed = document.querySelector<HTMLElement>('[data-keyboard="true"]')!
    assert.ok(fixed)
    assert.equal(fixed.style.height, "410px")
    assert.equal(fixed.style.top, "24px")
    assert.equal(referenceInput(document.body), input)
    assert.deepEqual(referenceInputSelection(input), selection)
    assert.equal(referenceInputValue(input), "Nội dung đang viết")
    assert.equal(separator().getAttribute("aria-valuenow"), "65")

    const output = document.querySelector<HTMLElement>('[aria-label="Nội dung xem trước"]')!
    Object.defineProperties(input, { clientHeight: { value: 100 }, scrollHeight: { value: 500 } })
    Object.defineProperties(output, { clientHeight: { value: 80 }, scrollHeight: { value: 280 } })
    await act(async () => {
      input.scrollTop = 200
      input.dispatchEvent(new dom.window.Event("scroll"))
    })
    assert.equal(output.scrollTop, 100)

    visual.scale = 1.5
    visual.dispatchEvent(new dom.window.Event("resize"))
    await flush()
    assert.equal(document.querySelector('[data-keyboard="true"]'), null, "Pinch zoom must not activate keyboard mode")
    visual.scale = 1
    visual.height = 800
    visual.offsetTop = 0
    visual.dispatchEvent(new dom.window.Event("resize"))
    await flush()
    assert.equal(separator().getAttribute("aria-valuenow"), "60", "Closing the keyboard restores the user's split")

    width = 900
    resized()
    await flush()
    assert.equal(document.querySelector('[role="separator"]'), null)
    assert.equal(referenceInput(document.body), input)
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Hoàn tác"]')!.click())
    assert.equal(referenceInputValue(input), "Nội dung ban đầu", "Viewport changes preserve undo history")
  } finally {
    await act(async () => root.unmount())
    assert.equal(disconnected, true)
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
