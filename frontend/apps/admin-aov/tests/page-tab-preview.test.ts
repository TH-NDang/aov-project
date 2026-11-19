import test from "node:test"
import assert from "node:assert/strict"
import { createPageTabPreviewStore } from "../src/app/layout/page-tab-preview-store"
import { createPreviewFilter, observePageTabPreview } from "../src/app/layout/page-tab-preview"
import { createWindow, installWindow, withGlobals } from "./fixtures/dom"

function setupDom() {
  const dom = createWindow(undefined, '<div id="panel"><div id="scroll"><div id="row"></div></div></div>')
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window)
  return {
    dom,
    panel: dom.window.document.getElementById("panel")!,
    cleanup() {
      dom.window.close()
      restoreGlobals()
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

test("capture skips cross-origin images, which cannot be read without CORS", async () => {
  const { dom, panel, cleanup } = setupDom()
  const location = { href: "https://admin.example.test/", origin: "https://admin.example.test" }
  await withGlobals({ location }, async () => {
    panel.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, 700, 600)
    const image = dom.window.document.createElement("img")
    panel.append(image)
    image.getBoundingClientRect = () => new dom.window.DOMRect(0, 10, 50, 50)
    const filter = createPreviewFilter(panel, new AbortController().signal)
    image.src = "https://img.example.test/a.jpg"
    assert.equal(filter(image), false)
    image.src = "https://admin.example.test/local.png"
    assert.equal(filter(image), true)
  }).finally(cleanup)
})

test("closing or switching a tab cancels pending capture and rejects late images", async (t) => {
  const { panel, cleanup } = setupDom()
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100000 })
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
    t.mock.timers.tick(4000)
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

test("a capture waits until the reader has stopped clicking", async (t) => {
  const { dom, panel, cleanup } = setupDom()
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100000 })
  let renders = 0
  const stop = observePageTabPreview(
    panel,
    () => {},
    async () => {
      renders++
      return "image"
    },
  )
  try {
    t.mock.timers.tick(3000)
    dom.window.document.dispatchEvent(new dom.window.Event("pointerdown"))
    t.mock.timers.tick(3000)
    assert.equal(renders, 0)
    t.mock.timers.tick(1000)
    await Promise.resolve()
    assert.equal(renders, 1)
  } finally {
    stop()
    t.mock.timers.reset()
    cleanup()
  }
})

test("capture coalesces updates, throttles refreshes and recovers from a render failure", async (t) => {
  const { dom, panel, cleanup } = setupDom()
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100000 })
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
    t.mock.timers.tick(4000)
    await Promise.resolve()
    assert.equal(renders, 1)
    panel.dispatchEvent(new dom.window.Event("load"))
    panel.dispatchEvent(new dom.window.Event("load"))
    t.mock.timers.tick(19999)
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
