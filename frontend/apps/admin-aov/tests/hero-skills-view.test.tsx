import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Skill } from "../src/features/publishing/types"
import type { SkillImage } from "../src/features/publishing/skill-artwork"
import {
  selectSkillTranslation,
  skillLabel,
  skillSlot,
  skillVariant,
  skillVariantLabel,
  groupHeroSkills,
} from "../src/features/publishing/hero-skills"
import { createHeroFixture } from "./fixtures/hero-workspace-data"

let currentFetch: typeof fetch
const dispatchFetch: typeof fetch = (input, init) => currentFetch(input, init)

function skill(skillKey: string, displayOrder = 0, formKey: string | null = null): Skill {
  return {
    skillKey,
    displayOrder,
    formKey,
    kind: "ACTIVE",
    iconAssetId: null,
    translations: [{ locale: "vi-VN", name: "Chiêu cùng tên", description: `Nội dung riêng ${skillKey}` }],
    effects: [],
  }
}

function image(id: string, overrides: Partial<SkillImage> = {}): SkillImage {
  return {
    id,
    heroId: "view-hero",
    skillKey: null,
    sourceSlot: 2,
    variantNo: 1,
    assetId: `asset-${id}`,
    sourceFilename: `${id}.png`,
    label: null,
    version: 1,
    ...overrides,
  }
}

test("skill labels use stable source slots and translations fall back without inventing text", () => {
  const value = skill("skill-3-2")
  value.translations.push({ locale: "en-US", name: "English skill", description: "English description" })
  assert.equal(selectSkillTranslation(value, "en-US")?.description, "English description")
  assert.equal(selectSkillTranslation(value, "th-TH")?.locale, "vi-VN")
  assert.equal(skillSlot(value), 3)
  assert.equal(skillVariant(value), 2)
  assert.equal(skillLabel(value), "Chiêu 3")
  assert.equal(skillVariantLabel(value, [value]), undefined)
  const otherVariant = skill("skill-3-1")
  assert.equal(skillVariantLabel(value, [value, otherVariant]), "Biến thể 2")
  assert.equal(skillVariantLabel(otherVariant, [value, otherVariant]), "Biến thể 1")
  assert.equal(skillVariantLabel({ ...value, formKey: "known-form" }, [value, otherVariant]), undefined)
  const unknownCapture = skill("capture-unknown")
  unknownCapture.effects = [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 3 } }]
  assert.deepEqual(
    groupHeroSkills([value, otherVariant, unknownCapture]).map((group) =>
      group.skills.map((member) => member.skillKey),
    ),
    [[value.skillKey, otherVariant.skillKey], [unknownCapture.skillKey]],
  )
  assert.equal(
    groupHeroSkills([otherVariant, skill("skill-3-01")]).length,
    2,
    "Ambiguous variant numbers remain separate",
  )
  const custom = skill("stable-custom-key")
  custom.effects = [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 4 } }]
  assert.equal(skillSlot(custom), 4)
  assert.equal(skillVariant(custom), null)
  assert.equal(skillLabel(custom), "Chiêu 4")
  custom.kind = "PASSIVE"
  assert.equal(skillLabel(custom), "Nội tại")
  custom.translations = []
  assert.equal(selectSkillTranslation(custom, "th-TH"), undefined)
  const opaque = skill("skill-unknown")
  assert.equal(skillSlot(opaque), null)
  assert.equal(skillVariant(opaque), null)
})

async function withView(run: (view: Awaited<ReturnType<typeof createView>>) => Promise<void>) {
  const view = await createView()
  try {
    await run(view)
  } finally {
    await view.close()
  }
}

