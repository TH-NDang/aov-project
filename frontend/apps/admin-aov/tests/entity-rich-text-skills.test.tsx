import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import {
  createEntityIndex,
  extractSkillReferenceIds,
  parseRichText,
  resolveEntityRoute,
  validateRichTextSettings,
  type EntityReference,
} from "@aov/ui/lib/entity-rich-text"
import {
  insertReference,
  referenceSearchGroup,
  safeSelection,
  type EntityReferenceSearch,
  type ReferenceSearchPage,
} from "@aov/ui/lib/entity-rich-text-editor"
import { intersectionHarness } from "./fixtures/intersection-observer"
import { referenceInput, fillReferenceInput, referenceInputValue } from "./fixtures/reference-input"

const heroId = "43dec8c3-0197-4459-bbdf-9812fbc12dd6"
const skill: EntityReference = {
  id: `${heroId}.skill-1-2`,
  kind: "skill",
  heroId,
  skillKey: "skill-1-2",
  revisionId: "6003d2c7-34ba-4692-ae66-17d2d6835971",
  sourceSlot: 1,
  variantNo: 2,
  autoMatch: false,
  iconAssetId: "skill-icon",
  owner: {
    id: heroId,
    kind: "hero",
    translations: [{ locale: "vi-VN", name: "Edras", aliases: [], description: "" }],
    iconAssetId: "hero-head",
  },
  translations: [{ locale: "vi-VN", name: "Tung hoành", aliases: [], description: "Gây <b>sát thương</b>." }],
}

test("skill tokens preserve exact composite identity, owning hero and safe route without automatic recognition", () => {
  const snapshot = insertReference("Xin @edras chiêu 1 2", { start: 4, end: 20 }, skill, "Tung hoành", false)!
  assert.equal(snapshot.value, `Xin <ref=skill:${skill.id}>Tung hoành</ref>`)
  assert.deepEqual(extractSkillReferenceIds(snapshot.value), [skill.id])
  const index = createEntityIndex([{ ...skill, autoMatch: true }], "vi-VN", "vi-VN")
  const nodes = parseRichText(`${snapshot.value} Tung hoành`, index)
  assert.equal(nodes.filter((node) => node.type === "reference").length, 1)
  const reference = nodes.find((node) => node.type === "reference")!
  assert.equal(reference.type === "reference" && reference.entity.owner?.id, heroId)
  assert.equal(reference.type === "reference" && reference.entity.skillKey, "skill-1-2")
  assert.equal(safeSelection(snapshot.value, { start: 20, end: 20 }), false)
  assert.equal(
    resolveEntityRoute(skill, "admin"),
    `/hero/${heroId}?tab=skills&skill=skill-1-2&revision=${skill.revisionId}`,
  )
  assert.equal(
    resolveEntityRoute({ ...skill, destinations: { admin: "javascript:alert(1)" } }, "admin"),
    resolveEntityRoute(skill, "admin"),
  )
  assert.equal(
    resolveEntityRoute({ ...skill, heroId: "other", destinations: { admin: "/hero/other" } }, "admin"),
    undefined,
  )
  const settings = {
    schemaVersion: 1,
    autoRecognize: true,
    fallbackLocale: "vi-VN",
    entities: [skill],
  }
  assert.throws(() => validateRichTextSettings(settings), /managed by the server/)
  const term: EntityReference = {
    id: "term-1",
    kind: "term",
    translations: [{ locale: "vi-VN", name: "Liên kết kỹ năng", aliases: [], description: snapshot.value }],
  }
  assert.equal(
    validateRichTextSettings({ ...settings, entities: [term] }).entities[0]?.translations[0]?.description,
    snapshot.value,
  )
  for (const query of ["Chiêu 1 Airi", "Kỹ năng Edras", "Chiêu thức Edras"])
    assert.equal(referenceSearchGroup(query).kind, "skill")
  assert.equal(referenceSearchGroup("Airi chiêu 1").kind, undefined)
})

