import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Skill } from "../src/features/publishing/types"

const skill = (key = "skill-1-1", iconAssetId: string | null = null): Skill => ({
  skillKey: key,
  kind: "ACTIVE",
  formKey: null,
  displayOrder: 1,
  iconAssetId,
  translations: [{ locale: "vi-VN", name: "Kỹ năng mẫu", description: "" }],
  effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceHeroCode: "dirak" } }],
})
const resources = [
  {
    id: "dirak",
    skills: [
      { slot: 1, variants: [{ index: 1, icon: "assets/skill/dirak-1-1.png" }] },
      { slot: 3, variants: [{ index: 2, icon: "assets/skill/dirak-3-2.png" }] },
    ],
  },
]

test("comparison reference artwork requires an exact unambiguous hero, slot and variant with safe local paths", async () => {
  const originalChannel = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel")
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: undefined })
  const { resolveComparisonReferenceIcon: resolve } = await import("../src/features/publishing/comparison-skill-icon")
  if (originalChannel) Object.defineProperty(globalThis, "BroadcastChannel", originalChannel)
  else Reflect.deleteProperty(globalThis, "BroadcastChannel")
  const props = { before: skill(), after: skill(), referenceCodes: ["dirak", "dirak"] }
  assert.equal(resolve(props, resources), "/__resources/assets/skill/dirak-1-1.png")
  assert.equal(
    resolve({ ...props, before: null, after: skill("skill-3-2") }, resources),
    "/__resources/assets/skill/dirak-3-2.png",
  )
  for (const referenceCodes of [[], ["Dirak"], ["dirak", "raz"], ["../dirak"], ["dirak/"]])
    assert.equal(resolve({ ...props, referenceCodes }, resources), null)
  for (const key of ["skill-4-1", "skill-3-1", "skill-1", "capture-skill-1", "skill-1-variant-1"])
    assert.equal(resolve({ ...props, before: null, after: skill(key) }, resources), null)
  assert.equal(resolve({ ...props, after: skill("skill-3-2") }, resources), null)
  assert.equal(resolve(props, [...resources, ...resources]), null)
  assert.equal(resolve(props, [{ ...resources[0], id: "raz" }]), null)
  assert.equal(resolve(props, null), null)
  for (const icon of ["https://other.invalid/a.png", "/assets/skill/a.png", "assets/../a.png", "assets/a.svg"])
    assert.equal(resolve(props, [{ id: "dirak", skills: [{ slot: 1, variants: [{ index: 1, icon }] }] }]), null)
  for (const flagList of ["reviewFlags", "heroReviewFlags"])
    assert.equal(
      resolve(
        {
          ...props,
          after: {
            ...skill(),
            effects: [
              {
                effectType: "SOURCE_SNAPSHOT",
                metadata: { sourceHeroCode: "dirak", [flagList]: [{ type: "source_filename_display_mismatch" }] },
              },
            ],
          },
        },
        resources,
      ),
      null,
    )
  assert.equal(
    resolve(
      {
        ...props,
        after: {
          ...skill(),
          effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceHeroCode: "raz" } }],
        },
      },
      resources,
    ),
    null,
  )
})

test("comparison skill icons share a reference request, preserve bound images and show honest missing or failed icons", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing/hero" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  const requests: { url: string; credentials: RequestCredentials | undefined }[] = []
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    BroadcastChannel: undefined,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), credentials: init?.credentials })
      return Response.json({ heroes: resources })
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { ComparisonSkillIcon } = await import("../src/features/publishing/comparison-skill-icon")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document
  const render = async (children: React.ReactNode) =>
    act(async () => root.render(<QueryClientProvider client={client}>{children}</QueryClientProvider>))
  const waitFor = async (condition: () => boolean) => {
    for (let count = 0; count < 100 && !condition(); count++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition())
  }
  try {
    await render(<ComparisonSkillIcon before={null} after={null} />)
    assert.equal(requests.length, 0)
    assert.ok(document.querySelector('[role="img"][aria-label="Kỹ năng · Chưa có ảnh kỹ năng"]'))

    client.setQueryData(["hero-content-asset", "old"], { currentUrl: "/media/old.png" })
    client.setQueryData(["hero-content-asset", "new"], { currentUrl: "/media/new.png" })
    await render(<ComparisonSkillIcon before={skill("skill-1-1", "old")} after={skill("skill-1-1", "new")} />)
    assert.ok(document.querySelector('[aria-label="Đổi ảnh kỹ năng"]'))
    assert.deepEqual(
      [...document.querySelectorAll("img")].map((image) => image.getAttribute("src")),
      ["/media/old.png", "/media/new.png"],
    )
    assert.equal(requests.length, 0)

    for (const [beforeId, afterId] of [
      ["old", null],
      [null, "new"],
    ] as const) {
      await render(
        <ComparisonSkillIcon
          before={skill("skill-1-1", beforeId)}
          after={skill("skill-1-1", afterId)}
          referenceCodes={["dirak"]}
        />,
      )
      assert.ok(document.querySelector('[aria-label="Đổi ảnh kỹ năng"]'))
      assert.equal(document.querySelectorAll("img").length, 1)
      assert.equal(document.querySelector("img")!.getAttribute("src"), `/media/${beforeId ?? afterId}.png`)
      assert.ok(document.querySelector('[role="img"][aria-label="Chiêu 1 · Chưa có ảnh kỹ năng"]'))
      const pairText = document.querySelector('[aria-label="Đổi ảnh kỹ năng"]')!.textContent!
      assert.match(pairText, /Trước/)
      assert.match(pairText, /Sau/)
      assert.doesNotMatch(pairText, /old|new/)
      assert.equal(requests.length, 0)
    }

    await render(<ComparisonSkillIcon before={skill("skill-1-1", "old")} after={skill("skill-1-1", "old")} />)
    assert.equal(document.querySelectorAll("img").length, 1)
    await render(
      <>
        <ComparisonSkillIcon before={skill()} after={skill()} referenceCodes={["dirak"]} />
        <ComparisonSkillIcon before={null} after={skill("skill-3-2")} referenceCodes={["dirak"]} />
        <ComparisonSkillIcon before={null} after={skill("skill-4-1")} referenceCodes={["dirak"]} />
      </>,
    )
    await waitFor(() => document.querySelectorAll("img").length === 2)
    assert.deepEqual(requests, [{ url: "/__resources/data/heroes.json", credentials: "omit" }])
    assert.ok([...document.querySelectorAll("img")].every((image) => image.alt.includes("Ảnh tham chiếu")))
    assert.ok(document.querySelector('[role="img"][aria-label="Chiêu 4 · Chưa có ảnh kỹ năng"]'))
    await act(async () => document.querySelector("img")!.dispatchEvent(new dom.window.Event("error")))
    assert.equal(document.querySelectorAll("img").length, 1)
    assert.ok(document.querySelector('[role="img"][aria-label="Chiêu 1 · Chưa có ảnh kỹ năng"]'))
    assert.equal(requests.length, 1)
  } finally {
    await act(async () => root.unmount())
    client.clear()
    dom.window.close()
    for (const [key, descriptor] of originals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
  }
})