async function createView() {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero/view-hero", pretendToBeVisual: true })
  const fixture = createHeroFixture()
  const requests: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const path = String(input).replace("/api/wiki/v1", "")
    requests.push(path)
    const match = /^\/admin\/media\/assets\/([^/?]+)$/.exec(path)
    if (match)
      return Response.json({
        id: match[1],
        semanticType: "SKILL_ICON",
        state: "ACTIVE",
        version: 1,
        currentVersionId: `version-${match[1]}`,
        currentUrl: `/media/${match[1]}.webp`,
        versions: [{ id: `version-${match[1]}`, url: `/media/${match[1]}.webp` }],
        provenance: [],
      })
    return fixture.fetcher(input, init)
  }
  currentFetch = fetcher
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
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
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    BroadcastChannel: undefined,
    fetch: dispatchFetch,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { HeroSkillsView } = await import("../src/features/publishing/hero-skills-view")
  const { SkillArtwork, skillImageMatch } = await import("../src/features/publishing/skill-artwork")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(["hero-skill-images", "view-hero"], [])
  await verifySession()
  return {
    dom,
    document: dom.window.document,
    client,
    requests,
    HeroSkillsView,
    SkillArtwork,
    skillImageMatch,
    render: async (node: React.ReactNode) =>
      act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)),
    click: async (node: HTMLElement) => act(async () => node.click()),
    waitFor: async (condition: () => boolean) => {
      for (let attempt = 0; attempt < 100 && !condition(); attempt++)
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5))
        })
      assert.ok(condition(), "Expected skill view state was not reached")
    },
    close: async () => {
      await act(async () => root.unmount())
      client.clear()
      await logout()
      dom.window.close()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}

test("only the selected skill mounts its description and duplicate names preserve form identity across reorders", async () => {
  await withView(async ({ document, HeroSkillsView, render, click }) => {
    const passive = { ...skill("skill-0-1", 0), kind: "PASSIVE" as const }
    const human = skill("skill-2-1", 1, "human")
    const fox = skill("skill-2-2", 2, "fox")
    const skills = [fox, human, passive]
    const details = () => document.querySelector('[aria-label="Chi tiết kỹ năng"]')!
    const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Chọn kỹ năng"] button')]
    await render(<HeroSkillsView skills={skills} locale="vi-VN" heroId="view-hero" />)
    assert.match(details().textContent!, /Nội dung riêng skill-0-1/)
    assert.doesNotMatch(document.body.textContent!, /Nội dung riêng skill-2-1|Nội dung riêng skill-2-2/)
    assert.equal(buttons().length, 2, "Verified variants share one stacked selector")
    await click(buttons().find((button) => button.getAttribute("aria-label")?.endsWith(" · 2 biến thể"))!)
    const states = () => [
      ...document.querySelectorAll<HTMLButtonElement>('[aria-label="Chuyển biến thể kỹ năng"] button'),
    ]
    const foxButton = states().find((button) => button.getAttribute("aria-label")?.startsWith("fox ·"))!
    foxButton.focus()
    await click(foxButton)
    assert.equal(document.activeElement, foxButton, "Changing a variant preserves keyboard focus")
    assert.match(details().textContent!, /Nội dung riêng skill-2-2/)
    assert.doesNotMatch(details().textContent!, /Nội dung riêng skill-2-1/)
    await click(states().find((button) => button.getAttribute("aria-label")?.startsWith("human ·"))!)
    assert.match(details().textContent!, /Nội dung riêng skill-2-1/)
    await render(
      <HeroSkillsView
        skills={[
          { ...fox, displayOrder: 0 },
          { ...human, displayOrder: 8 },
          { ...passive, displayOrder: 10 },
        ]}
        locale="vi-VN"
        heroId="view-hero"
      />,
    )
    assert.match(details().textContent!, /Nội dung riêng skill-2-1/)
    assert.equal(
      states()
        .find((button) => button.getAttribute("aria-pressed") === "true")
        ?.getAttribute("aria-label")
        ?.startsWith("human ·"),
      true,
    )
    await render(<HeroSkillsView skills={[fox, passive]} locale="vi-VN" heroId="view-hero" />)
    assert.match(details().textContent!, /Nội dung riêng skill-0-1/)
  })
})

