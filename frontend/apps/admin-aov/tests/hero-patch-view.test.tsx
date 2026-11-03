import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import type { Revision } from "../src/features/publishing/types"

test("the timeline uses the new published baseline, preserves it across patches and offers automatic selection", async () => {
  // JSDOM verifies interaction and content; stylesheet rendering belongs to browser checks.
  const loader = registerHooks({
    load(url, context, next) {
      return url.endsWith(".css")
        ? { format: "module", source: "export default {}", shortCircuit: true }
        : next(url, context)
    },
  })
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero/fixture-hero" })
  const fixture = createHeroFixture(false, true)
  const baseline: Revision = {
    ...fixture.revision,
    id: "new-baseline",
    state: "PUBLISHED",
    cause: "DATA_BASELINE",
    effectiveFromPatchVariantId: "oct30",
    revisionNo: 4,
  }
  const old: Revision = { ...baseline, id: "old-baseline", effectiveFromPatchVariantId: "s3", revisionNo: 1 }
  const requests: URL[] = []
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).includes("/patch-view?")) {
      const url = new URL(String(input), "http://localhost")
      requests.push(url)
      const selected = url.searchParams.get("anchorRevisionId")
      return Response.json({
        heroId: baseline.heroId,
        patchVariantId: url.searchParams.get("patchVariantId"),
        anchor: {
          direction: selected === baseline.id ? "BACKWARD" : "FORWARD",
          revisionId: selected ?? old.id,
          patchVariantId: selected === baseline.id ? "oct30" : "s3",
        },
        stats: [],
        roles: [],
        appliedChangeSetIds: ["notes"],
        skillFields: [
          {
            skillKey: "skill-1",
            fieldKey: "cooldown",
            value: selected === baseline.id ? "6 seconds from notes" : "8 seconds from old anchor",
            provenance: "DERIVED",
            changeSetId: "notes",
            patchVariantId: "oct30",
          },
          {
            skillKey: "skill-1",
            fieldKey: "trueDamage",
            value: "45 + 0.23*physicalAttack",
            provenance: "DERIVED",
            changeSetId: "notes",
            patchVariantId: "oct30",
          },
        ],
      })
    }
    if (String(input).includes("/hero-changes?"))
      return Response.json([
        {
          id: "notes",
          heroId: baseline.heroId,
          heroCode: "fixture-hero",
          sourceKind: "PATCH_NOTES",
          changes: [
            {
              id: "damage",
              type: "HERO_SKILL_CHANGE",
              skillKey: "skill-1",
              fieldKey: "trueDamage",
              changeKind: "ADJUSTMENT",
              oldValue: "40 + 0.25*physicalAttack",
              newValue: "45 + 0.23*physicalAttack",
            },
          ],
        },
      ])
    return fixture.fetcher(input, init)
  }
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
  client.setQueryData(["publication-overview"], {
    seasons: [{ id: "season", displayName: "S4 2026" }],
    releases: [],
    variants: [
      { id: "s3", patchCode: "S3", seasonId: "season", rulesetId: baseline.rulesetId, rulesetOrdinal: 1 },
      { id: "oct15", patchCode: "2026-10-15", seasonId: "season", rulesetId: baseline.rulesetId, rulesetOrdinal: 2 },
      { id: "oct30", patchCode: "2026-10-30", seasonId: "season", rulesetId: baseline.rulesetId, rulesetOrdinal: 3 },
    ],
  })
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { HeroPatchTimeline } = await import("../src/features/publishing/hero-patch-view")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 150 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    assert.ok(condition(), dom.window.document.body.textContent ?? "Missing timeline state")
  }
  try {
    await verifySession()
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/?atPatch=oct15"]}>
          <QueryClientProvider client={client}>
            <HeroPatchTimeline
              heroId={baseline.heroId}
              revision={baseline}
              revisions={[old, baseline, { ...baseline, id: "ocr-draft", state: "DRAFT" }]}
              content={fixture.content}
              locale="vi-VN"
              canRecord={false}
            />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => dom.window.document.body.textContent!.includes("6 seconds from notes"))
    assert.match(dom.window.document.body.textContent!, /40 \+ 0\.25 × Công vật lý/)
    assert.equal(dom.window.document.body.textContent!.split("45 + 0.23 × Công vật lý").length - 1, 2)
    assert.doesNotMatch(dom.window.document.body.textContent!, /physicalAttack/)
    const select = dom.window.document.querySelector<HTMLSelectElement>("select")!
    assert.equal(select.value, baseline.id)
    assert.equal(
      [...select.options].some((item) => item.value === "ocr-draft"),
      false,
    )
    assert.equal(requests.at(-1)!.searchParams.get("anchorRevisionId"), baseline.id)
    const past = [...dom.window.document.querySelectorAll<HTMLButtonElement>("nav button")].find((item) =>
      item.textContent!.endsWith("S3"),
    )!
    await act(async () => past.click())
    await waitFor(() => requests.some((url) => url.searchParams.get("patchVariantId") === "s3"))
    assert.equal(requests.at(-1)!.searchParams.get("anchorRevisionId"), baseline.id)
    await act(async () => {
      select.value = "auto"
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await waitFor(() => dom.window.document.body.textContent!.includes("8 seconds from old anchor"))
    assert.equal(requests.at(-1)!.searchParams.has("anchorRevisionId"), false)
  } finally {
    await act(async () => root.unmount())
    client.clear()
    logout()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
    loader.deregister()
  }
})
