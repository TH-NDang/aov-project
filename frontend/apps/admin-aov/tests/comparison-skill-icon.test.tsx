import { setFetch } from "./fixtures/dispatch-fetch"
import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { SkillImage } from "../src/features/publishing/components/skills/skill-artwork"
import type { Skill } from "../src/features/publishing/api/types"
import { installWindow, waitFor, withGlobals } from "./fixtures/dom"

const skill = (
  key = "skill-1-1",
  iconAssetId: string | null = null,
  metadata: Record<string, unknown> = {},
): Skill => ({
  skillKey: key,
  kind: "ACTIVE",
  formKey: null,
  displayOrder: 1,
  iconAssetId,
  translations: [{ locale: "vi-VN", name: "Kỹ năng mẫu", description: "" }],
  effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceHeroCode: "dirak", ...metadata } }],
})

const image = (assetId: string, sourceSlot: number, variantNo: number, skillKey: string | null = null): SkillImage => ({
  id: `image-${assetId}`,
  heroId: "hero-1",
  skillKey,
  sourceSlot,
  variantNo,
  assetId,
  sourceFilename: `${assetId}.png`,
  label: null,
  version: 1,
})
const library = [image("lib-1-1", 1, 1), image("lib-3-2", 3, 2), image("lib-2-1-a", 2, 1), image("lib-2-1-b", 2, 1)]

/** Source modules compile with classic JSX here, so module-level JSX needs a global React while loading. */
const loadIcon = () =>
  withGlobals({ React }, () => import("../src/features/publishing/components/skills/comparison-skill-icon"))

test("a skill without an icon in either version takes its library picture by the skills view rule, or none", async () => {
  const { comparisonLibraryImage: pick } = await loadIcon()
  assert.equal(pick(skill(), skill(), library)?.assetId, "lib-1-1")
  assert.equal(pick(null, skill("skill-3-2"), library)?.assetId, "lib-3-2")
  // A picture linked to the skill wins over the slot rule.
  assert.equal(pick(skill(), null, [...library, image("linked", 4, 1, "skill-1-1")])?.assetId, "linked")
  assert.equal(pick(null, skill("skill-2-1"), library), undefined, "two pictures for one slot are ambiguous")
  assert.equal(pick(null, skill("skill-4-1"), library), undefined)
  assert.equal(pick(skill("skill-1-1"), skill("skill-3-2"), library), undefined, "two different skills")
  assert.equal(pick(null, null, library), undefined)
  for (const flags of ["reviewFlags", "heroReviewFlags"])
    assert.equal(
      pick(null, skill("skill-1-1", null, { [flags]: [{ type: "source_filename_display_mismatch" }] }), library),
      undefined,
      "a capture whose file name shows another skill cannot pick by slot",
    )
})

test("comparison skill icons share one library request, keep bound images and show honest missing icons", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing/hero" })
  Object.defineProperty(dom.window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
  let restoreGlobals = () => {}
  const requests: string[] = []
  restoreGlobals = installWindow(dom.window)
  // The API client keeps the fetch it found when it loaded, so the fake answers through the shared dispatcher.
  const restoreFetch = setFetch(async (input) => {
    const path = String(input).replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "comparison-fixture", expiresIn: 3600 })
    requests.push(path)
    if (path === "/admin/heroes/hero-1/skill-images") return Response.json({ items: library })
    return Response.json({ code: "NOT_FOUND" }, { status: 404 })
  })
  const { createRoot } = await import("react-dom/client")
  const { ComparisonSkillIcon } = await import("../src/features/publishing/components/skills/comparison-skill-icon")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  for (const id of ["old", "new", "lib-1-1", "lib-3-2"])
    client.setQueryData(["media", "asset", id, "content"], { currentUrl: `/media/${id}.png` })
  const document = dom.window.document
  const render = async (children: React.ReactNode) =>
    act(async () => root.render(<QueryClientProvider client={client}>{children}</QueryClientProvider>))

  const sources = () => [...document.querySelectorAll("img")].map((picture) => picture.getAttribute("src"))
  try {
    await render(<ComparisonSkillIcon before={null} after={null} heroId="hero-1" />)
    assert.ok(document.querySelector('[role="img"][aria-label="Kỹ năng · Chưa có ảnh kỹ năng"]'))

    await render(<ComparisonSkillIcon before={skill("skill-1-1", "old")} after={skill("skill-1-1", "new")} />)
    assert.ok(document.querySelector('[aria-label="Đổi ảnh kỹ năng"]'))
    assert.deepEqual(sources(), ["/media/old.png", "/media/new.png"])

    for (const [beforeId, afterId] of [
      ["old", null],
      [null, "new"],
    ] as const) {
      await render(
        <ComparisonSkillIcon
          before={skill("skill-1-1", beforeId)}
          after={skill("skill-1-1", afterId)}
          heroId="hero-1"
        />,
      )
      assert.deepEqual(sources(), [`/media/${beforeId ?? afterId}.png`])
      assert.ok(document.querySelector('[role="img"][aria-label="Chiêu 1 · Chưa có ảnh kỹ năng"]'))
      const pairText = document.querySelector('[aria-label="Đổi ảnh kỹ năng"]')!.textContent!
      assert.match(pairText, /Trước/)
      assert.match(pairText, /Sau/)
    }
    assert.deepEqual(requests, [], "a skill with an icon of its own never asks the library")

    await render(
      <>
        <ComparisonSkillIcon before={skill()} after={skill()} heroId="hero-1" />
        <ComparisonSkillIcon before={null} after={skill("skill-3-2")} heroId="hero-1" />
        <ComparisonSkillIcon before={null} after={skill("skill-4-1")} heroId="hero-1" />
      </>,
    )
    await waitFor(() => document.querySelectorAll("img").length === 2)
    assert.deepEqual(sources(), ["/media/lib-1-1.png", "/media/lib-3-2.png"])
    assert.deepEqual(requests, ["/admin/heroes/hero-1/skill-images"], "the icons share one library request")
    assert.ok([...document.querySelectorAll("img")].every((picture) => picture.alt.includes("Ảnh thư viện kỹ năng")))
    assert.ok(document.querySelector('[role="img"][aria-label="Chiêu 4 · Chưa có ảnh kỹ năng"]'))
  } finally {
    await act(async () => root.unmount())
    client.clear()
    restoreFetch()
    dom.window.close()
    restoreGlobals()
  }
})
