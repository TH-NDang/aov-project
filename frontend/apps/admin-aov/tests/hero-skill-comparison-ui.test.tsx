import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture, fixturePreviousRevision } from "./fixtures/hero-workspace-data"
import type { HeroComparison } from "../src/features/publishing/api/publishing-api"
import type { Revision, Skill } from "../src/features/publishing/api/types"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"

test("history deduplicates real patch skill facts and uses gameplay categories only for their exact revision pair", async () => {
  const dom = createWindow("http://localhost/publishing/fixture-hero")
  const fixture = createHeroFixture()
  const previous: Revision = { ...fixturePreviousRevision, id: "fixture-before-patch" }
  const unrelated: Revision = { ...previous, id: "fixture-unrelated", revisionNo: 2 }
  const current: Revision = {
    ...previous,
    id: "fixture-game-patch",
    revisionNo: 3,
    cause: "GAME_PATCH",
    sourceRevisionId: previous.id,
    effectiveFromPatchVariantId: "fixture-patch",
    publishedAt: "2026-10-15T00:00:00Z",
  }
  const makeSkill = (cooldown: number): Skill => ({
    skillKey: "skill-1-1",
    kind: "ACTIVE",
    displayOrder: 1,
    formKey: null,
    iconAssetId: null,
    translations: [{ locale: "vi-VN", name: "Phi tiêu", description: `Gây sát thương. Hồi chiêu ${cooldown} giây.` }],
    effects: [
      {
        effectType: "SOURCE_SNAPSHOT",
        metadata: {
          cooldown: { display: `Hồi chiêu: ${cooldown} giây` },
          levelTable: {
            column_labels: ["Thông tin công bố"],
            rows: [{ label: "Hồi chiêu (giây)", display_values: [`${cooldown} giây`] }],
          },
          rawAttributes: { hp: cooldown * 100 },
          reviewFlags: [{ note: `Source capture ${cooldown}` }],
          patchCode: `patch-${cooldown}`,
          observedAt: `2026-11-01T02:43:${cooldown}Z`,
          fieldReview: { cooldown: { sourceArchiveSha256: `source-hash-${cooldown}` } },
          contentReview: { file: "content-review.json", reviewId: `review-${cooldown}` },
        },
      },
    ],
  })
  const requests: { path: string; method: string }[] = []
  const sources: string[] = []
  const unexpected: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    requests.push({ path, method: init?.method ?? "GET" })
    if (path === `/admin/heroes/${current.heroId}/revisions/${current.id}/comparison`) {
      const fromId = url.searchParams.get("fromRevisionId") ?? previous.id
      sources.push(fromId)
      assert.ok([previous.id, unrelated.id].includes(fromId))
      const before = makeSkill(fromId === previous.id ? 8 : 16)
      const after = makeSkill(12)
      const unchangedBefore = makeSkill(5)
      unchangedBefore.skillKey = "skill-0-1"
      unchangedBefore.effects[0].metadata.tags = ["<color=#AA0000>Vật lý</color>", "Tăng ST"]
      const unchangedAfter = structuredClone(unchangedBefore)
      unchangedAfter.effects[0].metadata.tags = ["Tăng ST", "<color=#BB0000>Vật lý</color>"]
      unchangedAfter.translations[0].description = `<b>${unchangedBefore.translations[0].description}</b>`
      const comparison: HeroComparison = {
        status: "AVAILABLE",
        from: fromId === previous.id ? previous : unrelated,
        to: current,
        before: { skills: { skills: [before, unchangedBefore] } },
        after: { skills: { skills: [after, unchangedAfter] } },
        changes: [
          {
            section: "skills",
            path: "/skills/skill-1-1/effects/SOURCE_SNAPSHOT/metadata/cooldown/display",
            kind: "CHANGED",
            before: before.effects[0].metadata.cooldown,
            after: after.effects[0].metadata.cooldown,
          },
          {
            section: "skills",
            path: "/skills/skill-1-1/effects/SOURCE_SNAPSHOT/metadata/levelTable/rows",
            kind: "CHANGED",
            before: before.effects[0].metadata.levelTable,
            after: after.effects[0].metadata.levelTable,
          },
          {
            section: "skills",
            path: "/skills/skill-1-1/translations/vi-VN/description",
            kind: "CHANGED",
            before: before.translations[0].description,
            after: after.translations[0].description,
          },
        ],
        warnings: [],
      }
      return Response.json(comparison)
    }
    if (path === "/admin/patch-variants/fixture-patch/hero-changes")
      return Response.json([
        {
          heroId: current.heroId,
          fromHeroRevisionId: previous.id,
          toHeroRevisionId: current.id,
          changes: [
            {
              type: "HERO_SKILL_CHANGE",
              skillKey: "skill-1-1",
              fieldKey: "skill_1.cooldownSeconds",
              changeKind: "NERF",
              oldValue: "8 giây",
              newValue: "12 giây",
            },
          ],
        },
      ])
    try {
      return await fixture.fetcher(input, init)
    } catch (failure) {
      unexpected.push(path)
      throw failure
    }
  }
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window, {
    fetch: fetcher,
  })
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { HeroRevisionHistory } = await import("../src/features/publishing/components/hero-revision-history")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document

  const card = () => document.querySelector<HTMLElement>('article[data-skill-key="skill-1-1"]')!
  try {
    await verifySession()
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={client}>
            <HeroRevisionHistory
              heroId={current.heroId}
              revision={current}
              revisions={[current, previous, unrelated]}
              locale="vi-VN"
              content={fixture.content}
              onOpenRevision={() => {}}
            />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => card()?.querySelectorAll('[data-change-kind="NERF"]').length === 2)
    assert.equal(document.querySelectorAll("article").length, 1)
    assert.equal(card().querySelector("h4")?.textContent, "Phi tiêu")
    assert.equal(card().querySelectorAll("tbody tr").length, 1)
    assert.match(card().querySelector("tbody th")!.textContent!, /Hồi chiêu/)
    assert.deepEqual(
      [...card().querySelectorAll("tbody td")].map((cell) => cell.textContent),
      ["8 giây", "12 giây"],
    )
    assert.equal(card().querySelector("details")?.open, true)
    assert.ok(card().querySelector('[role="img"][aria-label="Chiêu 1 · Chưa có ảnh kỹ năng"]'))
    assert.equal(card().querySelector("img"), null)
    assert.doesNotMatch(
      card().textContent!,
      /rawAttributes|reviewFlags|Source capture|patchCode|observedAt|fieldReview|source-hash/,
    )
    assert.equal(
      requests.some((request) => request.path.endsWith("/data/heroes.json")),
      false,
    )

    await act(async () => card().querySelector("summary")!.click())
    assert.equal(card().querySelector("details")?.open, false)
    await act(async () => {
      card().querySelector("summary")!.click()
      const split = [...document.querySelectorAll("button")].find((button) => button.textContent === "Hai cột")!
      split.click()
    })
    const beforeDescription = () => card().querySelector('[data-description-side="before"]')!
    const afterDescription = () => card().querySelector('[data-description-side="after"]')!
    assert.equal(card().querySelector("details")?.open, true)
    assert.equal(beforeDescription().textContent, "Gây sát thương. Hồi chiêu 8 giây.")
    assert.equal(afterDescription().textContent, "Gây sát thương. Hồi chiêu 12 giây.")
    assert.equal(beforeDescription().querySelector("del")?.textContent, "8")
    assert.equal(beforeDescription().querySelector("ins"), null)
    assert.equal(afterDescription().querySelector("ins")?.textContent, "12")
    assert.equal(afterDescription().querySelector("del"), null)

    const select = document.querySelector<HTMLSelectElement>('select[aria-label="Bản đối chiếu"]')!
    await act(async () => {
      select.value = unrelated.id
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await waitFor(
      () =>
        sources.at(-1) === unrelated.id &&
        card()?.querySelectorAll("tbody td")[0]?.textContent?.includes("16 giây") === true,
    )
    assert.equal(document.querySelectorAll("article").length, 1)
    assert.equal(card().querySelectorAll("tbody tr").length, 1)
    assert.equal(card().querySelectorAll("[data-change-kind]").length, 0)
    assert.match(card().querySelectorAll("tbody td")[1].textContent!, /12 giây/)
    assert.equal(card().querySelector("details")?.open, true)
    assert.equal(beforeDescription().textContent, "Gây sát thương. Hồi chiêu 16 giây.")
    assert.equal(beforeDescription().querySelector("del")?.textContent, "16")
    assert.equal(afterDescription().textContent, "Gây sát thương. Hồi chiêu 12 giây.")
    assert.equal(afterDescription().querySelector("ins")?.textContent, "12")
    assert.doesNotMatch(
      card().textContent!,
      /rawAttributes|reviewFlags|Source capture|patchCode|observedAt|fieldReview|source-hash/,
    )
    assert.deepEqual(sources, [previous.id, unrelated.id])
    assert.deepEqual(unexpected, [])
    assert.deepEqual(
      requests.filter((request) => request.method !== "GET" && !request.path.startsWith("/auth/")),
      [],
    )
    assert.equal(fixture.writes.length, 0)
  } finally {
    await act(async () => root.unmount())
    await logout()
    client.clear()
    dom.window.close()
    restoreGlobals()
  }
})
