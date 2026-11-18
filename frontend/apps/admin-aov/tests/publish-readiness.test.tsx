import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import type { JSDOM } from "jsdom"
import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, useLocation } from "react-router"
import {
  filterReadinessRows,
  readinessFilter,
  readinessRows,
  readinessSummary,
  type HeroPublishReadiness,
} from "../src/features/publishing/model/publish-readiness"
import {
  closeHeroLocation,
  heroFixLocation,
  heroSourceLocation,
  readHeroLocation,
} from "../src/features/publishing/model/hero-location"
import type { Revision } from "../src/features/publishing/api/types"
import { createHeroFixture, fixtureRevision } from "./fixtures/hero-workspace-data"
import { intersectionHarness } from "./fixtures/intersection-observer"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"

const standard = "standard"
const revision = (
  heroId: string,
  id: string,
  state: Revision["state"],
  revisionNo = 1,
  ruleset = standard,
): Revision => ({
  id,
  heroId,
  rulesetId: ruleset,
  revisionNo,
  state,
  version: 1,
  cause: "DATA_BASELINE",
  sections: {} as Revision["sections"],
  publicationSequence: null,
  publishedAt: null,
  sourceRevisionId: null,
  effectiveFromPatchVariantId: "patch-published",
})
const completeDraft = (revisionId: string): HeroPublishReadiness["drafts"][number] => ({
  revisionId,
  observedStats: true,
  skinsSaved: true,
  profile: { translations: [{ locale: "vi-VN", name: "Tướng" }], roles: ["MAGE"] },
  overviewRatings: { scaleCode: "GAME_OVERVIEW_10", survivability: 5, attackDamage: 5, skillEffects: 5, difficulty: 5 },
  combatStats: { values: [] },
  skills: { skills: [{ skillKey: "a", translations: [{ locale: "vi-VN", name: "A", description: "Mô tả" }] }] },
  mediaBindings: { bindings: { HEAD: "h", PORTRAIT: "p", SPLASH: "s" } },
})
const hero = (code: string, name: string, patch: Partial<HeroPublishReadiness> = {}): HeroPublishReadiness => ({
  id: code,
  code,
  names: [{ locale: "vi-VN", name }],
  headUrl: null,
  revisions: [],
  drafts: [],
  holderId: null,
  formKey: null,
  formIds: [],
  ...patch,
})

/** One of each state an editor has to tell apart. */
const heroes: HeroPublishReadiness[] = [
  hero("airi", "Airi", { revisions: [revision("airi", "airi-1", "DRAFT")], drafts: [completeDraft("airi-1")] }),
  hero("butterfly", "Bướm Đêm", {
    revisions: [revision("butterfly", "butterfly-2", "DRAFT", 2), revision("butterfly", "butterfly-1", "PUBLISHED")],
    drafts: [completeDraft("butterfly-2")],
  }),
  hero("capheny", "Capheny", {
    revisions: [revision("capheny", "capheny-1", "DRAFT")],
    drafts: [{ ...completeDraft("capheny-1"), mediaBindings: { bindings: { HEAD: "h" } }, skills: { skills: [] } }],
  }),
  hero("dirak", "Dirak", {
    revisions: [{ ...revision("dirak", "dirak-1", "DRAFT"), effectiveFromPatchVariantId: "patch-draft" }],
    drafts: [completeDraft("dirak-1")],
  }),
  hero("eland", "Eland", {
    names: [],
    revisions: [revision("eland", "eland-2", "PUBLISHED", 2), revision("eland", "eland-1", "PUBLISHED")],
  }),
  hero("fennik", "Fennik", { names: [] }),
]
const overview = {
  variants: [
    {
      id: "patch-published",
      patchId: "1",
      patchCode: "2026-10-30",
      rulesetId: standard,
      rulesetOrdinal: 1,
      seasonId: "season",
      status: "PUBLISHED",
    },
    {
      id: "patch-draft",
      patchId: "2",
      patchCode: "2026-11-15",
      rulesetId: standard,
      rulesetOrdinal: 2,
      seasonId: "season",
      status: "DRAFT",
    },
  ],
} as Parameters<typeof readinessRows>[1]
const rows = readinessRows(heroes, overview, "vi-VN")
const byCode = (code: string) => rows.find((row) => row.code === code)!
const codes = (filter: Parameters<typeof filterReadinessRows>[1]) =>
  filterReadinessRows(rows, filter).map((row) => row.code)