test("saved skill lookup is bounded, rejects malformed identities and survives a full normal catalog", () => {
  const token = `<ref=skill:${skill.id}>Chiêu</ref>`
  assert.deepEqual(
    extractSkillReferenceIds(`${token}${token}<ref=skill:../../bad>x</ref><ref=skill:${skill.id}>unclosed`),
    [skill.id],
  )
  for (const invalid of [
    `${heroId.toUpperCase()}.skill-1-2`,
    `${heroId}.Skill-1-2`,
    `${heroId}.skill_1_2`,
    `${heroId}.skill.1.2`,
    `${heroId}.skill--1`,
    `${heroId}.${"s".repeat(65)}`,
  ]) {
    assert.deepEqual(extractSkillReferenceIds(`${token}<ref=skill:${invalid}>Bad</ref>`), [skill.id])
    assert.equal(
      parseRichText(
        `<ref=skill:${invalid}>Bad</ref>`,
        createEntityIndex([{ ...skill, id: invalid }], "vi-VN", "vi-VN"),
      )[0]?.type,
      "text",
    )
  }
  const many = Array.from({ length: 600 }, (_, n) => `<ref=skill:${heroId}.skill-${n}>x</ref>`).join("")
  assert.equal(extractSkillReferenceIds(many).length, 500)
  const heroes: EntityReference[] = Array.from({ length: 2000 }, (_, n) => ({
    id: `hero-${n}`,
    kind: "hero",
    translations: [{ locale: "vi-VN", name: `Hero ${n}`, aliases: [], description: "" }],
  }))
  assert.equal(parseRichText(token, createEntityIndex([...heroes, skill], "vi-VN", "vi-VN"))[0]?.type, "reference")
  assert.equal(
    parseRichText(token, createEntityIndex([{ ...skill, skillKey: "wrong" }], "vi-VN", "vi-VN"))[0]?.type,
    "text",
  )
})

