import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"

const entity: EntityReference = {
  id: "hero-1",
  kind: "hero",
  translations: [{ locale: "vi-VN", name: "Lữ Bố", aliases: [], description: "Chiến binh <script>alert(1)</script>" }],
  destinations: { admin: "/hero/hero-1", wiki: "/heroes/lu-bo" },
  icon: "/images/lu-bo.png",
  display: { color: "#dd3344", underline: true, showIcon: true },
}

async function verifyAllowlistedFormatting() {
  const { EntityRichText } = await import("@aov/ui/components/entity-rich-text")
  const render = (text: string, autoRecognize = true) =>
    new JSDOM(
      renderToStaticMarkup(
        <EntityRichText text={text} entities={[entity]} locale="vi-VN" context="admin" autoRecognize={autoRecognize} />,
      ),
    ).window.document
  const name = entity.translations[0]!.name
  const nested = render(`<b><i><color=#2563eb><ref=hero:hero-1>${name}</ref></color></i></b>`, false)
  assert.equal(nested.querySelectorAll("strong > em > span > button").length, 1)
  assert.equal(nested.querySelector("button")?.textContent, name)
  assert.equal(nested.querySelector("button")?.style.color, "rgb(37, 99, 235)")
  assert.equal(nested.querySelector("button")?.style.fontWeight, "inherit")
  assert.equal(nested.querySelector("button")?.style.fontStyle, "inherit")
  assert.equal(nested.querySelectorAll("button button, a a").length, 0)

  const inherited = render(`<color=#12ab34><b><i>${name}</i></b></color>`)
  assert.equal(inherited.querySelector("strong > em > button")?.style.color, "rgb(18, 171, 52)")
  const automatic = render(`<b>${name}</b> <i>${name}</i>`)
  assert.equal(automatic.querySelectorAll("strong > button, em > button").length, 2)
  const noauto = render(`<noauto><b>${name}</b> <i>${name}</i></noauto>`)
  assert.equal(noauto.querySelectorAll("strong, em").length, 2)
  assert.equal(noauto.querySelectorAll("button").length, 0)
  assert.equal(noauto.body.textContent, `${name} ${name}`)

  const unsafe = render('<b onclick="alert(1)">bad</b> <i style="color:red">bad</i> <script>alert(1)</script>')
  assert.equal(unsafe.querySelectorAll("strong, em, script, [onclick], [style]").length, 0)
  assert.ok(unsafe.body.textContent?.includes('<b onclick="alert(1)">'))
  const unclosed = render(`<b><i>${name}</i>`)
  assert.equal(unclosed.querySelectorAll("strong, em, button").length, 0)
  assert.equal(unclosed.body.textContent, `<b><i>${name}</i>`)

  const airi = { ...entity, translations: [{ ...entity.translations[0]!, name: "Airi" }] }
  const equipment: EntityReference = {
    id: "phi-tieu",
    kind: "item",
    icon: "/images/phi-tieu.png",
    translations: [{ locale: "vi-VN", name: "Phi Tiêu", aliases: [], description: "Trang bị" }],
  }
  const projectile = new JSDOM(
    renderToStaticMarkup(
      <EntityRichText
        text={"Airi ném phi tiêu; trang bị <ref=item:phi-tieu>Phi Tiêu</ref>."}
        entities={[airi, equipment]}
        locale="vi-VN"
        context="admin"
      />,
    ),
  ).window.document
  assert.equal(projectile.querySelectorAll('[aria-label="Tướng: Airi"]').length, 1)
  assert.equal(projectile.querySelectorAll('[aria-label="Trang bị: Phi Tiêu"]').length, 1)
  assert.equal(projectile.querySelectorAll('img[src="/images/phi-tieu.png"]').length, 1)
  assert.ok(projectile.body.textContent?.includes("Airi ném phi tiêu"))
}

