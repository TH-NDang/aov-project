import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { intersectionHarness } from "./fixtures/intersection-observer"

type Contents = typeof import("../src/components/section-contents")

async function withUi(
  run: (ui: {
    document: Document
    contents: Contents
    intersections: ReturnType<typeof intersectionHarness>
    render: (node: React.ReactNode) => Promise<void>
    click: (element: Element | null) => Promise<void>
  }) => Promise<void>,
) {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true })
  const intersections = intersectionHarness()
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    MutationObserver: dom.window.MutationObserver,
    NodeFilter: dom.window.NodeFilter,
    HTMLInputElement: dom.window.HTMLInputElement,
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IntersectionObserver: intersections.Observer,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const contents = await import("../src/components/section-contents")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  try {
    await run({
      document: dom.window.document,
      contents,
      intersections,
      render: async (node) => {
        await act(async () => root.render(node))
      },
      click: async (element) => {
        assert.ok(element, "Expected an element to click")
        await act(async () => (element as HTMLElement).click())
      },
    })
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test("the section being read is the last one whose start passed the reading line", async () => {
  // Imported inside the DOM: the overlay primitives decide at load time whether layout effects can run.
  await withUi(async ({ contents: { activeSection } }) => {
    const positions = [
      { id: "overview", top: -400 },
      { id: "skills", top: 80 },
      { id: "skins", top: 600 },
    ]
    assert.equal(activeSection(positions, 120, false), "skills")
    assert.equal(activeSection(positions, 40, false), "overview")
    assert.equal(activeSection([{ id: "overview", top: 300 }], 120, false), "overview")
    assert.equal(activeSection(positions, 120, true), "skins", "A short last section is current once the page ends")
    assert.equal(activeSection([], 120, false), undefined)
  })
})

test("a contents page opens on the requested section, loads lazy parts on demand and reports picks", async () => {
  await withUi(async ({ document, contents, intersections, render, click }) => {
    const { ContentsSection, SectionContents, useSectionContents } = contents
    const picked: string[] = []
    function Page({ requested }: { requested?: string }) {
      const state = useSectionContents({ requested, first: "part-a" })
      return (
        <SectionContents
          contents={state}
          entries={[
            { id: "part-a", label: "Tổng quan" },
            { id: "part-b", label: "Kỹ năng", count: 4 },
            { id: "part-c", label: "Video" },
          ]}
          onNavigate={(id) => picked.push(id)}
        >
          <ContentsSection id="part-a" title="Tổng quan">
            <p>Phần đầu</p>
          </ContentsSection>
          <ContentsSection id="part-b" title="Kỹ năng" lazy>
            <p>Danh sách kỹ năng</p>
          </ContentsSection>
          <ContentsSection id="part-c" label="Video" lazy>
            <p>Video đã gắn</p>
          </ContentsSection>
        </SectionContents>
      )
    }
    const rail = () => document.querySelector('nav[aria-label="Trên trang này"]')!
    const entry = (id: string) => rail().querySelector<HTMLButtonElement>(`[aria-controls="${id}"]`)

    await render(<Page />)
    assert.match(document.body.textContent!, /Phần đầu/)
    assert.doesNotMatch(document.body.textContent!, /Danh sách kỹ năng|Video đã gắn/, "Lazy parts wait for the reader")
    assert.equal(document.getElementById("part-b")?.getAttribute("aria-busy"), "true")
    assert.equal(entry("part-a")?.getAttribute("aria-current"), "location")
    assert.match(entry("part-b")!.textContent!, /Kỹ năng\s*4/)
    assert.equal(document.getElementById("part-c")?.getAttribute("aria-label"), "Video")

    await click(entry("part-b"))
    assert.deepEqual(picked, ["part-b"])
    assert.match(document.body.textContent!, /Danh sách kỹ năng/)
    assert.equal(entry("part-b")?.getAttribute("aria-current"), "location")
    assert.equal(entry("part-a")?.hasAttribute("aria-current"), false)
    assert.equal(document.activeElement?.id, "part-b", "A jump moves focus to the section it lands on")

    await act(async () => intersections.intersect(document.getElementById("part-c")!))
    assert.match(document.body.textContent!, /Video đã gắn/, "A lazy part loads as it nears the screen")

    await render(<Page key="deep-link" requested="part-b" />)
    assert.match(document.body.textContent!, /Danh sách kỹ năng/)
    assert.doesNotMatch(document.body.textContent!, /Video đã gắn/, "Sections after the one opened still wait")
    assert.equal(document.activeElement?.id, "part-b")

    await render(<Page key="deep-link-last" requested="part-c" />)
    assert.match(
      document.body.textContent!,
      /Danh sách kỹ năng[\s\S]*Video đã gắn/,
      "Opening further down loads the sections above first, so nothing loads in later and pushes it down",
    )
    assert.equal(entry("part-c")?.getAttribute("aria-current"), "location")
    assert.equal(document.activeElement?.id, "part-c")

    const opener = document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
    assert.match(opener!.getAttribute("aria-label")!, /Mở mục lục · Đang xem Video/)
    await click(opener)
    const drawer = document.querySelector('[role="dialog"]')
    assert.ok(drawer, "The floating button opens the contents in a drawer")
    assert.deepEqual(
      [...drawer.querySelectorAll("nav button")].map((button) => button.textContent?.trim()),
      ["Tổng quan", "Kỹ năng4", "Video"],
    )
    picked.length = 0
    await click(drawer.querySelector('nav button[aria-controls="part-b"]'))
    assert.equal(document.querySelector('[role="dialog"]'), null, "Picking a section closes the drawer")
    assert.deepEqual(picked, ["part-b"], "The jump waits for the drawer to close, then reports the pick")
    assert.match(document.body.textContent!, /Danh sách kỹ năng/)
  })
})

test("a page kept open in another tab with the same section ids never takes the jump", async () => {
  await withUi(async ({ document, contents, render, click }) => {
    const { ContentsSection, SectionContents, useSectionContents } = contents
    function Page({ name }: { name: string }) {
      const state = useSectionContents({ first: "part-a" })
      return (
        <div data-page={name}>
          <SectionContents
            contents={state}
            entries={[
              { id: "part-a", label: "Tổng quan" },
              { id: "part-b", label: "Kỹ năng" },
            ]}
          >
            <ContentsSection id="part-a" title="Tổng quan">
              <p>Đầu trang {name}</p>
            </ContentsSection>
            <ContentsSection id="part-b" title="Kỹ năng" lazy>
              <p>Kỹ năng của {name}</p>
            </ContentsSection>
          </SectionContents>
        </div>
      )
    }
    // The first page sits hidden in an earlier workspace tab, so its sections come first in the document.
    await render(
      <>
        <div hidden>
          <Page name="trang ẩn" />
        </div>
        <Page name="trang đang xem" />
      </>,
    )
    const visible = document.querySelector('[data-page="trang đang xem"]')!
    await click(visible.querySelector('nav[aria-label="Trên trang này"] [aria-controls="part-b"]'))
    assert.match(visible.textContent!, /Kỹ năng của trang đang xem/, "The page being read loads its own section")
    assert.doesNotMatch(document.body.textContent!, /Kỹ năng của trang ẩn/, "The hidden page stays as it was")
    assert.equal(document.activeElement?.closest("[data-page]")?.getAttribute("data-page"), "trang đang xem")
  })
})
