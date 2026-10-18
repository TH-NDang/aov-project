import type { HeroGameplayChange, HeroRow, PageSlice, Revision } from "../../src/features/publishing/types"
import type { PublicationOverview } from "../../src/features/publishing/publication-overview"
import { fixtureContent } from "./hero-workspace-data"

export const catalogOverview: PublicationOverview = {
  asOf: "1999-01-01T00:00:00Z",
  rulesets: [
    { id: "standard", code: "aov-standard", description: "Shared gameplay" },
    { id: "alternate", code: "alternate", description: "Alternate gameplay" },
  ],
  markets: [],
  assignments: [],
  seasonSchedules: [],
  seasons: [
    {
      id: "season-old",
      rulesetId: "standard",
      code: "s3",
      displayName: "S3",
      phase: "PAST",
      startsAt: null,
      endsAt: null,
    },
    {
      id: "season-new",
      rulesetId: "standard",
      code: "s4",
      displayName: "S4",
      phase: "CURRENT",
      startsAt: null,
      endsAt: null,
    },
  ],
  variants: [
    {
      id: "patch-old",
      patchId: "patch-1",
      patchCode: "old-season-patch",
      rulesetId: "standard",
      rulesetOrdinal: 1,
      seasonId: "season-old",
      status: "PUBLISHED",
    },
    {
      id: "patch-early",
      patchId: "patch-2",
      patchCode: "early-season-patch",
      rulesetId: "standard",
      rulesetOrdinal: 2,
      seasonId: "season-new",
      status: "PUBLISHED",
    },
    {
      id: "patch-current",
      patchId: "patch-3",
      patchCode: "current-patch",
      rulesetId: "standard",
      rulesetOrdinal: 3,
      seasonId: "season-new",
      status: "PUBLISHED",
    },
    {
      id: "patch-future",
      patchId: "patch-4",
      patchCode: "unconfirmed-future-patch",
      rulesetId: "standard",
      rulesetOrdinal: 4,
      seasonId: "season-new",
      status: "DRAFT",
    },
  ],
  releases: [],
}

type FixtureHero = HeroRow & { displayName: string }
export interface CatalogRequest {
  page: number
  size: number
  q: string
  seasonId: string
  patchVariantId: string
  rulesetId: string
  locale: string
  sort: string
}

function revision(heroId: string, patch: string, revisionNo = 1, rulesetId = "standard"): Revision {
  return {
    id: `${heroId}-revision-${revisionNo}`,
    heroId,
    rulesetId,
    revisionNo,
    state: "PUBLISHED",
    version: 1,
    cause: "DATA_BASELINE",
    sections: {} as Revision["sections"],
    publishedAt: "2099-05-06T07:08:09Z",
    sourceRevisionId: null,
    effectiveFromPatchVariantId: patch,
  }
}

function change(heroId: string, patch: string, toRevision: string): HeroGameplayChange {
  return {
    id: `${heroId}-change-${patch}`,
    rulesetId: "standard",
    seasonId: patch === "patch-old" ? "season-old" : "season-new",
    patchVariantId: patch,
    fromHeroRevisionId: null,
    toHeroRevisionId: toRevision,
    changeKinds: patch === "patch-current" ? ["BUFF", "NERF"] : ["BUFF"],
    recordedAt: "2026-10-15T10:00:00Z",
    summary: `Curated ${patch} adjustment`,
    actualLocale: "vi-VN",
  }
}

