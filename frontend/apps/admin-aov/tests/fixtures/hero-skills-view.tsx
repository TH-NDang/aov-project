/**
 * A signed-in hero page window for the skill, stat and overview tests: `withView` mounts what a test renders inside a
 * query client against the hero workspace fixture server, and answers media asset reads with their own URL.
 */
import * as React from "react"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Skill } from "../../src/features/publishing/api/types"
import type { SkillImage } from "../../src/features/publishing/components/skills/skill-artwork"
import { createHeroFixture } from "./hero-workspace-data"
import { createWindow, installWindow, waitFor } from "./dom"

let currentFetch: typeof fetch
// Session clients keep the fetch they were made with, so it routes to the fixture of the running test.
const dispatchFetch: typeof fetch = (input, init) => currentFetch(input, init)

/** An active skill whose description names its key, so a test can tell which one is shown. */
export function skill(skillKey: string, displayOrder = 0, formKey: string | null = null): Skill {
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

/** An inventory image of the viewed hero, for slot 2 variant 1 unless `overrides` say otherwise. */
export function image(id: string, overrides: Partial<SkillImage> = {}): SkillImage {
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

export type HeroView = Awaited<ReturnType<typeof createView>>

/** Runs `run` in a fresh hero page window and closes it afterwards, whatever the outcome. */
export async function withView(run: (view: HeroView) => Promise<void>) {
  const view = await createView()
  try {
    await run(view)
  } finally {
    await view.close()
  }
}

async function createView() {
  const dom = createWindow("http://localhost/hero/view-hero")
  const fixture = createHeroFixture()
  const requests: string[] = []
  currentFetch = async (input, init) => {
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
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const restoreGlobals = installWindow(dom.window, { fetch: dispatchFetch })
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../../src/app/auth/session")
  const { HeroSkillsView } = await import("../../src/features/publishing/components/skills/hero-skills-view")
  const { SkillArtwork, skillImageMatch } =
    await import("../../src/features/publishing/components/skills/skill-artwork")
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
      await waitFor(condition, "Expected skill view state was not reached")
    },
    close: async () => {
      await act(async () => root.unmount())
      client.clear()
      await logout()
      dom.window.close()
      restoreGlobals()
    },
  }
}
