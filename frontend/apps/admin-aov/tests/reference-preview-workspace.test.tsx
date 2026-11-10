import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { fillReferenceInput, referenceInput, referenceInputValue } from "./fixtures/reference-input"

test("the try-out tab writes in the shared description box without a second pane", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/terminology", pretendToBeVisual: true })
  const document = dom.window.document
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
      observe() {}
      disconnect() {}
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
        entities={[]}
        fallbackLocale="vi-VN"
        autoRecognize
      />
    )
  }
  const button = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === name)!
  const click = (element: HTMLElement) =>
    act(async () => element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })))
  try {
    await act(async () => root.render(<Harness />))
    const input = referenceInput(document.body)
    assert.ok(input, "The tab writes in the shared description box")
    assert.ok(document.querySelector('[role="toolbar"]'), "The box keeps the same toolbar as a skill description")
    assert.equal(document.body.textContent?.includes("Kết quả hiển thị"), false, "One box: no second pane")
    assert.equal(document.querySelector('[role="separator"]'), null)

    await act(async () => fillReferenceInput(input, "Nội dung đang viết"))
    assert.equal(referenceInputValue(referenceInput(document.body)), "Nội dung đang viết")

    await click(button("Ví dụ"))
    assert.match(
      referenceInputValue(referenceInput(document.body)),
      /Nội dung đang viết\n\nGây <b>sát thương phép<\/b>/,
    )

    await click(button("Xóa"))
    assert.equal(referenceInputValue(referenceInput(document.body)), "")
    await click(button("Khôi phục nội dung"))
    assert.match(referenceInputValue(referenceInput(document.body)), /^Nội dung đang viết/)
  } finally {
    await act(async () => root.unmount())
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (globalThis as Record<string, unknown>)[key]
    }
    dom.window.close()
  }
})
