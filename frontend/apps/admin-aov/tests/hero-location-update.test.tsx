import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { createMemoryRouter, RouterProvider } from "react-router"
import { useHeroLocation } from "../src/features/publishing/use-hero-location"

test("warning navigation keeps both tab and skill updates made in the same event", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  function Navigation() {
    const { update } = useHeroLocation()
    return (
      <button
        onClick={() => {
          update({ tab: "skills" })
          update({ skill: "skill-1-1" })
        }}
      >
        Go to warning
      </button>
    )
  }
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const router = createMemoryRouter([{ path: "/hero", element: <Navigation /> }], {
    initialEntries: ["/hero?tab=media&role=MAGE"],
  })
  try {
    await act(async () => root.render(<RouterProvider router={router} />))
    await act(async () => dom.window.document.querySelector("button")!.click())
    const params = new URLSearchParams(router.state.location.search)
    assert.equal(params.get("tab"), "skills")
    assert.equal(params.get("skill"), "skill-1-1")
    assert.equal(params.get("role"), "MAGE")
  } finally {
    await act(async () => root.unmount())
    router.dispose()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