export function createHeroCatalogFixture() {
  const make = (code: string, displayName: string, edited: string | null = null): FixtureHero => ({
    id: `id-${code}`,
    code,
    displayName,
    revisions: [revision(`id-${code}`, "patch-early")],
    lastEditedAt: edited,
    gameplayChanges: [],
  })
  const baseline = make("aa-baseline-only", "Baseline only")
  const old = make("ab-old-change", "Old season adjustment", "2026-10-10T01:02:03Z")
  old.revisions = [revision(old.id, "patch-old")]
  old.gameplayChanges = [change(old.id, "patch-old", old.revisions[0].id)]
  const early = make("ac-early-change", "Earlier adjustment", "2026-10-11T01:02:03Z")
  early.gameplayChanges = [change(early.id, "patch-early", early.revisions[0].id)]
  const current = make("ad-current-change", "Current adjustment", "2026-10-15T01:02:03Z")
  current.revisions = [
    revision(current.id, "patch-old"),
    revision(current.id, "patch-early", 2),
    revision(current.id, "patch-current", 3),
    { ...revision(current.id, "patch-future", 4), state: "DRAFT", cause: "GAME_PATCH" },
  ]
  current.gameplayChanges = [
    change(current.id, "patch-early", current.revisions[1].id),
    change(current.id, "patch-current", current.revisions[2].id),
  ]
  const alternate = make("ae-alternate", "Alternate ruleset")
  alternate.revisions = [revision(alternate.id, "patch-early", 1, "alternate")]
  const noEdit = make("af-no-edit", "Unknown editing history")
  const slow = make("zy-delayed", "Slow response hero")
  const far = make("zz-search-target", "Voyage match beyond initial page")
  const heroes = [
    baseline,
    old,
    early,
    current,
    alternate,
    noEdit,
    ...Array.from({ length: 20 }, (_, index) => make(`filler-${String(index).padStart(2, "0")}`, `Filler ${index}`)),
    slow,
    far,
  ]
  const requests: CatalogRequest[] = []
  const holds = new Map<string, { promise: Promise<void>; resolve: () => void }>()
  const read = (params: URLSearchParams): CatalogRequest => ({
    page: Number(params.get("page") ?? 0),
    size: Number(params.get("size") ?? 20),
    q: params.get("q") ?? "",
    seasonId: params.get("seasonId") ?? "",
    patchVariantId: params.get("patchVariantId") ?? "",
    rulesetId: params.get("rulesetId") ?? "",
    locale: params.get("locale") ?? "vi-VN",
    sort: params.get("sort") ?? "code",
  })
  const response = (query: CatalogRequest): PageSlice<HeroRow> => {
    let found = heroes
      .filter((hero) => !query.rulesetId || hero.revisions.some((value) => value.rulesetId === query.rulesetId))
      .map((hero) => {
        let gameplayChanges = (hero.gameplayChanges ?? []).filter(
          (value) =>
            (!query.rulesetId || value.rulesetId === query.rulesetId) &&
            (!query.seasonId || value.seasonId === query.seasonId) &&
            (!query.patchVariantId || value.patchVariantId === query.patchVariantId),
        )
        if (!query.seasonId && !query.patchVariantId) gameplayChanges = gameplayChanges.slice(-1)
        const { displayName, ...row } = hero
        return { ...row, displayName, gameplayChanges }
      })
    if (query.seasonId || query.patchVariantId) found = found.filter((hero) => hero.gameplayChanges.length > 0)
    if (query.q)
      found = found.filter((hero) => `${hero.code} ${hero.displayName}`.toLowerCase().includes(query.q.toLowerCase()))
    found.sort((left, right) =>
      query.sort === "edited-desc"
        ? (Date.parse(right.lastEditedAt ?? "") || 0) - (Date.parse(left.lastEditedAt ?? "") || 0) ||
          left.code.localeCompare(right.code)
        : left.code.localeCompare(right.code),
    )
    return {
      items: found
        .slice(query.page * query.size, (query.page + 1) * query.size)
        .map(({ displayName, ...hero }) => hero),
      page: query.page,
      size: query.size,
      totalElements: found.length,
    }
  }
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "catalog-fixture", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (init?.method && init.method !== "GET") throw new Error("The catalog fixture only supports read operations")
    if (path === "/users/me")
      return Response.json({
        id: "catalog-profile",
        displayName: "Catalog editor",
        biography: "",
        locale: "vi-VN",
        timeZone: "Asia/Tokyo",
        avatarAssetId: null,
        avatarUrl: null,
        version: 1,
        createdAt: null,
        updatedAt: null,
      })
    if (path === "/admin/publication-overview") return Response.json(catalogOverview)
    if (path === "/admin/rulesets") return Response.json(catalogOverview.rulesets)
    if (path === "/regions") return Response.json([])
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "catalog-editor",
        type: "HUMAN",
        displayName: "Catalog fixture",
        capabilities: ["catalog:read"],
      })
    if (path === "/admin/heroes") {
      const query = read(url.searchParams)
      requests.push(query)
      await holds.get(query.q)?.promise
      return Response.json(response(query))
    }
    const revisions = /^\/admin\/heroes\/([^/]+)\/revisions$/.exec(path)
    if (revisions) return Response.json(heroes.find((hero) => hero.id === revisions[1])?.revisions ?? [])
    const preview = /^\/admin\/heroes\/([^/]+)\/revisions\/([^/]+)$/.exec(path)
    if (preview) {
      const hero = heroes.find((value) => value.id === preview[1])
      const revision = hero?.revisions.find((value) => value.id === preview[2])
      if (!hero || !revision) throw new Error(`Unknown catalog fixture revision: ${path}`)
      const content = structuredClone(fixtureContent)
      content.PROFILE!.translations[0].name = hero.displayName
      return Response.json({ revision, content })
    }
    throw new Error(`Unexpected catalog fixture request: ${path}`)
  }
  return {
    heroes,
    requests,
    fetcher,
    hold(query: string) {
      let resolve!: () => void
      const promise = new Promise<void>((done) => {
        resolve = done
      })
      holds.set(query, { promise, resolve })
      return () => {
        resolve()
        holds.delete(query)
      }
    },
  }
}
