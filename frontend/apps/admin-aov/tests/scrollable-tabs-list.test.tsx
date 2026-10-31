import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"

test("overflowing tabs reveal the selection and adjacent content without scrolling the page", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", pretendToBeVisual: true })
  const document = dom.window.document
  const values = ["terms", "references", "preview", "settings"]
  let width = 300
  let reduced = false
  let resize = () => {}
  let disconnected = false
  const calls: ScrollToOptions[] = []
  Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: reduced }) })
  const prototype = dom.window.HTMLElement.prototype
  Object.defineProperty(prototype, "clientWidth", {
    get() {
      return this.dataset.slot === "tabs-scroll-viewport" ? width : 500
    },
  })
  Object.defineProperty(prototype, "scrollWidth", {
    get() {
      return Math.max(500, width)
    },
  })
  prototype.getBoundingClientRect = function () {
    if (this.getAttribute("role") === "tab") {
      const offset = document.querySelector<HTMLElement>('[data-slot="tabs-scroll-viewport"]')?.scrollLeft ?? 0
      return new dom.window.DOMRect(values.indexOf(this.dataset.testid!) * 120 - offset, 100, 120, 40)
    }
    return new dom.window.DOMRect(0, 100, width, 44)
  }
  prototype.scrollTo = function (options: ScrollToOptions | number) {
    assert.equal(this.dataset.slot, "tabs-scroll-viewport", "Only the strip should scroll")
    assert.equal(typeof options, "object")
    calls.push(options as ScrollToOptions)
    this.scrollLeft = (options as ScrollToOptions).left ?? this.scrollLeft
    this.dispatchEvent(new dom.window.Event("scroll"))
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Element: dom.window.Element,
    CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    ResizeObserver: class {
      constructor(callback: () => void) {
        resize = callback
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
  const { Tabs, TabsTrigger } = await import("@aov/ui/components/tabs")
  const { ScrollableTabsList } = await import("../src/components/scrollable-tabs-list")
  const root = createRoot(document.getElementById("root")!)
  let select = (_value: string) => {}
  function Harness() {
    const [value, setValue] = React.useState("settings")
    select = setValue
    return (
      <Tabs value={value} onValueChange={setValue}>
        <ScrollableTabsList activeValue={value} aria-label="Sections">
          {values.map((item) => (
            <TabsTrigger key={item} value={item} data-testid={item}>
              {item}
            </TabsTrigger>
          ))}
        </ScrollableTabsList>
      </Tabs>
    )
  }
  try {
    await act(async () => root.render(<Harness />))
    const viewport = document.querySelector<HTMLElement>('[data-slot="tabs-scroll-viewport"]')!
    assert.equal(viewport.scrollLeft, 200, "A deep-linked end tab is visible on first render")
    assert.equal(calls.at(-1)?.behavior, "instant")
    await act(async () => select("terms"))
    assert.equal(viewport.scrollLeft, 0)
    await act(async () => select("preview"))
    assert.equal(viewport.scrollLeft, 104, "Leave 44px after an edge tab to hint at the next item")
    assert.equal(calls.at(-1)?.behavior, "smooth")

    await act(async () => {
      viewport.scrollLeft = 0
      viewport.dispatchEvent(new dom.window.Event("scroll"))
      document.querySelector<HTMLButtonElement>('[data-testid="preview"]')!.click()
    })
    assert.equal(viewport.scrollLeft, 104, "Re-clicking the active tab also reveals it after a manual swipe")
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="references"]')!.focus())
    assert.equal(viewport.scrollLeft, 76, "Keyboard focus reveals content toward the left edge")

    await act(async () => select("terms"))
    const settingsTab = document.querySelector<HTMLButtonElement>('[data-testid="settings"]')!
    let captured = false
    viewport.setPointerCapture = () => {
      captured = true
    }
    viewport.hasPointerCapture = () => captured
    viewport.releasePointerCapture = () => {
      captured = false
    }
    const pointer = async (target: HTMLElement, type: string, x: number, pointerType = "mouse") =>
      act(async () => {
        const event = new dom.window.MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: x,
          clientY: 100,
        })
        Object.defineProperties(event, {
          pointerId: { value: 1 },
          isPrimary: { value: true },
          pointerType: { value: pointerType },
        })
        target.dispatchEvent(event)
        return event
      })
    await pointer(settingsTab, "pointerdown", 200)
    await act(async () =>
      settingsTab.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 })),
    )
    assert.equal(settingsTab.getAttribute("aria-selected"), "false", "Pressing to begin a drag must not activate a tab")
    await pointer(viewport, "pointermove", 120)
    assert.equal(viewport.scrollLeft, 80)
    assert.equal(captured, true)
    await pointer(viewport, "pointerup", 120)
    await act(async () => settingsTab.click())
    assert.equal(captured, false)
    assert.equal(settingsTab.getAttribute("aria-selected"), "false", "The click following a drag is suppressed")
    await pointer(settingsTab, "pointerdown", 200)
    await pointer(settingsTab, "pointerup", 200)
    await act(async () => settingsTab.click())
    assert.equal(settingsTab.getAttribute("aria-selected"), "true", "A tap still activates the chosen tab")

    const beforeTouch = calls.length
    await pointer(settingsTab, "pointerdown", 200, "touch")
    const move = await pointer(settingsTab, "pointermove", 120, "touch")
    assert.equal(move.defaultPrevented, false, "Touch panning stays native")
    assert.equal(calls.length, beforeTouch)
    await pointer(settingsTab, "pointercancel", 120, "touch")

    reduced = true
    await act(async () => select("terms"))
    await act(async () => select("settings"))
    assert.equal(calls.at(-1)?.behavior, "instant")
    const count = calls.length
    width = 800
    await act(async () => resize())
    assert.equal(calls.length, count, "A fitting desktop list does not scroll")
    width = 250
    await act(async () => resize())
    assert.equal(viewport.scrollLeft, 250, "Resizing to mobile keeps the selected tab visible")
    assert.equal(calls.at(-1)?.behavior, "instant")
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
