import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

async function createView(observe = true) {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: "http://localhost/hero/test" })
  const observers: FakeObserver[] = []
  class FakeObserver {
    disconnected = false
    target: Element | null = null
    readonly root: Element | Document | null
    constructor(
      readonly callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      this.root = options?.root ?? null
      observers.push(this)
    }
    observe(target: Element) {
      this.target = target
    }
    disconnect() {
      this.disconnected = true
    }
    unobserve() {}
    takeRecords() {
      return []
    }
    emit(top: number, height = 24) {
      const bounds = new dom.window.DOMRect(0, top, 200, height)
      this.callback(
        [
          {
            target: this.target!,
            boundingClientRect: bounds,
            rootBounds: new dom.window.DOMRect(0, 55, 400, 300),
            isIntersecting: top >= 55 && top < 355,
          } as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver,
      )
    }
  }
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
    BroadcastChannel: undefined,
    IntersectionObserver: observe ? FakeObserver : undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { HeroScrollIdentity } = await import("../src/features/publishing/hero-scroll-identity")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(["hero-content-asset", "head-asset"], {
    id: "head-asset",
    currentUrl: "/media/head-asset.webp",
    provenance: [],
  })
  const root = createRoot(dom.window.document.getElementById("root")!)
  const headingRef = { current: null as HTMLHeadingElement | null }
  let headingTop = 130
  const render = async (identityKey = "hero:revision-1", name = "Lữ Bố", assetId?: string, actions?: React.ReactNode) =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <div id="outer-scroll" style={{ overflowY: "auto" }}>
            <div
              id="inner-scroll"
              style={{ overflowY: "auto", height: 300 }}
              ref={(node) => {
                if (node) node.getBoundingClientRect = () => new dom.window.DOMRect(0, 55, 400, 300)
              }}
            >
              <HeroScrollIdentity
                headingRef={headingRef}
                identityKey={identityKey}
                name={name}
                assetId={assetId}
                actions={actions}
              />
              <h1
                ref={(node) => {
                  headingRef.current = node
                  if (node) node.getBoundingClientRect = () => new dom.window.DOMRect(0, headingTop, 200, 24)
                }}
              >
                {name}
              </h1>
            </div>
          </div>
        </QueryClientProvider>,
      ),
    )
  const document = dom.window.document
  return {
    dom,
    document,
    observers,
    render,
    setHeadingTop: (value: number) => {
      headingTop = value
    },
    host: () => document.querySelector<HTMLElement>('[data-slot="hero-scroll-identity"]')!,
    close: async () => {
      await act(async () => root.unmount())
      client.clear()
      dom.window.close()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}

test("compact identity reveals only above the nearest scroll viewport and keeps a zero-height noninteractive host", async () => {
  const view = await createView()
  try {
    await view.render()
    assert.equal(view.observers.length, 1)
    const observer = view.observers[0]!
    assert.equal(observer.root, view.document.getElementById("inner-scroll"))
    assert.equal(observer.target, view.document.querySelector("h1"))
    assert.equal(view.host().getAttribute("aria-hidden"), "true")
    await act(async () => observer.emit(900))
    assert.equal(view.host().dataset.visible, "false", "A heading below the viewport must not reveal the identity")
    await act(async () => observer.emit(32))
    assert.equal(view.host().dataset.visible, "false", "Partly visible heading must retain the normal header")
    await act(async () => observer.emit(31))
    assert.equal(view.host().dataset.visible, "true")
    assert.equal(view.host().getAttribute("aria-hidden"), "false")
    assert.match(view.host().textContent!, /LB/)
    assert.match(view.host().textContent!, /Lữ Bố/)
    assert.match(view.host().className, /h-0/)
    assert.match(view.host().className, /-mb-6/)
    assert.match(view.host().className, /sticky top-0/)
    assert.equal(view.host().querySelector("button, a, input, select"), null)
    await act(async () => observer.emit(0, 0))
    assert.equal(view.host().dataset.visible, "false", "Hidden activity panels must not reveal an empty heading")
    await act(async () => observer.emit(130))
    assert.equal(view.host().dataset.visible, "false")
  } finally {
    await view.close()
  }
})

test("compact header actions are mounted only while visible to avoid hidden keyboard controls", async () => {
  const view = await createView()
  try {
    await view.render("hero:revision-1", "Airi", undefined, <button type="button">Chuyển tướng nhanh</button>)
    assert.equal(view.host().querySelector("button"), null)
    await act(async () => view.observers[0]!.emit(20))
    assert.equal(view.host().querySelector("button")?.textContent, "Chuyển tướng nhanh")
    await act(async () => view.observers[0]!.emit(130))
    assert.equal(view.host().querySelector("button"), null)
  } finally {
    await view.close()
  }
})

test("revision changes replace observers, use the backend HEAD asset and ignore late callbacks after cleanup", async () => {
  const view = await createView()
  try {
    await view.render("hero:revision-1", "Airi", "head-asset")
    const first = view.observers[0]!
    assert.equal(view.host().querySelector("img")?.getAttribute("src"), "/media/head-asset.webp")
    await act(async () => first.emit(20))
    assert.equal(view.host().dataset.visible, "true")
    await view.render("hero:revision-2", "Airi", "head-asset")
    assert.equal(first.disconnected, true)
    assert.equal(view.observers.length, 2)
    assert.equal(view.host().dataset.visible, "false")
    await act(async () => first.emit(20))
    assert.equal(view.host().dataset.visible, "false", "Disconnected observer callbacks cannot reveal the old identity")
    await act(async () => view.observers[1]!.emit(20))
    assert.equal(view.host().dataset.visible, "true")
  } finally {
    await view.close()
  }
  assert.ok(view.observers.every((observer) => observer.disconnected))
})

test("scroll and resize fallback works without IntersectionObserver and cleans up event listeners", async () => {
  const view = await createView(false)
  try {
    await view.render()
    assert.equal(view.host().dataset.visible, "false")
    view.setHeadingTop(15)
    await act(async () => {
      view.document.getElementById("inner-scroll")!.dispatchEvent(new view.dom.window.Event("scroll"))
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    assert.equal(view.host().dataset.visible, "true")
    view.setHeadingTop(130)
    await act(async () => {
      view.dom.window.dispatchEvent(new view.dom.window.Event("resize"))
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    assert.equal(view.host().dataset.visible, "false")
    assert.equal(view.host().querySelector("img"), null)
  } finally {
    await view.close()
  }
})
