import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { createPageTabPreviewStore } from "../src/app/layout/page-tab-preview-store"
import { createPreviewFilter, observePageTabPreview } from "../src/app/layout/page-tab-preview"

function setupDom() {
  const dom = new JSDOM('<div id="panel"><div id="scroll"><div id="row"></div></div></div>', {
    pretendToBeVisual: true,
  })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  return {
    dom,
    panel: dom.window.document.getElementById("panel")!,
    cleanup() {
      dom.window.close()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}

test("previews remain isolated per tab and are released when their tab closes", () => {
  const store = createPageTabPreviewStore()
  let notifications = 0
  const unsubscribe = store.subscribe(() => notifications++)
  store.set("/hero", "hero-image")
  store.set("/arcana", "arcana-image")
  store.retain(["/arcana"])
  assert.equal(store.get("/hero"), undefined)
  assert.equal(store.get("/arcana"), "arcana-image")
  unsubscribe()
  store.set("/arcana", "new-image")
  assert.equal(notifications, 2)
})

test("capture excludes rows below the page overview even after nested scrolling", () => {
  const { dom, panel, cleanup } = setupDom()
  try {
    panel.getBoundingClientRect = () => new dom.window.DOMRect(0, 40, 700, 600)
    const scroll = dom.window.document.getElementById("scroll")!
    scroll.scrollTop = 800
    const row = dom.window.document.getElementById("row")!
    row.getBoundingClientRect = () => new dom.window.DOMRect(0, 100, 600, 50)
    const controller = new AbortController()
    const filter = createPreviewFilter(panel, controller.signal)
    assert.equal(filter(row), false)
    row.getBoundingClientRect = () => new dom.window.DOMRect(0, -700, 600, 50)
    assert.equal(filter(row), true)
    row.dataset.previewExclude = ""
    assert.equal(filter(row), false)
    delete row.dataset.previewExclude
    controller.abort()
    assert.equal(filter(row), false)
  } finally {
    cleanup()
  }
})

test("closing or switching a tab cancels pending capture and rejects late images", async (t) => {
  const { panel, cleanup } = setupDom()
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 10000 })
  const published: string[] = []
  let finish: (image: string) => void = () => {}
  let signal: AbortSignal | undefined
  const stop = observePageTabPreview(
    panel,
    (image) => published.push(image),
    async (_, captureSignal) => {
      signal = captureSignal
      return new Promise<string>((resolve) => {
        finish = resolve
      })
    },
  )
  try {
    t.mock.timers.tick(1200)
    assert.ok(signal)
    stop()
    assert.equal(signal.aborted, true)
    finish("late-image")
    await Promise.resolve()
    await Promise.resolve()
    assert.deepEqual(published, [])
  } finally {
    stop()
    t.mock.timers.reset()
    cleanup()
  }
})

test("capture coalesces updates, throttles refreshes and recovers from a render failure", async (t) => {
  const { dom, panel, cleanup } = setupDom()
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 10000 })
  let renders = 0
  const published: string[] = []
  const stop = observePageTabPreview(
    panel,
    (image) => published.push(image),
    async () => {
      renders++
      if (renders === 1) throw new Error("Image unavailable")
      return "updated-image"
    },
  )
  try {
    t.mock.timers.tick(1200)
    await Promise.resolve()
    assert.equal(renders, 1)
    panel.dispatchEvent(new dom.window.Event("load"))
    panel.dispatchEvent(new dom.window.Event("load"))
    t.mock.timers.tick(7999)
    assert.equal(renders, 1)
    t.mock.timers.tick(1)
    await Promise.resolve()
    assert.equal(renders, 2)
    assert.deepEqual(published, ["updated-image"])
    panel.dispatchEvent(new dom.window.Event("load"))
    stop()
    t.mock.timers.tick(10000)
    assert.equal(renders, 2)
  } finally {
    stop()
    t.mock.timers.reset()
    cleanup()
  }
})