test("entity rich text renders safely and supports focus, keyboard, touch and route contexts", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" })
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
    Event: dom.window.Event,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
    cancelAnimationFrame: clearTimeout,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { EntityRichText } = await import("@aov/ui/components/entity-rich-text")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const mount = async (context: "admin" | "wiki" = "admin", locale = "vi-VN", entities = [entity]) =>
    act(async () => {
      root.render(<EntityRichText text="Lữ Bố" entities={entities} locale={locale} context={context} />)
    })
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  try {
    await verifyAllowlistedFormatting()
    const markup = renderToStaticMarkup(
      <EntityRichText
        text={"<script>alert(1)</script> <color=#ff0000>safe</color> Lữ Bố"}
        entities={[entity]}
        locale="vi-VN"
        context="admin"
      />,
    )
    assert.ok(markup.includes("&lt;script&gt;"))
    assert.ok(!markup.includes("<script>"))
    const manualColor = renderToStaticMarkup(
      <EntityRichText
        text={`<color=#2563eb>${entity.translations[0]!.name}</color>`}
        entities={[entity]}
        locale="vi-VN"
        context="admin"
      />,
    )
    assert.equal(new JSDOM(manualColor).window.document.querySelector("button")?.style.color, "rgb(37, 99, 235)")
    assert.match(markup, /color:#ff0000/)
    assert.match(markup, /alt=""/)
    assert.match(markup, /aria-label="Tướng: Lữ Bố"/)
    assert.equal(new JSDOM(markup).window.document.querySelector("a a"), null)

    await mount()
    let trigger = document.querySelector<HTMLButtonElement>("button")!
    await act(async () => trigger.dispatchEvent(new dom.window.MouseEvent("pointerover", { bubbles: true })))
    await settle()
    assert.ok(document.querySelector('[role="dialog"]'), "Pointer hover opens the card")
    await act(async () => {
      trigger.dispatchEvent(new dom.window.MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }))
      await new Promise((resolve) => setTimeout(resolve, 220))
    })
    assert.ok(!document.querySelector('[role="dialog"]'), "Pointer leave closes an unfocused card")
    await act(async () => trigger.focus())
    await settle()
    assert.ok(document.querySelector('[role="dialog"]'))
    assert.equal(document.querySelector("script"), null)
    assert.ok(document.body.textContent?.includes("Chiến binh <script>alert(1)</script>"))
    assert.equal(document.querySelector("a")?.getAttribute("href"), "/hero/hero-1")
    assert.equal(document.querySelector("a a"), null)
    await act(async () => document.querySelector<HTMLAnchorElement>("a")!.focus())
    await settle()
    assert.ok(document.querySelector('[role="dialog"]'), "Card remains available when focusing its link")
    await act(async () =>
      document.activeElement!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    )
    await settle()
    assert.equal(document.querySelector('[role="dialog"]'), null)

    await mount("wiki", "en-US")
    trigger = document.querySelector<HTMLButtonElement>("button")!
    await act(async () => trigger.click())
    await settle()
    assert.equal(document.querySelector("a")?.getAttribute("href"), "/heroes/lu-bo")
    assert.ok(document.body.textContent?.includes("Ngôn ngữ dự phòng: vi-VN"))
    assert.ok(document.querySelector('[role="dialog"]'), "Click opens the card without requiring hover")

    const described = {
      ...entity,
      translations: [
        {
          ...entity.translations[0]!,
          description: `<b><i>Formatted</i></b> <color=#12ab34>Color</color> <ref=hero:hero-2>Ally</ref> <ref=hero:hero-1>Self</ref> ${entity.translations[0]!.name} <script>alert(1)</script>`,
        },
      ],
    }
    const ally = { ...entity, id: "hero-2", translations: [{ ...entity.translations[0]!, name: "Ally hero" }] }
    await mount("admin", "vi-VN", [described, ally])
    await act(async () => document.querySelector<HTMLButtonElement>("button")!.click())
    await settle()
    const description = document.querySelector<HTMLParagraphElement>('[role="dialog"] p')!
    assert.equal(description.querySelector("strong > em")?.textContent, "Formatted")
    assert.equal(description.querySelector("span")?.style.color, "rgb(18, 171, 52)")
    assert.ok(description.textContent?.includes(`Ally Self ${entity.translations[0]!.name}`))
    assert.ok(!description.textContent?.includes("<ref="))
    assert.ok(!description.textContent?.includes("<b>"))
    assert.ok(description.textContent?.includes("<script>alert(1)</script>"))
    assert.equal(description.querySelectorAll("button, a, img, script").length, 0)
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1)
    assert.equal(document.querySelectorAll("button").length, 2)
    const close = document.querySelector<HTMLButtonElement>(
      `[aria-label="Đóng thông tin ${entity.translations[0]!.name}"]`,
    )!
    await act(async () => close.click())
    await settle()
    assert.equal(document.querySelector('[role="dialog"]'), null, "Touch users can explicitly close the card")

    let iconLoads = 0
    const resolveIcon = async () => {
      iconLoads++
      return "http://localhost:9000/hero-head.png"
    }
    await act(async () =>
      root.render(
        <EntityRichText
          text="Lữ Bố"
          entities={[{ ...entity, icon: null, iconAssetId: "head-asset" }]}
          locale="vi-VN"
          context="admin"
          resolveIcon={resolveIcon}
        />,
      ),
    )
    await settle()
    const image = document.querySelector<HTMLImageElement>('img[src="http://localhost:9000/hero-head.png"]')!
    assert.ok(image, "Matched hero mentions resolve actual uploaded head assets lazily")
    assert.equal(iconLoads, 1)
    await act(async () => image.dispatchEvent(new dom.window.Event("error")))
    assert.ok(
      document.querySelector('[data-slot="entity-icon-placeholder"]'),
      "Broken images keep a recognizable fallback",
    )

    const unsafe = {
      ...entity,
      icon: "https://example.com/image.svg",
      display: { color: "red;background:url(javascript:alert(1))" },
      destinations: { admin: "javascript:alert(1)" },
    }
    await mount("admin", "vi-VN", [unsafe])
    await act(async () => document.querySelector<HTMLButtonElement>("button")!.click())
    await settle()
    assert.equal(document.querySelector("a")?.getAttribute("href"), "/hero/hero-1")
    assert.equal(document.querySelector("img"), null)
    assert.ok(!document.body.innerHTML.includes("javascript:"))
    assert.ok(!document.body.innerHTML.includes("background:url"))
    for (const icon of [
      "//evil.test/icon.png",
      "data:image/png;base64,AA",
      "http://evil.test/icon.png",
      "/\\evil.test/icon.png",
      "/image%252esvg",
    ]) {
      const result = renderToStaticMarkup(
        <EntityRichText text="Lữ Bố" entities={[{ ...entity, icon }]} locale="vi-VN" context="admin" />,
      )
      assert.equal(new JSDOM(result).window.document.querySelector("img"), null)
    }
    const disabled = renderToStaticMarkup(
      <EntityRichText text="Lữ Bố" entities={[entity]} locale="vi-VN" context="admin" autoRecognize={false} />,
    )
    assert.equal(new JSDOM(disabled).window.document.querySelector("button"), null)
    const manual = renderToStaticMarkup(
      <EntityRichText
        text="<ref=hero:hero-1>Tên hiển thị</ref> <ref=hero:missing>Không tồn tại</ref>"
        entities={[entity]}
        locale="vi-VN"
        context="admin"
        autoRecognize={false}
      />,
    )
    const manualDocument = new JSDOM(manual).window.document
    assert.equal(manualDocument.querySelectorAll("button").length, 1)
    assert.equal(manualDocument.querySelector("button")?.textContent, "Tên hiển thị")
    assert.ok(manualDocument.body.textContent?.includes("Không tồn tại"))
    assert.equal(manualDocument.querySelectorAll("a").length, 0)
    const malformedColor = renderToStaticMarkup(
      <EntityRichText
        text={"<color=red;background:url(javascript:alert(1))>text</color> <img src=x onerror=alert(1)>"}
        locale="vi-VN"
        context="admin"
      />,
    )
    const malformedDocument = new JSDOM(malformedColor).window.document
    assert.equal(malformedDocument.querySelectorAll("img, [style]").length, 0)
  } finally {
    await act(async () => root.unmount())
    await settle()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