test("each hero reads as published or not, with its draft judged by the shared rules", () => {
  assert.deepEqual(
    rows.map((row) => [row.code, row.status, !!row.published, !!row.draft]),
    [
      ["airi", "READY", false, true],
      ["butterfly", "READY", true, true],
      ["capheny", "BLOCKED", false, true],
      ["dirak", "BLOCKED", false, true],
      ["eland", "NO_DRAFT", true, false],
      ["fennik", "NO_DRAFT", false, false],
    ],
  )
  assert.deepEqual(
    byCode("capheny").blockers.map(({ key }) => key),
    ["SKILLS", "MEDIA_BINDINGS"],
  )
  assert.equal(byCode("eland").published?.id, "eland-2", "the newest published revision is the one shown")
  assert.equal(byCode("eland").name, "eland", "a hero without a profile falls back to its code")
  assert.equal(byCode("eland").publishedPatch?.patchCode, "2026-10-30")
})

test("a draft waiting for its patch links to where the patch can be published", () => {
  assert.deepEqual(
    byCode("dirak").blockers.map(({ key }) => key),
    ["PATCH"],
  )
  assert.deepEqual(byCode("dirak").patchLink, {
    to: "/game-configuration?season=season&patch=patch-draft",
    code: "2026-11-15",
  })
  assert.equal(byCode("airi").patchLink, undefined)
})

test("a hero with data in two rulesets gets a row for each", () => {
  const [first, second] = readinessRows(
    [
      hero("airi", "Airi", {
        revisions: [revision("airi", "a-draft", "DRAFT"), revision("airi", "b-live", "PUBLISHED", 1, "alternate")],
        drafts: [completeDraft("a-draft")],
      }),
    ],
    overview,
    "vi-VN",
  )
  assert.deepEqual([first.rulesetId, first.status, !!first.published], [standard, "READY", false])
  assert.deepEqual([second.rulesetId, second.status, !!second.published], ["alternate", "NO_DRAFT", true])
  assert.notEqual(first.rowKey, second.rowKey)
})

test("the filters narrow together and search ignores accents", () => {
  const all = { q: "", unpublished: false, draft: "" as const, captures: false }
  assert.deepEqual(codes(all), ["airi", "butterfly", "capheny", "dirak", "eland", "fennik"])
  assert.deepEqual(codes({ ...all, unpublished: true }), ["airi", "capheny", "dirak", "fennik"])
  assert.deepEqual(codes({ ...all, draft: "ready" }), ["airi", "butterfly"])
  assert.deepEqual(codes({ ...all, draft: "blocked" }), ["capheny", "dirak"])
  assert.deepEqual(codes({ ...all, unpublished: true, draft: "ready" }), ["airi"])
  assert.deepEqual(codes({ ...all, q: "buom dem" }), ["butterfly"])
  assert.deepEqual(codes({ ...all, q: " CAPH " }), ["capheny"])
  assert.deepEqual(codes({ ...all, q: "buom", unpublished: true }), [])
})

test("filters are read from the address and nothing else counts as a filter", () => {
  assert.deepEqual(readinessFilter(new URLSearchParams("published=false&draft=ready&q=air")), {
    q: "air",
    unpublished: true,
    draft: "ready",
    captures: false,
  })
  assert.deepEqual(readinessFilter(new URLSearchParams("published=true&draft=everything")), {
    q: "",
    unpublished: false,
    draft: "",
    captures: false,
  })
  assert.equal(readinessFilter(new URLSearchParams("captures=missing")).captures, true)
})

test("the summary counts each state and ranks the most common blockers first", () => {
  const summary = readinessSummary([
    ...rows,
    ...readinessRows(
      [
        hero("gildur", "Gildur", {
          revisions: [revision("gildur", "gildur-1", "DRAFT")],
          drafts: [{ ...completeDraft("gildur-1"), mediaBindings: null }],
        }),
      ],
      overview,
      "vi-VN",
    ),
  ])
  assert.deepEqual(
    [summary.total, summary.unpublished, summary.ready, summary.readyUnpublished, summary.blocked, summary.noDraft],
    [7, 5, 2, 1, 3, 2],
  )
  assert.equal(summary.blockers[0].key, "MEDIA_BINDINGS")
  assert.equal(summary.blockers[0].count, 2)
  assert.deepEqual(
    summary.blockers.map(({ count }) => count),
    [2, 1, 1],
  )
})