test("remote skill suggestions debounce, page on inner scroll, retain lazy paired icons and insert the exact variant", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", pretendToBeVisual: true })
  const observer = intersectionHarness()
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    Event: dom.window.Event,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IntersectionObserver: observer.Observer,
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
  const { createRoot } = await import("react-dom/client")
  const { EntityRichTextEditor } = await import("@aov/ui/components/entity-rich-text-editor")
  const { EntityRichText } = await import("@aov/ui/components/entity-rich-text")
  const requests: Parameters<EntityReferenceSearch>[0][] = []
  let finishSlow: ((page: ReferenceSearchPage) => void) | undefined
  const metadata: string[] = []
  const next = {
    ...skill,
    id: `${heroId}.skill-1-3`,
    skillKey: "skill-1-3",
    variantNo: 3,
    translations: [{ ...skill.translations[0]!, name: "Tung hoành khác" }],
  }
  const searchReferences: EntityReferenceSearch = async (request) => {
    requests.push(request)
    if (request.query === "Edras chậm")
      return new Promise((resolve) => {
        finishSlow = resolve
      })
    return { items: [request.page ? next : skill], page: request.page, size: 1, totalElements: 2 }
  }
  const resolveIcon = async (entity: EntityReference) => {
    metadata.push(entity.iconAssetId!)
    return `/media/${entity.iconAssetId}.png`
  }
  let saved = ""
  function Harness() {
    const [value, setValue] = React.useState("")
    return (
      <EntityRichTextEditor
        label="Kỹ năng QA"
        value={value}
        onChange={(text) => {
          saved = text
          setValue(text)
        }}
        locale="vi-VN"
        searchReferences={searchReferences}
        resolveIcon={resolveIcon}
        renderPreview={false}
      />
    )
  }
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const area = () => referenceInput(document)
  const type = async (text: string) =>
    act(async () => {
      fillReferenceInput(area(), text)
    })
  const wait = (ms = 340) =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms))
    })
  try {
    await act(async () => root.render(<Harness />))
    await wait()
    assert.equal(requests.length, 0)
    await type("@edras")
    await type("@edras chiêu 1 2")
    assert.equal(requests.length, 0)
    await wait()
    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.query, "edras chiêu 1 2")
    assert.equal(requests[0]?.locale, "vi-VN")
    const list = document.querySelector<HTMLElement>('[role="listbox"]')!
    assert.ok(
      document.querySelector('[role="option"][aria-label*="Edras"][aria-label*="Biến thể 2"]'),
      document.body.innerHTML,
    )
    assert.equal(metadata.length, 0)
    const icons = [...list.querySelectorAll("[aria-hidden=true]")].filter((element) => observer.observing(element))
    assert.equal(icons.length, 2)
    assert.equal(observer.root(icons[0]!), list)
    await act(async () => {
      observer.intersect(icons[0]!)
      observer.intersect(icons[1]!)
    })
    assert.deepEqual(metadata.sort(), ["hero-head", "skill-icon"])
    await act(async () => list.dispatchEvent(new dom.window.Event("scroll", { bubbles: true })))
    await wait(10)
    assert.equal(requests.length, 2)
    assert.equal(requests[1]?.page, 1)
    assert.equal(document.querySelectorAll('[role="option"]').length, 2)
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[role="option"][aria-label*="Biến thể 3"]')!.click(),
    )
    assert.equal(saved, `<ref=skill:${next.id}>Tung hoành khác</ref>`)
    assert.equal(referenceInputValue(area()), saved)
    const chip = area().querySelector<HTMLElement>('[data-reference-kind="skill"]')!
    assert.ok(chip)
    assert.equal(chip.getAttribute("contenteditable"), "false")
    assert.equal(chip.getAttribute("data-reference-id"), next.id)
    assert.equal(chip.getAttribute("data-reference-token"), saved)
    assert.ok(chip.textContent?.includes("Edras"))
    assert.ok(chip.textContent?.includes("Tung hoành khác"))
    assert.ok(chip.querySelector('img[src="/media/hero-head.png"]'))
    assert.ok(chip.querySelector('img[src="/media/skill-icon.png"]'))
    assert.ok(!area().textContent?.includes("<ref="))
    assert.equal(document.querySelector('[role="listbox"]'), null)
    assert.equal(requests[1]?.signal.aborted, true)
    await type("@Airi chiêu 1")
    await wait()
    assert.equal(requests.at(-1)?.query, "Airi chiêu 1")
    const latest = requests.at(-1)!
    await act(async () =>
      area().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    )
    assert.equal(latest.signal.aborted, true)
    await type("@Edras chậm")
    await wait()
    const slowRequest = requests.at(-1)!
    assert.ok(finishSlow)
    await type("@Airi chiêu 1")
    await wait()
    assert.equal(slowRequest.signal.aborted, true)
    await act(async () => finishSlow!({ items: [next], page: 0, size: 1, totalElements: 1 }))
    assert.equal(document.querySelector('[role="option"][aria-label*="Biến thể 3"]'), null)
    assert.ok(document.querySelector('[role="option"][aria-label*="Biến thể 2"]'))
    await act(async () =>
      root.render(
        <EntityRichText
          text={`<ref=skill:${skill.id}>Tung hoành</ref>`}
          entities={[skill]}
          locale="vi-VN"
          context="admin"
        />,
      ),
    )
    await act(async () => document.querySelector<HTMLButtonElement>("button")!.focus())
    assert.ok(document.body.textContent?.includes("Edras"))
    assert.ok(document.body.textContent?.includes("Biến thể 2"))
    assert.equal(document.querySelector("a")?.getAttribute("href"), resolveEntityRoute(skill, "admin"))
    assert.equal(document.querySelectorAll("button button, button a").length, 0)
  } finally {
    await act(async () => {
      root.unmount()
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    dom.window.close()
    for (const [key, value] of originals) {
      if (value) Object.defineProperty(globalThis, key, value)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})

test("skill rendering pairs the correct owner with the specific skill and keeps legacy hero output unchanged", async () => {
  const { EntityRichText } = await import("@aov/ui/components/entity-rich-text")
  const html = renderToStaticMarkup(
    <EntityRichText
      text={`<ref=skill:${skill.id}>Tung hoành</ref>`}
      entities={[{ ...skill, icon: "/skill.png", owner: { ...skill.owner!, icon: "/edras.png" } }]}
      locale="vi-VN"
      context="admin"
    />,
  )
  const dom = new JSDOM(html)
  assert.match(
    dom.window.document.querySelector("button")!.getAttribute("aria-label")!,
    /Edras.*Tung hoành.*Chiêu 1.*Biến thể 2/,
  )
  assert.equal(dom.window.document.querySelectorAll("img").length, 2)
  assert.equal(dom.window.document.querySelectorAll("button button, button a").length, 0)
  dom.window.close()
})