test("fallback copy is explicit and skill level labels, zero costs and collapsed provenance remain faithful to source", async () => {
  await withView(async ({ document, HeroSkillsView, render }) => {
    const value = skill("skill-2-1")
    value.effects = [
      {
        effectType: "SOURCE_SNAPSHOT",
        metadata: {
          sourceSlot: 2,
          cooldown: { seconds: 0 },
          energyCost: { value: 0 },
          levelTable: {
            column_labels: ["Lv 1", "Lv 2", "Lv 3"],
            rows: [{ label: "Sát thương", display_values: ["100", "150", "200"] }],
          },
          reviewFlags: [{ type: "not_visible_in_source", note: "Thiếu dữ liệu dạng thứ hai" }],
          sourceImageUrl: "https://source.example/skill.png",
        },
      },
    ]
    await render(<HeroSkillsView skills={[value]} locale="th-TH" heroId="view-hero" />)
    const details = document.querySelector('[aria-label="Chi tiết kỹ năng"]')!
    assert.match(details.textContent!, /Dự phòng: vi-VN/)
    assert.match(details.textContent!, /Hồi chiêu: 0 giây/)
    assert.match(details.textContent!, /Tiêu hao: 0/)
    assert.deepEqual(
      [...details.querySelectorAll("thead th")].map((node) => node.textContent),
      ["Thông số", "Lv 1", "Lv 2", "Lv 3"],
    )
    assert.deepEqual(
      [...details.querySelectorAll("tbody td")].map((node) => node.textContent),
      ["100", "150", "200"],
    )
    const source = details.querySelector("details")!
    assert.equal(source.open, false)
    assert.match(source.querySelector("summary")!.textContent!, /Nguồn & đối chiếu/)
    assert.equal(source.querySelector("a")!.href, "https://source.example/skill.png")
    await render(
      <HeroSkillsView
        skills={[{ ...value, translations: [{ locale: "vi-VN", name: "Chưa đủ", description: "" }] }]}
        locale="th-TH"
        heroId="view-hero"
      />,
    )
    assert.match(details.textContent!, /Chưa có mô tả kỹ năng bằng vi-VN/)
    await render(<HeroSkillsView skills={[{ ...value, translations: [] }]} locale="th-TH" heroId="view-hero" />)
    assert.match(details.textContent!, /Chưa có mô tả kỹ năng bằng th-TH/)
  })
})

test("many source variants remain distinguishable and selected keys scroll only their compact selector", async () => {
  await withView(async ({ dom, document, HeroSkillsView, render }) => {
    const skills = [
      ...Array.from({ length: 15 }, (_, index) => skill(`skill-${Math.floor(index / 3)}-${(index % 3) + 1}`, index)),
      ...Array.from({ length: 3 }, (_, index) => skill(`capture-${index}`, index + 15)),
    ]
    const snapshot = structuredClone(skills)
    const show = (selectedSkillKey: string) =>
      render(<HeroSkillsView skills={skills} locale="vi-VN" selectedSkillKey={selectedSkillKey} />)
    await show("skill-1-2")
    const details = () => document.querySelector('[aria-label="Chi tiết kỹ năng"]')!
    const rail = document.querySelector<HTMLElement>('[aria-label="Chọn kỹ năng"]')!
    const buttons = [...rail.querySelectorAll<HTMLButtonElement>("button")]
    assert.equal(buttons.length, 8, "Three standalone captures and five verified slot groups remain")
    assert.equal(buttons.filter((button) => button.getAttribute("aria-label")?.endsWith(" · 3 biến thể")).length, 5)
    assert.equal(document.querySelectorAll('[aria-label="Chuyển biến thể kỹ năng"] button').length, 3)
    assert.ok(
      document.querySelector(
        '[aria-label="Chuyển biến thể kỹ năng"] [aria-label^="Biến thể 2 ·"][aria-pressed="true"]',
      ),
    )
    assert.match(details().textContent!, /Nội dung riêng skill-1-2/)
    assert.match(details().textContent!, /Biến thể 2/)
    let vertical = false
    Object.defineProperties(rail, {
      clientWidth: { configurable: true, get: () => (vertical ? 210 : 240) },
      scrollWidth: { configurable: true, get: () => (vertical ? 210 : 960) },
      clientHeight: { configurable: true, get: () => (vertical ? 200 : 120) },
      scrollHeight: { configurable: true, get: () => (vertical ? 704 : 120) },
    })
    rail.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, vertical ? 210 : 240, vertical ? 200 : 120)
    buttons.forEach((button, index) => {
      button.scrollIntoView = () => assert.fail("Skill selection must not scroll the outer page")
      button.getBoundingClientRect = () =>
        vertical
          ? new dom.window.DOMRect(0, index * 88 - rail.scrollTop, 210, 80)
          : new dom.window.DOMRect(index * 120 - rail.scrollLeft, 0, 112, 104)
    })
    document.documentElement.scrollTop = 321
    await show("skill-4-3")
    assert.equal(rail.scrollLeft, 352)
    assert.equal(rail.scrollTop, 0)
    assert.match(details().textContent!, /Nội dung riêng skill-4-3/)
    assert.match(details().textContent!, /Biến thể 3/)
    await show("skill-1-2")
    assert.equal(rail.scrollLeft, 120)
    vertical = true
    rail.scrollLeft = 0
    await show("capture-2")
    assert.equal(rail.scrollTop, 496)
    assert.equal(rail.scrollLeft, 0)
    assert.equal(document.documentElement.scrollTop, 321)
    await show("skill-4-1")
    assert.equal(rail.scrollTop, 352)
    assert.match(details().textContent!, /Nội dung riêng skill-4-1/)
    assert.match(details().textContent!, /Biến thể 1/)
    assert.deepEqual(skills, snapshot)
  })
})

