import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"

async function withButton(
  props: Partial<React.ComponentProps<typeof import("../src/features/publishing/publish-button").PublishButton>>,
  run: (ui: {
    document: Document
    click: (element: Element | null | undefined) => Promise<void>
    trigger: () => HTMLButtonElement
    calls: string[]
    rerender: (next: typeof props) => Promise<void>
  }) => Promise<void>,
) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero/a" })
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    HTMLInputElement: dom.window.HTMLInputElement,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  // Radix and React Router decide how to behave when first imported, so they must see the DOM above.
  const { createRoot } = await import("react-dom/client")
  const { MemoryRouter } = await import("react-router")
  const { PublishButton } = await import("../src/features/publishing/publish-button")
  const calls: string[] = []
  const root = createRoot(dom.window.document.getElementById("root")!)
  const render = (next: typeof props) =>
    act(async () =>
      root.render(
        <MemoryRouter>
          <PublishButton
            busy={false}
            publishing={false}
            issues={[]}
            unsaved={[]}
            failure=""
            onDismissFailure={() => calls.push("dismiss")}
            onOpenSection={(key) => calls.push(`open:${key}`)}
            onPublish={() => calls.push("publish")}
            {...next}
          />
        </MemoryRouter>,
      ),
    )
  await render(props)
  try {
    await run({
      document: dom.window.document,
      calls,
      rerender: render,
      trigger: () => dom.window.document.querySelector<HTMLButtonElement>("#root button")!,
      click: (element) =>
        act(async () => {
          assert.ok(element, "element to click")
          element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
        }),
    })
  } finally {
    await act(async () => root.unmount())
    for (const [key, descriptor] of originals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (globalThis as Record<string, unknown>)[key]
    dom.window.close()
  }
}

const panel = (document: Document) => document.querySelector('[aria-label="Điều kiện xuất bản"]')

test("with nothing in the way, one click publishes and opens nothing", async () => {
  await withButton({}, async ({ document, click, trigger, calls }) => {
    await click(trigger())
    assert.ok(calls.includes("publish"))
    assert.equal(panel(document), null)
  })
})

test("a blocked click does not publish, and says what is missing and where to fix it", async () => {
  await withButton(
    {
      issues: ["Bổ sung đánh giá có căn cứ."],
      unsaved: [{ key: "PROFILE", label: "Thông tin" }],
      patch: { to: "/game-configuration", code: "2026-10-30", canPublish: true },
    },
    async ({ document, click, trigger, calls }) => {
      await click(trigger())
      assert.equal(calls.includes("publish"), false)
      const shown = panel(document)!
      assert.match(shown.textContent!, /Bổ sung đánh giá có căn cứ/)
      assert.match(shown.textContent!, /Mở patch 2026-10-30/)
      await click([...shown.querySelectorAll("button")].find((button) => button.textContent === "Mở Thông tin"))
      assert.ok(calls.includes("open:PROFILE"))
      assert.equal(panel(document), null, "the popover closes on the way to the section")
    },
  )
})

test("a refusal from the server opens beside the button", async () => {
  await withButton({ failure: "Thiếu ảnh." }, async ({ document }) => {
    assert.match(panel(document)!.querySelector("[role=alert]")!.textContent!, /Thiếu ảnh/)
  })
})

test("a blocked button stays clickable while a busy one does not", async () => {
  await withButton({ issues: ["x"] }, async ({ trigger, rerender }) => {
    assert.equal(trigger().disabled, false)
    await rerender({ issues: ["x"], busy: true })
    assert.equal(trigger().disabled, true)
  })
})

test("baseline contexts are read season by season, because the endpoint needs a season", async () => {
  const { loadBaselineContexts } = await import("../src/features/publishing/baseline-context-form")
  const requested: string[] = []
  const contexts = await loadBaselineContexts(async <T,>(path: string) => {
    requested.push(path)
    if (path === "/admin/seasons") return [{ id: "s1" }, { id: "s2" }] as T
    return [{ contextId: path.endsWith("s1") ? "a" : "b" }] as T
  })
  assert.deepEqual(requested, [
    "/admin/seasons",
    "/admin/heroes/import/contexts?seasonId=s1",
    "/admin/heroes/import/contexts?seasonId=s2",
  ])
  assert.deepEqual(
    contexts.map((context) => context.contextId),
    ["a", "b"],
  )
})
