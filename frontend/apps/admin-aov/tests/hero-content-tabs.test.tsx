import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"

async function createView() {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: "http://localhost/hero/test" })
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
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const tabs = await import("../src/features/publishing/hero-content-tabs")
  const root = createRoot(dom.window.document.getElementById("root")!)
  return {
    dom,
    document: dom.window.document,
    root,
    tabs,
    close: async () => {
      await act(async () => root.unmount())
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete (globalThis as Record<string, unknown>)[key]
      }
      dom.window.close()
    },
  }
}

test("each content tab keeps its own place, and the workspace row slides away while reading down", async () => {
  const { dom, document, root, tabs, close } = await createView()
  const { HeroStickyBars } = tabs
  // The bars sit 120px down the page before they stick; a fake scroller stands in for the page's layout.
  const NATURAL_TOP = 120
  let position = 0
  let scroller: HTMLDivElement | null = null
  const positions = new Map<string, number>()
  const render = (memoryKey: string, startKey: string | null = null) =>
    act(async () =>
      root.render(
        <div
          style={{ overflowY: "auto" }}
          ref={(node) => {
            if (!node || node === scroller) return
            scroller = node
            Object.defineProperty(node, "scrollTop", {
              configurable: true,
              get: () => position,
              set: (value: number) => (position = Math.max(0, value)),
            })
            node.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, 400, 600)
          }}
        >
          <div>
            <HeroStickyBars memoryKey={memoryKey} startKey={startKey} positions={positions} top={<nav>workspace</nav>}>
              {(stuck) => <div data-row-stuck={stuck}>content tabs</div>}
            </HeroStickyBars>
          </div>
        </div>,
      ),
    )
  const bars = () => document.querySelector<HTMLElement>('[data-slot="hero-sticky-bars"]')!
  const markBars = () => {
    const marker = bars().previousElementSibling as HTMLElement
    marker.getBoundingClientRect = () => new dom.window.DOMRect(0, NATURAL_TOP - position, 400, 0)
  }
  const scrollTo = (value: number) =>
    act(async () => {
      position = value
      scroller!.dispatchEvent(new dom.window.Event("scroll"))
    })
  try {
    await render("hero:overview")
    markBars()
    assert.equal(bars().dataset.stuck, "false")
    assert.equal(document.querySelector<HTMLElement>("[data-row-stuck]")!.dataset.rowStuck, "false")

    await scrollTo(150)
    assert.equal(bars().dataset.stuck, "true")
    assert.equal(bars().dataset.tucked, "true", "Reading down tucks the workspace row away")
    assert.equal(document.querySelector<HTMLElement>("[data-row-stuck]")!.dataset.rowStuck, "true")
    await scrollTo(140)
    assert.equal(bars().dataset.tucked, "false", "Scrolling back up shows it again")

    await scrollTo(900)
    await render("hero:skills")
    assert.equal(position, NATURAL_TOP, "A tab seen for the first time opens at its start")
    await scrollTo(400)
    await render("hero:overview")
    assert.equal(position, 900, "Coming back to a tab returns to where it was left")
    await scrollTo(950)
    await render("hero:overview")
    assert.equal(position, 950, "Picking the open tab again keeps the place")
    await render("hero:skills")
    assert.equal(position, 400)

    await render("hero:skills", "SKILLS:information")
    assert.equal(position, NATURAL_TOP, "An editor opening brings the start of the tab under the bars")
    await render("hero:skills", null)
    await scrollTo(30)
    await render("hero:skins")
    assert.equal(position, 30, "While the page header is in view, a new tab does not jump past it")

    // Another workspace tab replaces the bars; coming back to the content returns to the place it was left at.
    await act(async () => root.render(<div />))
    scroller = null
    position = 0
    await render("hero:overview")
    assert.equal(position, 950)
  } finally {
    await close()
  }
})

test("the content tabs follow the hero picture and switcher once the bars stick", async () => {
  const { document, root, tabs, close } = await createView()
  const { HeroContentTabs } = tabs
  const picked: string[] = []
  const render = (stuck: boolean, editingTab: "skills" | null = null) =>
    act(async () =>
      root.render(
        <div className="@container">
          <HeroContentTabs
            tab="overview"
            onTab={(tab) => picked.push(tab)}
            videos
            busy={false}
            stuck={stuck}
            editingTab={editingTab}
            name="Lữ Bố"
            switcher={<button type="button">Đổi tướng</button>}
          />
        </div>,
      ),
    )
  try {
    await render(false)
    const identity = () => document.querySelector<HTMLElement>('[data-slot="hero-content-identity"]')!
    assert.equal(identity().getAttribute("aria-hidden"), "true")
    assert.equal(identity().textContent, "", "The header above already names the hero")
    const tabList = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    assert.deepEqual(
      tabList.map((tab) => tab.getAttribute("aria-controls")),
      ["overview", "skills", "skins", "media", "videos"].map((tab) => `hero-content-${tab}`),
    )
    assert.equal(tabList[0]!.getAttribute("aria-selected"), "true")

    await render(true, "skills")
    assert.equal(identity().getAttribute("aria-hidden"), "false")
    assert.match(identity().textContent ?? "", /Lữ Bố/)
    assert.ok(identity().querySelector("button"), "The switcher sits before the tabs")
    const order = [...document.querySelectorAll('[data-slot="hero-content-identity"], [role="tablist"]')]
    assert.equal(order[0], identity(), "The hero comes first, the tabs to its right")
    assert.match(document.querySelector('[aria-controls="hero-content-skills"]')!.textContent!, /đang sửa/)

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-controls="hero-content-skins"]')!.click())
    assert.deepEqual(picked, ["skins"])
  } finally {
    await close()
  }
})