test("flat mode keeps each verified variant in its skill region and preserves selected identity when returning to focus", async () => {
  await withView(async ({ document, HeroSkillsView, render, click }) => {
    const human = skill("skill-2-1", 1, "human")
    const fox = skill("skill-2-2", 2, "fox")
    const unknown = skill("capture-original", 0)
    unknown.translations[0].name = "Bản thu thập chưa xác định"
    const skills = [unknown, fox, human]
    await render(<HeroSkillsView skills={skills} locale="vi-VN" selectedSkillKey={fox.skillKey} />)
    const mode = (name: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Cách hiển thị kỹ năng"] button')].find(
        (button) => button.textContent?.trim() === name,
      )!
    await click(mode("Dạng phẳng"))
    assert.equal(mode("Dạng phẳng").getAttribute("aria-pressed"), "true")
    assert.equal(document.querySelector('[aria-label="Chọn kỹ năng"]'), null)
    const all = document.querySelector('[aria-label="Tất cả kỹ năng"]')!
    assert.equal(all.querySelectorAll("article").length, 3)
    const group = all.querySelector('[aria-label="Nhóm Chiêu 2 · 2 biến thể"]')!
    assert.equal(group.querySelectorAll("article").length, 2)
    assert.match(group.textContent!, /Nội dung riêng skill-2-1/)
    assert.match(group.textContent!, /Nội dung riêng skill-2-2/)
    assert.equal(group.textContent!.includes("Nội dung riêng capture-original"), false)
    await click(mode("Tập trung"))
    assert.equal(mode("Tập trung").getAttribute("aria-pressed"), "true")
    assert.match(document.querySelector('[aria-label="Chi tiết kỹ năng"]')!.textContent!, /Nội dung riêng skill-2-2/)
    assert.ok(
      document.querySelector('[aria-label="Chuyển biến thể kỹ năng"] [aria-label^="fox ·"][aria-pressed="true"]'),
    )
    let requested: string | undefined
    await render(
      <HeroSkillsView
        skills={skills}
        locale="vi-VN"
        selectedSkillKey={fox.skillKey}
        layout="flat"
        onLayoutChange={(next) => {
          requested = next
        }}
      />,
    )
    await click(mode("Tập trung"))
    assert.equal(requested, "focus")
    assert.ok(
      document.querySelector('[aria-label="Tất cả kỹ năng"]'),
      "The controlled URL layout remains authoritative",
    )
  })
})

