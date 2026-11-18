import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import type { Revision } from "../src/features/publishing/api/types"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"

test("the timeline uses the new published baseline, preserves it across patches and offers automatic selection", async () => {
  // JSDOM verifies interaction and content; stylesheet rendering belongs to browser checks.
  const loader = registerHooks({
    load(url, context, next) {
      return url.endsWith(".css")
        ? { format: "module", source: "export default {}", shortCircuit: true }
        : next(url, context)
    },
  })
  const dom = createWindow("http://localhost/hero/fixture-hero")
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
            {
              id: "passive",
              type: "HERO_SKILL_CHANGE",
              skillKey: "passive",
              fieldKey: "description",
              changeKind: "FIX",
              oldValue: "A",
              newValue: "B",
            },
            { id: "hp", type: "HERO_STAT_CHANGE", statKey: "HP", changeKind: "BUFF", oldValue: 100, newValue: 120 },
            {
              id: "cooldown",
              type: "HERO_SKILL_CHANGE",
              skillKey: "skill-1",
              fieldKey: "cooldown",
              changeKind: "BUFF",
              oldValue: "8",
              newValue: "6",
            },
            {
              id: "alternate",
              type: "HERO_SKILL_CHANGE",
              skillKey: "skill-1-2",
              fieldKey: "range",
              changeKind: "BUFF",
              oldValue: "2",
              newValue: "3",
            },
          ],
        },
      ])
    return fixture.fetcher(input, init)
  }
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window, {
    fetch: fetcher,
  })
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
  const { HeroPatchTimeline } = await import("../src/features/publishing/components/patch-changes/hero-patch-view")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)

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
    // A formula reads as its plain numbers: the recorded change and the data at the patch alike.
    assert.match(dom.window.document.body.textContent!, /Sát thương chuẩn gốc4045Tỷ lệ Công vật lý25%23%/)
    assert.match(dom.window.document.body.textContent!, /Sát thương chuẩn gốc 45 · Tỷ lệ Công vật lý 23%/)
    assert.doesNotMatch(dom.window.document.body.textContent!, /× Công vật lý/)
    assert.doesNotMatch(dom.window.document.body.textContent!, /physicalAttack/)
    const recorded = [...dom.window.document.querySelectorAll("h3")]
      .find((title) => title.textContent?.startsWith("Thay đổi ở"))!
      .closest("section")!
    const groups = [...recorded.querySelectorAll("section[aria-labelledby]")]
    assert.deepEqual(
      groups.map((group) => group.querySelector("h4")?.textContent),
      ["Chiêu 1", "Nội tại · Sắc lẻm", "Chiêu 1 · Biến thể 2"],
    )
    assert.deepEqual(
      groups.map((group) => group.querySelectorAll(":scope > ul > li").length),
      [2, 1, 1],
    )
    assert.doesNotMatch(groups[0].textContent!, /Máu|Nội tại/)
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

    const { PatchChangeEditor } =
      await import("../src/features/publishing/components/patch-changes/patch-change-editor")
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <PatchChangeEditor
            source="PATCH_NOTES"
            heroId={baseline.heroId}
            variantId="oct15"
            locale="vi-VN"
            reference={fixture.content}
            onSaved={() => {}}
          />
        </QueryClientProvider>,
      ),
    )
    await act(async () =>
      dom.window.document.querySelector<HTMLButtonElement>('[aria-label^="Thêm thay đổi · Nội tại"]')!.click(),
    )
    const skillGroup = dom.window.document.querySelector("section[aria-labelledby]")!
    assert.match(skillGroup.querySelector("h4")!.textContent!, /Nội tại · Sắc lẻm/)
    const addField = [...skillGroup.querySelectorAll("button")].find((node) =>
      node.textContent?.includes("Thêm dòng trong nhóm"),
    )!
    await act(async () => addField.click())
    assert.equal(skillGroup.querySelectorAll(":scope > ul > li").length, 2)
    assert.equal(dom.window.document.querySelectorAll("section[aria-labelledby]").length, 1)
    assert.equal(skillGroup.querySelector('select[aria-label$=": kỹ năng"]'), null)
    await act(async () =>
      [...skillGroup.querySelectorAll("button")].find((node) => node.textContent?.includes("Đổi mục"))!.click(),
    )
    assert.equal(skillGroup.querySelector<HTMLSelectElement>('select[aria-label$=": kỹ năng"]')?.value, "passive")
  } finally {
    await act(async () => root.unmount())
    client.clear()
    logout()
    dom.window.close()
    restoreGlobals()
    loader.deregister()
  }
})
