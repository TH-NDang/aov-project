import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { JSDOM } from "jsdom"
import { createMemoryRouter, RouterProvider } from "react-router"
import { useHeroLocation } from "../src/features/publishing/use-hero-location"
import { installWindow } from "./fixtures/dom"

test("warning navigation keeps both tab and skill updates made in the same event", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero" })
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window)
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
    restoreGlobals()
  }
})