test("inventory matches only unambiguous skill identities and explicit version artwork always wins", async () => {
  await withView(async ({ document, client, SkillArtwork, skillImageMatch, render, waitFor }) => {
    const value = skill("skill-2-1")
    const exact = image("exact", { skillKey: value.skillKey, sourceSlot: 9, variantNo: 8 })
    const loose = image("loose")
    assert.equal(skillImageMatch(value, [loose, exact])?.id, exact.id)
    assert.equal(skillImageMatch(value, [exact, image("second-exact", { skillKey: value.skillKey }), loose]), undefined)
    assert.equal(skillImageMatch(value, [loose])?.id, loose.id)
    assert.equal(skillImageMatch(value, [loose, image("second-loose")]), undefined)
    assert.equal(skillImageMatch(value, [image("other-key", { skillKey: "another-skill" })]), undefined)
    assert.equal(skillImageMatch(value, [image("wrong-slot", { sourceSlot: 1 })]), undefined)
    assert.equal(skillImageMatch(value, [image("wrong-variant", { variantNo: 2 })]), undefined)
    const unverified = skill("custom-unidentified")
    unverified.effects = [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 2 } }]
    assert.equal(skillImageMatch(unverified, [loose]), undefined)
    const conflicting = { ...value, effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 3 } }] }
    assert.equal(skillImageMatch(conflicting, [image("conflicting-slot", { sourceSlot: 3 })]), undefined)
    client.setQueryData(["hero-skill-images", "view-hero"], [exact])
    await render(<SkillArtwork skill={{ ...value, iconAssetId: "version-icon" }} heroId="view-hero" preview />)
    await waitFor(() => !!document.querySelector('img[src="/media/version-icon.webp"]'))
    assert.equal(
      document.querySelector('img[alt="Ảnh kỹ năng của phiên bản"]')?.getAttribute("src"),
      "/media/version-icon.webp",
    )
    assert.equal(document.body.textContent?.includes("Ảnh thư viện"), false)
    await render(<SkillArtwork skill={value} heroId="view-hero" />)
    await waitFor(() => !!document.querySelector('img[src="/media/asset-exact.webp"]'))
    assert.match(document.body.textContent!, /Ảnh thư viện/)
    assert.ok(document.querySelector('[title*="không phải ảnh xác nhận riêng"]'))
  })
})

test("ambiguous and unbound inventory stays available in a gallery that loads asset metadata only after opening", async () => {
  await withView(async ({ dom, document, client, requests, HeroSkillsView, render, waitFor }) => {
    const value = skill("skill-2-1")
    const images = [
      image("ambiguous-a", { skillKey: value.skillKey }),
      image("ambiguous-b", { skillKey: value.skillKey }),
      image("unknown", { sourceSlot: 4, variantNo: 3 }),
    ]
    client.setQueryData(["hero-skill-images", "view-hero"], images)
    await render(<HeroSkillsView skills={[value]} locale="vi-VN" heroId="view-hero" />)
    const gallery = [...document.querySelectorAll("details")].find((node) =>
      node.querySelector("summary")?.textContent?.includes("Ảnh chưa gắn nội dung"),
    )!
    assert.ok(gallery)
    assert.match(gallery.querySelector("summary")!.textContent!, /3/)
    assert.equal(gallery.open, false)
    assert.equal(gallery.querySelector("img"), null)
    assert.equal(
      requests.some((path) => path.startsWith("/admin/media/assets/asset-")),
      false,
    )
    await act(async () => {
      gallery.open = true
      gallery.dispatchEvent(new dom.window.Event("toggle"))
    })
    await waitFor(() => gallery.querySelectorAll("img").length === 3)
    assert.ok(gallery.querySelector('img[src="/media/asset-unknown.webp"]'))
    await act(async () => {
      gallery.open = false
      gallery.dispatchEvent(new dom.window.Event("toggle"))
    })
    assert.equal(gallery.querySelectorAll("img").length, 0)
  })
})
