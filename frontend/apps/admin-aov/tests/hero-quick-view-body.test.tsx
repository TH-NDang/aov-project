import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"

async function withView(
  reducedMotion: boolean,
  run: (ui: {
    document: Document
    render: (text?: string) => Promise<void>
    unmount: () => Promise<void>
    animate: (type: string, nested?: boolean) => Promise<void>
    expire: () => Promise<void>
    pending: () => number
  }) => Promise<void>,
) {
  const dom = new JSDOM('<section data-slot="sheet-content"><div id="root"></div></section>')
  const timers = new Map<number, () => void>()
  let sequence = 0
  dom.window.matchMedia = (() => ({ matches: reducedMotion })) as typeof dom.window.matchMedia
  dom.window.setTimeout = ((callback: () => void) => {
    timers.set(++sequence, callback)
    return sequence
  }) as typeof dom.window.setTimeout
  dom.window.clearTimeout = (id) => {
    timers.delete(id ?? 0)
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { HeroQuickViewBody } = await import("../src/features/publishing/hero-quick-view-body")
  const document = dom.window.document
  const root = createRoot(document.getElementById("root")!)
  let mounted = true
  const unmount = async () => {
    if (mounted) await act(async () => root.unmount())
    mounted = false
  }
  try {
    await run({
      document,
      render: async (text = "Hero workspace") => {
        await act(async () =>
          root.render(
            <HeroQuickViewBody>
              <p id="workspace">{text}</p>
            </HeroQuickViewBody>,
          ),
        )
      },
      unmount,
      animate: async (type, nested = false) => {
        await act(async () => {
          const target = nested ? document.querySelector('[role="status"]')! : document.querySelector("section")!
          target.dispatchEvent(new dom.window.Event(type, { bubbles: true }))
        })
      },
      expire: async () => {
        await act(async () => {
          const pending = [...timers.values()]
          timers.clear()
          for (const callback of pending) callback()
        })
      },
      pending: () => timers.size,
    })
  } finally {
    await unmount()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test("the sheet shows its shell first and mounts the workspace after its own opening animation", async () => {
  await withView(false, async ({ document, render, animate, pending }) => {
    await render()
    assert.ok(document.querySelector('[role="status"]'))
    assert.equal(document.querySelector("#workspace"), null)
    await animate("animationend", true)
    assert.equal(document.querySelector("#workspace"), null, "Nested animations cannot reveal the workspace")
    await animate("animationstart")
    assert.equal(pending(), 1)
    await animate("animationend")
    assert.equal(document.querySelector("#workspace")?.textContent, "Hero workspace")
    assert.equal(document.querySelector('[role="status"]'), null)
    assert.equal(pending(), 0)
    await render("Next hero")
    assert.equal(document.querySelector("#workspace")?.textContent, "Next hero", "Switching heroes does not wait again")
  })
})

test("reduced motion displays the workspace immediately without a timer", async () => {
  await withView(true, async ({ document, render, pending }) => {
    await render()
    assert.ok(document.querySelector("#workspace"))
    assert.equal(pending(), 0)
  })
})

test("missing or cancelled animations still reveal content, while closing early clears pending work", async () => {
  await withView(false, async ({ document, render, expire, pending }) => {
    await render()
    await expire()
    assert.ok(document.querySelector("#workspace"))
    assert.equal(pending(), 0)
  })
  await withView(false, async ({ document, render, animate, pending }) => {
    await render()
    await animate("animationcancel")
    assert.ok(document.querySelector("#workspace"))
    assert.equal(pending(), 0)
  })
  await withView(false, async ({ render, unmount, expire, pending, document }) => {
    await render()
    await unmount()
    assert.equal(pending(), 0)
    await expire()
    assert.equal(document.querySelector("#workspace"), null)
  })
})