test("a blocker opens its hero on the matching tab and section, and closing clears all of it", () => {
  const current = new URLSearchParams("published=false&draft=blocked")
  for (const [key, tab] of [
    ["PROFILE", "overview"],
    ["OVERVIEW_RATINGS", "overview"],
    ["COMBAT_STATS", "overview"],
    ["SKILLS", "skills"],
    ["SKINS", "skins"],
    ["MEDIA_BINDINGS", "media"],
  ] as const) {
    const next = heroFixLocation(current, "hero-id", "draft-id", key)
    const location = readHeroLocation(next)
    assert.equal(next.get("hero"), "hero-id")
    assert.equal(next.get("revision"), "draft-id")
    assert.equal(next.get("fix"), key)
    assert.equal(location.tab, tab, key)
    assert.equal(location.section, key)
    assert.equal(location.view, "overview")
    assert.equal(closeHeroLocation(next).toString(), current.toString(), "the list's own filters survive")
  }
  const patch = heroFixLocation(current, "hero-id", "draft-id", "PATCH")
  assert.equal(patch.get("fix"), "PATCH")
  assert.equal(patch.get("section"), null)
})

test("a missing source image opens its hero where that data is shown", () => {
  const current = new URLSearchParams("captures=missing")
  const skill = heroSourceLocation(current, "hero-id", "draft-id", { area: "SKILL", skillKey: "skill-0-1" })
  assert.deepEqual([skill.get("tab"), skill.get("skill"), skill.get("revision")], ["skills", "skill-0-1", "draft-id"])
  const stats = heroSourceLocation(current, "hero-id", undefined, { area: "STATS" })
  assert.deepEqual([stats.get("tab"), stats.get("skill"), stats.get("revision")], ["overview", null, null])
  assert.equal(closeHeroLocation(stats).toString(), current.toString())
})

// The session client keeps the first fetch it is loaded with, so every test answers through this one.
let answer: typeof fetch = () => Promise.reject(new Error("No test is running"))
const routedFetch: typeof fetch = (input, init) => answer(input, init)

async function withDocument(
  fetcher: typeof fetch,
  observer: unknown,
  run: (ui: {
    dom: JSDOM
    document: Document
    cache: QueryClient
    show: (element: React.ReactElement, entry: string) => Promise<void>
    waitFor: (condition: () => boolean, message: string) => Promise<void>
    click: (element: HTMLElement) => Promise<void>
    search: () => string
  }) => Promise<void>,
) {
  answer = fetcher
  const dom = createWindow("http://localhost/hero/publish-readiness")
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window, {
    fetch: routedFetch,
    IntersectionObserver: observer,
  })
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const reactRoot = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  let search = ""
  function ShowLocation() {
    search = useLocation().search
    return null
  }
  try {
    await verifySession()
    await run({
      dom,
      document: dom.window.document,
      cache,
      show: (element, entry) =>
        act(async () =>
          reactRoot.render(
            <MemoryRouter initialEntries={[entry]}>
              <QueryClientProvider client={cache}>
                <ShowLocation />
                {element}
              </QueryClientProvider>
            </MemoryRouter>,
          ),
        ),
      waitFor: async (condition, message) => {
        await waitFor(condition, { message, timeout: 5000 })
      },
      click: (element) => act(async () => element.click()),
      search: () => search,
    })
  } finally {
    await act(async () => reactRoot.unmount())
    await logout()
    cache.clear()
    restoreGlobals()
    dom.window.close()
  }
}

