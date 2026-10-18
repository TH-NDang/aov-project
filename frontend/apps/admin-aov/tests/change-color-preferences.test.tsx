import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import type { Root } from "react-dom/client"

async function withDocument(run: (root: Root, dom: JSDOM) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing", pretendToBeVisual: true })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    Element: dom.window.Element,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    fetch: async () => {
      throw new Error("Change color preferences must not request live data")
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  try {
    await run(root, dom)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test("change color settings persist independent colors and synchronize all badges without changing arrow identities", async () => {
  await withDocument(async (root, dom) => {
    const { ChangeColorSettings, changeColorsStorageKey } =
      await import("../src/features/publishing/change-color-preferences")
    const { ChangeKindBadge } = await import("../src/features/publishing/hero-change-badges")
    const document = dom.window.document
    await act(async () =>
      root.render(
        <>
          <ChangeColorSettings />
          <ChangeKindBadge kind="BUFF" />
          <ChangeKindBadge kind="BUFF" compact />
          <ChangeKindBadge kind="NERF" />
          <ChangeKindBadge kind="ADJUSTMENT" />
          <ChangeKindBadge kind="REWORK" />
        </>,
      ),
    )
    const badges = (kind: string) => [...document.querySelectorAll<HTMLElement>(`[data-change-kind="${kind}"]`)]
    assert.ok(badges("BUFF").every((badge) => badge.className.includes("text-emerald-700")))
    assert.ok(badges("BUFF").every((badge) => badge.querySelector("svg.lucide-arrow-up")))
    assert.ok(badges("NERF")[0].querySelector("svg.lucide-arrow-down"))
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Thiết lập màu thay đổi"]')!.click())
    const choose = async (label: string, color: string) =>
      act(async () => {
        const select = document.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!
        assert.ok(select)
        select.value = color
        select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
      })
    await choose("Màu tăng sức mạnh", "rose")
    await choose("Màu giảm sức mạnh", "blue")
    assert.deepEqual(JSON.parse(dom.window.localStorage.getItem(changeColorsStorageKey)!), {
      version: 1,
      buff: "rose",
      nerf: "blue",
    })
    assert.ok(badges("BUFF").every((badge) => badge.className.includes("text-rose-700")))
    assert.ok(badges("NERF")[0].className.includes("text-blue-700"))
    assert.ok(badges("BUFF").every((badge) => badge.querySelector("svg.lucide-arrow-up")))
    assert.ok(badges("NERF")[0].querySelector("svg.lucide-arrow-down"))
    assert.match(badges("BUFF")[0].textContent!, /Tăng sức mạnh/)
    assert.match(badges("NERF")[0].textContent!, /Giảm sức mạnh/)
    assert.ok(badges("ADJUSTMENT")[0].className.includes("text-amber-700"))
    assert.ok(badges("REWORK")[0].className.includes("text-violet-700"))
    await act(async () => {
      const next = JSON.stringify({ version: 1, buff: "violet", nerf: "amber" })
      dom.window.localStorage.setItem(changeColorsStorageKey, next)
      dom.window.dispatchEvent(new dom.window.StorageEvent("storage", { key: changeColorsStorageKey, newValue: next }))
    })
    assert.ok(badges("BUFF").every((badge) => badge.className.includes("text-violet-700")))
    assert.ok(badges("NERF")[0].className.includes("text-amber-700"))
    assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Màu tăng sức mạnh"]')!.value, "violet")
    await act(async () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.includes("Khôi phục màu mặc định"))!
        .click(),
    )
    assert.ok(badges("BUFF").every((badge) => badge.className.includes("text-emerald-700")))
    assert.ok(badges("NERF")[0].className.includes("text-rose-700"))
  })
})

test("stored preferences load on a fresh mount while malformed values and later storage clears restore safe defaults", async () => {
  const values = [
    { saved: '{"version":1,"buff":"blue","nerf":"emerald"}', buff: "blue", nerf: "emerald" },
    { saved: "not-json", buff: "emerald", nerf: "rose" },
    { saved: '{"version":2,"buff":"blue","nerf":"amber"}', buff: "emerald", nerf: "rose" },
    { saved: '{"version":1,"buff":"<script>","nerf":"rose"}', buff: "emerald", nerf: "rose" },
    { saved: '{"version":1,"buff":"__proto__","nerf":"rose"}', buff: "emerald", nerf: "rose" },
  ]
  for (const { saved, buff, nerf } of values) {
    await withDocument(async (root, dom) => {
      const { changeColorsStorageKey } = await import("../src/features/publishing/change-color-preferences")
      const { ChangeKindBadge } = await import("../src/features/publishing/hero-change-badges")
      dom.window.localStorage.setItem(changeColorsStorageKey, saved)
      await act(async () =>
        root.render(
          <>
            <ChangeKindBadge kind="BUFF" />
            <ChangeKindBadge kind="NERF" />
          </>,
        ),
      )
      const badge = (kind: string) => dom.window.document.querySelector<HTMLElement>(`[data-change-kind="${kind}"]`)!
      assert.match(badge("BUFF").className, new RegExp(`text-${buff}-700`))
      assert.match(badge("NERF").className, new RegExp(`text-${nerf}-700`))
      await act(async () => {
        dom.window.localStorage.clear()
        dom.window.dispatchEvent(new dom.window.StorageEvent("storage", { key: null, newValue: null }))
      })
      assert.match(badge("BUFF").className, /text-emerald-700/)
      assert.match(badge("NERF").className, /text-rose-700/)
    })
  }
})

test("blocked storage retains usable session preferences and reloads changes received while the settings were unmounted", async () => {
  await withDocument(async (root, dom) => {
    const { changeColorsStorageKey, useChangeColors } =
      await import("../src/features/publishing/change-color-preferences")
    const { ChangeKindBadge } = await import("../src/features/publishing/hero-change-badges")
    function Host() {
      const { setColor } = useChangeColors()
      return (
        <>
          <button onClick={() => setColor("BUFF", "rose")}>Change</button>
          <ChangeKindBadge kind="BUFF" />
        </>
      )
    }
    const originalStorage = Object.getOwnPropertyDescriptor(dom.window, "localStorage")!
    Object.defineProperty(dom.window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Storage disabled")
      },
    })
    await act(async () => root.render(<Host />))
    await act(async () => dom.window.document.querySelector<HTMLButtonElement>("button")!.click())
    const badge = () => dom.window.document.querySelector<HTMLElement>('[data-change-kind="BUFF"]')!
    assert.match(badge().className, /text-rose-700/)
    await act(async () => root.render(null))
    await act(async () => root.render(<Host />))
    assert.match(badge().className, /text-rose-700/)
    Object.defineProperty(dom.window, "localStorage", originalStorage)
    await act(async () => dom.window.document.querySelector<HTMLButtonElement>("button")!.click())
    await act(async () => root.render(null))
    dom.window.localStorage.setItem(changeColorsStorageKey, JSON.stringify({ version: 1, buff: "blue", nerf: "amber" }))
    await act(async () => root.render(<Host />))
    assert.match(badge().className, /text-blue-700/)
  })
})
