import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { HeroWiki } from "../../aov-wiki/src/features/heroes/hero-wiki"

async function mount(url: string, fetcher: typeof fetch) {
  const dom = new JSDOM('<div id="root"></div>', { url })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  await act(async () => {
    root.render(<HeroWiki />)
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  return {
    dom,
    async close() {
      await act(async () => root.unmount())
      dom.window.close()
      for (const [key, value] of originals) {
        if (value) Object.defineProperty(globalThis, key, value)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}
const context = {
  region: "VN",
  requestedLocale: "vi-VN",
  ruleset: { id: "r", code: "TEST" },
  patch: { id: "p", code: "synthetic" },
  patchVariantId: "v",
  effectiveAt: "2026-01-01T00:00:00Z",
}
const regionResponse = () =>
  Response.json([
    { code: "VN", displayName: "Việt Nam", available: true },
    { code: "TH", displayName: "Thái Lan", available: true },
  ])

test("wiki retains selected context in links and ignores late responses after changing region", async () => {
  let finishOld: (response: Response) => void = () => {}
  const calls: string[] = []
  const fetcher = (async (url: unknown) => {
    const path = String(url)
    calls.push(path)
    if (path.endsWith("/regions")) return regionResponse()
    if (path.includes("region=VN"))
      return new Promise<Response>((resolve) => {
        finishOld = resolve
      })
    return Response.json({
      context: { ...context, region: "TH" },
      items: [{ id: "hero-th", code: "fixture", name: "Thai fixture", roles: ["MAGE"] }],
      page: 0,
      size: 24,
      totalElements: 1,
    })
  }) as typeof fetch
  const view = await mount("http://localhost/?region=VN&locale=vi-VN", fetcher)
  try {
    const select = view.dom.window.document.querySelector("select")!
    await act(async () => {
      select.value = "TH"
      select.dispatchEvent(new view.dom.window.Event("change", { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    await act(async () => {
      finishOld(Response.json({ items: [{ id: "hero-vn", name: "Outdated fixture", roles: [] }], totalElements: 1 }))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    assert.ok(view.dom.window.document.body.textContent?.includes("Thai fixture"))
    assert.ok(!view.dom.window.document.body.textContent?.includes("Outdated fixture"))
    const heroLink = view.dom.window.document.querySelector('a[href*="hero=hero-th"]') as HTMLAnchorElement
    assert.ok(heroLink.href.includes("region=TH"))
    assert.ok(calls.some((path) => path.includes("region=TH")))
  } finally {
    await view.close()
  }
})

test("wiki renders untrusted descriptions as text and shows empty gameplay history", async () => {
  const fetcher = (async (url: unknown) => {
    const path = String(url)
    if (path.endsWith("/regions")) return regionResponse()
    if (path.includes("/changes?")) return Response.json({ items: [], page: 0, size: 10, totalElements: 0 })
    return Response.json({
      id: "hero",
      code: "fixture",
      revisionId: "rev",
      context: { ...context, fallbackApplied: true, actualLocale: "vi-VN" },
      content: {
        profile: { name: "Synthetic hero", title: null, summary: "Test", lore: null, roles: ["MAGE"] },
        overviewRatings: {
          survivability: 1,
          attackDamage: 2,
          skillEffects: 3,
          difficulty: 4,
          scaleCode: "GAME_OVERVIEW_10",
        },
        combatStats: { values: [] },
        skills: {
          skills: [
            {
              skillKey: "skill-1",
              name: "Test skill",
              description: "<script>bad()</script>",
              kind: "ACTIVE",
              displayOrder: 0,
            },
          ],
        },
        skins: { skins: [] },
      },
      media: {},
      skillMedia: {},
      skinMedia: {},
    })
  }) as typeof fetch
  const view = await mount("http://localhost/?hero=hero&region=VN&locale=en-US", fetcher)
  try {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    assert.ok(view.dom.window.document.body.textContent?.includes("<script>bad()</script>"))
    assert.equal(view.dom.window.document.querySelector("script"), null)
    assert.ok(view.dom.window.document.body.textContent?.includes("Chưa có thay đổi gameplay"))
    assert.ok(view.dom.window.document.body.textContent?.includes("Đang dùng bản dịch vi-VN"))
  } finally {
    await view.close()
  }
})