test("the overview page loads once, keeps filters in the address, reveals rows on scroll and opens a fix", async () => {
  const intersections = intersectionHarness()
  const many = [
    ...heroes,
    ...Array.from({ length: 40 }, (_, index) => {
      const code = `extra-${index}`
      return hero(code, code, {
        revisions: [revision(code, `${code}-1`, "DRAFT")],
        drafts: [completeDraft(`${code}-1`)],
      })
    }),
  ]
  const requests: string[] = []
  const fetcher: typeof fetch = async (input) => {
    const path = new URL(String(input), "http://localhost").pathname.replace("/api/wiki/v1", "")
    requests.push(path)
    if (path === "/auth/refresh") return Response.json({ accessToken: "readiness-fixture", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "reader",
        type: "HUMAN",
        displayName: "Reader",
        capabilities: ["catalog:read"],
      })
    if (path === "/admin/heroes/publish-readiness") return Response.json(many)
    if (path === "/admin/publication-overview")
      return Response.json({
        asOf: "2026-11-07T00:00:00Z",
        rulesets: [{ id: standard, code: "aov", description: "" }],
        markets: [],
        seasons: [],
        seasonSchedules: [],
        releases: [],
        assignments: [],
        ...overview,
      })
    if (path === "/users/me") return Response.json({ locale: "vi-VN" })
    return Response.json({ code: "NOT_FOUND", detail: "Not in this test" }, { status: 404 })
  }
  await withDocument(fetcher, intersections.Observer, async ({ document, show, waitFor, click, search }) => {
    const { PublishReadinessPage } = await import("../src/features/publishing/pages/publish-readiness-page")
    const rendered = () =>
      [...document.querySelectorAll('tbody button[aria-label^="Xem tướng "]')].map((button) =>
        button.getAttribute("aria-label")!.replace("Xem tướng ", ""),
      )
    const toggle = (name: RegExp) =>
      [...document.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].find((button) =>
        name.test(button.textContent ?? ""),
      )!
    await show(<PublishReadinessPage />, "/hero/publish-readiness")
    await waitFor(() => rendered().length > 0, "rows appear once the data is in")

    assert.equal(requests.filter((path) => path === "/admin/heroes/publish-readiness").length, 1)
    assert.ok(!requests.some((path) => /^\/admin\/heroes\/[^/]+\/revisions/.test(path)), "no request per hero")
    assert.equal(rendered().length, 25, "the first rows only, the rest as the reader scrolls")
    assert.match(document.querySelector('section [role="status"]')!.textContent ?? "", /46 \/ 46/)

    await act(async () => intersections.intersect(document.querySelector('[aria-label="Đang hiện thêm tướng…"]')!))
    await waitFor(() => rendered().length === 46, "scrolling reveals the remaining rows")

    await click(toggle(/Chưa xuất bản/))
    assert.match(search(), /published=false/)
    assert.ok(!rendered().includes("butterfly"), "a published hero leaves the not yet published filter")
    assert.ok(!rendered().includes("eland"))

    await click(toggle(/Sẵn sàng xuất bản/))
    assert.match(search(), /draft=ready/)
    assert.ok(rendered().includes("airi"))
    assert.ok(!rendered().includes("capheny"), "a blocked draft leaves the ready filter")

    await click(toggle(/Còn thiếu/))
    assert.match(search(), /draft=blocked/)
    assert.doesNotMatch(search(), /draft=ready/)
    assert.deepEqual(rendered(), ["capheny", "dirak"])
    assert.match(document.body.textContent ?? "", /Thiếu nhiều nhất/)

    const patch = document.querySelector<HTMLAnchorElement>('tbody a[href*="game-configuration"]')!
    assert.match(patch.textContent ?? "", /2026-11-15/)
    assert.equal(patch.getAttribute("href"), "/game-configuration?season=season&patch=patch-draft")

    await click(
      [...document.querySelectorAll<HTMLButtonElement>("tbody li button")].find((button) =>
        /Head, Portrait/.test(button.textContent ?? ""),
      )!,
    )
    for (const part of [
      "hero=capheny",
      "revision=capheny-1",
      "tab=media",
      "section=MEDIA_BINDINGS",
      "fix=MEDIA_BINDINGS",
    ])
      assert.ok(search().includes(part), part)
    assert.match(search(), /draft=blocked/, "the list's filters stay for coming back")
  })
})

for (const canWrite of [true, false])
  test(`the workspace lands on the section a blocker points at, ${canWrite ? "open to edit" : "read only"}`, async () => {
    const fixture = createHeroFixture()
    const fetcher: typeof fetch = async (input, init) => {
      const path = new URL(String(input), "http://localhost").pathname.replace("/api/wiki/v1", "")
      if (path === "/admin/me")
        return Response.json({
          issuer: "fixture",
          subject: "editor",
          type: "HUMAN",
          displayName: "Editor",
          capabilities: canWrite ? ["catalog:read", "hero:write", "hero:publish"] : ["catalog:read"],
        })
      return fixture.fetcher(input, init)
    }
    await withDocument(fetcher, intersectionHarness().Observer, async ({ document, show, waitFor, search }) => {
      const { PublishingWorkspace } = await import("../src/features/publishing/pages/publishing-page")
      const editor = () => document.querySelector('[role="region"][aria-label="Chỉnh sửa nội dung"]')
      await show(
        <PublishingWorkspace heroId="fixture-hero" onUnsavedChange={() => undefined} />,
        `/hero/fixture-hero?revision=${fixtureRevision.id}&view=overview&section=OVERVIEW_RATINGS&fix=OVERVIEW_RATINGS`,
      )
      await waitFor(
        () => !search().includes("fix="),
        `the workspace reads the fix once and drops it: ${search()} ${document.body.textContent?.slice(0, 300)}`,
      )
      assert.match(search(), /section=OVERVIEW_RATINGS/)
      if (canWrite) {
        await waitFor(() => !!editor(), "the editor opens")
        // The editor takes the place of the overview it changes, whose heading names the part being edited.
        const overview = document.getElementById("hero-content-overview")!
        assert.ok(overview.contains(editor()))
        assert.match(overview.textContent ?? "", /Đang sửa · Đánh giá/)
      } else {
        await waitFor(() => document.activeElement?.id === "hero-OVERVIEW_RATINGS", "the section takes the focus")
        assert.equal(editor(), null)
      }
    })
  })

