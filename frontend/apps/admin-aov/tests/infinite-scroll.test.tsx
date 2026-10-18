import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act, Activity } from "react"
import { intersectionHarness } from "./fixtures/intersection-observer"

type InfiniteScrollComponent = typeof import("../src/components/infinite-scroll").InfiniteScroll
type PagingQuery = React.ComponentProps<InfiniteScrollComponent>["query"]

function pagingQuery(fetchNextPage: PagingQuery["fetchNextPage"]): PagingQuery {
  return { hasNextPage: true, isFetching: false, isError: false, fetchNextPage }
}

async function withUi(
  run: (ui: {
    document: Document
    InfiniteScroll: InfiniteScrollComponent
    intersections: ReturnType<typeof intersectionHarness>
    render: (node: React.ReactNode) => Promise<void>
    sentinel: () => HTMLElement
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
    getComputedStyle: dom.window.getComputedStyle,
    IntersectionObserver: intersections.Observer,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { InfiniteScroll } = await import("../src/components/infinite-scroll")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  try {
    await run({
      document: dom.window.document,
      InfiniteScroll,
      intersections,
      render: async (node) => {
        await act(async () => root.render(node))
      },
      sentinel: () => {
        const element = dom.window.document.querySelector<HTMLElement>('[aria-label="Loading more"]')
        assert.ok(element, "The list sentinel should be present while another page exists")
        return element
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

test("infinite loading uses the nearest vertical scroller and waits until the end approaches", async () => {
  await withUi(async ({ document, InfiniteScroll, intersections, render, sentinel }) => {
    let calls = 0
    const query = pagingQuery(async () => {
      calls++
    })
    await render(
      <div id="outer" style={{ overflowY: "auto" }}>
        <div id="list" style={{ overflowY: "scroll" }}>
          <div style={{ overflowX: "auto" }}>
            <InfiniteScroll query={query} label="Loading more" />
          </div>
        </div>
      </div>,
    )
    const target = sentinel()
    assert.equal(intersections.root(target), document.getElementById("list"))
    assert.equal(calls, 0)
    await act(async () => intersections.intersect(target, false))
    assert.equal(calls, 0)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 1)
  })
})

test("disabled and hidden list panels stop observing, then resume when shown", async () => {
  await withUi(async ({ InfiniteScroll, intersections, render, sentinel }) => {
    let calls = 0
    const query = pagingQuery(async () => {
      calls++
    })
    const panel = (enabled: boolean, visible = true) => (
      <Activity mode={visible ? "visible" : "hidden"}>
        <InfiniteScroll query={query} enabled={enabled} label="Loading more" />
      </Activity>
    )
    await render(panel(false))
    const target = sentinel()
    assert.equal(intersections.observing(target), false)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 0)
    await render(panel(true))
    assert.equal(intersections.observing(target), true)
    await render(panel(true, false))
    assert.equal(intersections.observing(target), false)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 0)
    await render(panel(true))
    assert.equal(intersections.observing(target), true)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 1)
  })
})

test("repeated intersections cannot overlap requests and the final page disconnects", async () => {
  await withUi(async ({ document, InfiniteScroll, intersections, render, sentinel }) => {
    let calls = 0
    let finish: (() => void) | undefined
    const query = pagingQuery(async () => {
      calls++
      await new Promise<void>((resolve) => (finish = resolve))
    })
    await render(<InfiniteScroll query={query} label="Loading more" />)
    const target = sentinel()
    await act(async () => {
      intersections.intersect(target)
      intersections.intersect(target)
      intersections.intersect(target)
    })
    assert.equal(calls, 1)
    await render(<InfiniteScroll query={{ ...query, isFetching: true }} label="Loading more" />)
    assert.equal(intersections.observing(target), false)
    assert.equal(document.querySelector('[role="status"]')?.textContent, "Loading more")
    await act(async () => {
      intersections.intersect(target)
      finish?.()
    })
    assert.equal(calls, 1)
    await render(<InfiniteScroll query={query} label="Loading more" />)
    assert.equal(intersections.observing(target), true)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 2)
    await act(async () => finish?.())
    await render(<InfiniteScroll query={{ ...query, hasNextPage: false }} label="Loading more" />)
    assert.equal(document.querySelector('[aria-label="Loading more"]'), null)
    assert.equal(intersections.observing(target), false)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 2)
  })
})

test("a failed page halts automatic loading until the query has recovered", async () => {
  await withUi(async ({ InfiniteScroll, intersections, render, sentinel }) => {
    let calls = 0
    const query = pagingQuery(async () => {
      calls++
      throw new Error("Page unavailable")
    })
    await render(<InfiniteScroll query={{ ...query, isError: true }} label="Loading more" />)
    const target = sentinel()
    assert.equal(intersections.observing(target), false)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 0)
    await render(<InfiniteScroll query={query} label="Loading more" />)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 1)
    await render(<InfiniteScroll query={{ ...query, isError: true }} label="Loading more" />)
    assert.equal(intersections.observing(target), false)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 1)
    await render(<InfiniteScroll query={query} label="Loading more" />)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 2)
  })
})

test("an explicit scrolling container takes precedence and unmounting disconnects it", async () => {
  await withUi(async ({ document, InfiniteScroll, intersections, render, sentinel }) => {
    let calls = 0
    const query = pagingQuery(async () => {
      calls++
    })
    const rootRef: React.RefObject<HTMLElement | null> = { current: null }
    await render(
      <div
        id="explicit-root"
        ref={(element) => {
          rootRef.current = element
        }}
      >
        <div style={{ overflowY: "auto" }}>
          <InfiniteScroll query={query} rootRef={rootRef} label="Loading more" />
        </div>
      </div>,
    )
    const target = sentinel()
    assert.equal(intersections.root(target), document.getElementById("explicit-root"))
    await render(null)
    assert.equal(intersections.observing(target), false)
    await act(async () => intersections.intersect(target))
    assert.equal(calls, 0)
  })
})