test("source images still to capture show per hero, rank the list, open the skill and follow new captures", async () => {
  const { SOURCE_COVERAGE_REFRESH_MS } = await import("../src/features/publishing/api/use-source-coverage")
  const { publishingKeys } = await import("../src/features/publishing/api/publishing-api")
  const statsMissing = (code: string) =>
    hero(code, code[0]!.toUpperCase() + code.slice(1), {
      revisions: [revision(code, `${code}-1`, "DRAFT")],
      drafts: [{ ...completeDraft(`${code}-1`), observedStats: false }],
    })
  const passiveMissing = hero("liliana", "Liliana", {
    revisions: [revision("liliana", "liliana-1", "DRAFT")],
    drafts: [completeDraft("liliana-1")],
  })
  const complete = hero("airi", "Airi", {
    revisions: [revision("airi", "airi-1", "DRAFT")],
    drafts: [completeDraft("airi-1")],
  })
  const blank = { health: null, physicalAttack: null, physicalDefense: null, movementSpeed: null, attackRange: null }
  // Every number on the attributes screen, as the reviewer reads it off a full capture.
  const shown = {
    health: 3400,
    physicalAttack: 165,
    magicAttack: 0,
    physicalDefense: 140,
    magicDefense: 80,
    maxResource: 440,
    movementSpeed: 380,
    attackRange: "Đánh gần",
    physicalPierce: 0,
    magicPierce: 0,
    bonusAttackSpeedPercent: 0,
    criticalChancePercent: 0,
    criticalDamagePercent: 200,
    physicalLifestealPercent: 0,
    magicLifestealPercent: 0,
    cooldownReductionPercent: 0,
  }
  // The draft fixtures carry one skill keyed "a".
  const skillA = { skillKey: "a", name: "A", shown: ["a.png"], withheld: [], cut: false, table: true, request: null }
  let bijanValues: Record<string, unknown> = blank
  const coverage = () => ({
    patchCode: "2026-10-30",
    heroes: [
      {
        heroCode: "airi",
        overview: ["o.png"],
        attributes: [{ fileName: "a.png", values: shown }],
        skills: [skillA],
      },
      {
        heroCode: "bijan",
        overview: ["o.png"],
        attributes: [{ fileName: "1932-hero-102-attributes.png", values: bijanValues }],
        skills: [skillA],
      },
      {
        heroCode: "liliana",
        overview: ["o.png"],
        attributes: [{ fileName: "a.png", values: shown }],
        skills: [
          skillA,
          {
            skillKey: "skill-0-1",
            name: null,
            shown: [],
            withheld: ["1747-01-hero-092-passive-detail.png"],
            cut: false,
            table: null,
            request: "Mở biểu tượng nội tại, chọn Chi tiết.",
          },
        ],
      },
    ],
  })
  // The published set as publish-captures leaves it in the private bucket; only its coverage matters here.
  const heroSet = () => ({
    kind: "HERO_CAPTURE",
    patchCode: "2026-10-30",
    archive: "outer.zip",
    coverage: {},
    sources: coverage().heroes,
    heroes: {},
  })
  const captureRequests: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    if (path === "/admin/source-collections")
      return Response.json({
        items: [{ id: "hero-set", code: "hero-capture-2026-10-30", category: "HERO_CAPTURE", label: "Ảnh tướng" }],
        page: 0,
        size: 100,
        totalElements: 1,
      })
    if (path === "/admin/source-collections/hero-set/links" && init?.method === "POST") {
      // The link names the manifest's bytes, so the page downloads it again only once a review changed it.
      const sha256 = createHash("sha256").update(JSON.stringify(heroSet())).digest("hex")
      const item = { path: "capture-manifest.json", sha256, url: "https://r2.test/hero-set/capture-manifest.json" }
      return Response.json({ items: [item], missing: [] })
    }
    if (url.host === "r2.test") {
      captureRequests.push(path)
      return Response.json(heroSet())
    }
    if (path === "/auth/refresh") return Response.json({ accessToken: "readiness-fixture", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "reader",
        type: "HUMAN",
        displayName: "Reader",
        capabilities: ["catalog:read"],
      })
    if (path === "/admin/heroes/publish-readiness")
      return Response.json([complete, statsMissing("bijan"), passiveMissing])
    if (path === "/admin/publication-overview")
      return Response.json({
        asOf: "2026-11-07T00:00:00Z",
        rulesets: [{ id: standard, code: "aov", description: "" }],
        markets: [],
        seasons: [],
        seasonSchedules: [],
        releases: [],
        assignments: [],
        ...overview,
      })
    if (path === "/users/me") return Response.json({ locale: "vi-VN" })
    return Response.json({ code: "NOT_FOUND", detail: "Not in this test" }, { status: 404 })
  }
  await withDocument(
    fetcher,
    intersectionHarness().Observer,
    async ({ document, cache, show, waitFor, click, search }) => {
      const { PublishReadinessPage } = await import("../src/features/publishing/pages/publish-readiness-page")
      const rendered = () =>
        [...document.querySelectorAll('tbody button[aria-label^="Xem tướng "]')].map((button) =>
          button.getAttribute("aria-label")!.replace("Xem tướng ", ""),
        )
      const toggle = () =>
        [...document.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].find((button) =>
          /Cần chụp ảnh gốc/.test(button.textContent ?? ""),
        )
      const rowText = (code: string) =>
        document.querySelector(`tbody button[aria-label="Xem tướng ${code}"]`)!.closest("tr")!.textContent ?? ""

      await show(<PublishReadinessPage />, "/hero/publish-readiness")
      await waitFor(() => !!toggle(), "the captures filter appears once the capture sets are read")
      // The filter shows before every hero's capture set is read, so its count starts at 0 and settles afterwards.
      await waitFor(() => /2/.test(toggle()?.textContent ?? ""), "the captures filter counts both heroes to capture")
      assert.match(document.querySelector("thead")!.textContent ?? "", /Ảnh gốc cần chụp/)
      assert.match(document.body.textContent ?? "", /Đối chiếu với bộ ảnh patch 2026-10-30/)
      assert.match(rowText("airi"), /Đủ ảnh để đối chiếu/)
      assert.match(rowText("bijan"), /Gỡ chặn xuất bản/)
      assert.match(rowText("bijan"), /Chi tiết \(góc dưới trái\) → Thuộc tính/)
      assert.match(rowText("liliana"), /Bản nháp chưa có kỹ năng này/)

      await click(toggle()!)
      assert.match(search(), /captures=missing/)
      assert.deepEqual(rendered(), ["bijan", "liliana"], "the capture that unblocks publishing comes first")

      const passive = [...document.querySelectorAll<HTMLButtonElement>("tbody li button")].find((button) =>
        /Nội tại/.test(button.textContent ?? ""),
      )!
      assert.match(passive.textContent ?? "", /Mở biểu tượng nội tại, chọn Chi tiết\./)
      await click(passive)
      for (const part of ["hero=liliana", "revision=liliana-1", "tab=skills", "skill=skill-0-1", "captures=missing"])
        assert.ok(search().includes(part), part)

      // The sets are read again on a timer; here the reviewer has just recorded Bijan's new attributes image.
      const queries = cache.getQueryCache().findAll({ queryKey: publishingKeys.sourceCoverage })
      assert.ok(queries.length >= 2)
      for (const query of queries)
        assert.equal((query.options as { refetchInterval?: number }).refetchInterval, SOURCE_COVERAGE_REFRESH_MS)
      bijanValues = shown
      const before = captureRequests.length
      await act(async () => {
        await cache.refetchQueries({ queryKey: publishingKeys.sourceCoverage })
      })
      assert.ok(captureRequests.length > before)
      await waitFor(() => !rendered().includes("bijan"), "a hero whose capture arrived leaves the list")
      assert.deepEqual(rendered(), ["liliana"])
    },
  )
})
