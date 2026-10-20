import { SECTIONS, type Content, type Revision } from "../../src/features/publishing/types"

export const fixtureContent: Content = {
  PROFILE: {
    translations: [
      {
        locale: "vi-VN",
        name: "Airi",
        title: "Ninja rồng",
        summary: "Một chiến binh nhanh nhẹn với lối chơi cơ động.",
        lore: "Câu chuyện nhân vật dùng riêng cho kiểm thử giao diện.",
      },
    ],
    roles: ["ASSASSIN", "WARRIOR"],
    sources: [],
  },
  OVERVIEW_RATINGS: {
    scaleCode: "GAME_OVERVIEW_10",
    survivability: 4,
    attackDamage: 7,
    skillEffects: 6,
    difficulty: 8,
    derived: false,
    sources: [],
  },
  COMBAT_STATS: {
    values: [
      { statKey: "HP", baseValue: 3300, growthPerLevel: 250, unit: "HP" },
      { statKey: "ARMOR", baseValue: 100, growthPerLevel: 15, unit: "" },
    ],
    sources: [],
  },
  SKILLS: {
    skills: [
      {
        skillKey: "passive",
        kind: "PASSIVE",
        formKey: null,
        displayOrder: 0,
        iconAssetId: null,
        translations: [
          { locale: "vi-VN", name: "Sắc lẻm", description: "Nội dung nguồn không được thay đổi khi biên dịch." },
        ],
        effects: [],
      },
    ],
    sources: [],
  },
  SKINS: {
    skins: [
      {
        skinKey: "default",
        displayOrder: 0,
        artAssetId: null,
        rarityCode: null,
        translations: [{ locale: "vi-VN", name: "Mặc định", description: null, acquisitionNote: null }],
      },
    ],
    sources: [],
  },
  MEDIA_BINDINGS: { bindings: {}, sources: [] },
}
export const fixtureRevision: Revision = {
  id: "fixture-draft",
  heroId: "fixture-hero",
  rulesetId: "fixture-rules",
  revisionNo: 1,
  version: 1,
  state: "DRAFT",
  cause: "DATA_BASELINE",
  sections: {} as Revision["sections"],
  publishedAt: null,
  sourceRevisionId: null,
  effectiveFromPatchVariantId: null,
}
export const fixturePreviousRevision: Revision = {
  ...fixtureRevision,
  id: "fixture-previous",
  state: "PUBLISHED",
  effectiveFromPatchVariantId: "fixture-patch-before",
  publishedAt: "2026-09-01T00:00:00Z",
}

export function createHeroFixture(annotations = false, history = false) {
  let content = structuredClone(fixtureContent)
  let revision = { ...fixtureRevision, ...(history ? { revisionNo: 2 } : {}) }
  if (history) {
    content.SKILLS!.skills[0].translations[0].description = "Gây 300 sát thương vật lý."
    content.COMBAT_STATS!.values[0].baseValue = 3500
  }
  const comparisonRequests: { revisionId: string; fromRevisionId: string | null }[] = []
  let storage = annotations
    ? {
        id: "00000000-0000-4000-8000-000000000001",
        name: "AOV rich text settings v1",
        version: 1,
        columns: ["id", "settings"],
        idColumn: "id",
        archived: false,
        rows: [
          {
            id: "settings",
            settings: {
              schemaVersion: 1,
              autoRecognize: true,
              fallbackLocale: "vi-VN",
              entities: [
                {
                  id: "fixture-term",
                  kind: "term",
                  translations: [
                    {
                      locale: "vi-VN",
                      name: "Sát thương chuẩn",
                      aliases: ["ST chuẩn"],
                      description: "Thuật ngữ tổng hợp chỉ dùng trong QA.",
                    },
                  ],
                },
              ],
            },
          },
        ],
      }
    : null
  const writes: { section: string; body: Record<string, unknown> }[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const path = String(input).replace("/api/wiki/v1", "")
    if (/^\/admin\/(items|arcana|enchantments|spells)\?/.test(path))
      return Response.json({ items: [], page: 0, size: 100, totalElements: 0 })
    if (path === "/admin/reference-settings") {
      if (init?.method === "PUT") {
        const next = JSON.parse(String(init.body))
        if (next.expectedVersion !== (storage?.version ?? 1))
          return Response.json({ code: "REFERENCE_VERSION_CONFLICT", detail: "Version conflict" }, { status: 409 })
        if (storage)
          storage = { ...storage, version: storage.version + 1, rows: [{ id: "settings", settings: next.settings }] }
        return Response.json({ version: storage?.version ?? 2, settings: next.settings })
      }
      return Response.json({
        version: storage?.version ?? 1,
        settings: storage?.rows[0]?.settings ?? {
          schemaVersion: 1,
          autoRecognize: true,
          fallbackLocale: "vi-VN",
          entities: [],
        },
      })
    }
    if (path === "/__storage/") return Response.json(storage ? [storage] : [])
    if (storage && path === `/__storage/${storage.id}`) {
      if (init?.method === "PUT") {
        const next = JSON.parse(String(init.body)) as typeof storage
        if (next.version !== storage.version) return Response.json({ message: "Version conflict" }, { status: 409 })
        storage = { ...next, version: next.version + 1 }
      }
      return Response.json(storage)
    }
    if (path.endsWith("/data/trang-bi.json"))
      return Response.json({
        collectedOn: "fixture",
        categories: [],
        items: annotations
          ? [
              {
                id: "fixture-item",
                name: "Kiếm QA",
                image: "",
                summary: "Trang bị tổng hợp cho QA.",
                description: "",
                category: "test",
                tier: 1,
                price: 0,
                shopPositions: [],
                recipe: { status: "none", components: [] },
              },
            ]
          : [],
      })
    if (path.endsWith("/data/trang-bi-can-kiem-tra.json")) return Response.json({ issues: [] })
    if (path === "/auth/refresh") return Response.json({ accessToken: "fixture-only", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        displayName: "UI fixture",
        capabilities: ["catalog:read", "hero:write"],
      })
    if (path === "/users/me") return Response.json({ locale: "vi-VN" })
    if (path === "/admin/rulesets")
      return Response.json([{ id: "fixture-rules", code: "AOV-TEST", description: "Fixture" }])
    if (path === "/regions") return Response.json([])
    if (path === "/admin/publication-overview")
      return Response.json({
        asOf: "2026-10-17T00:00:00Z",
        rulesets: [],
        markets: [],
        seasons: [],
        seasonSchedules: [],
        variants: [],
        releases: [],
        assignments: [],
      })
    if (path.startsWith("/admin/heroes?page="))
      return Response.json({
        items: [
          {
            id: revision.heroId,
            code: "airi",
            revisions: annotations
              ? [revision, { ...revision, id: "fixture-published", state: "PUBLISHED" }]
              : [revision],
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
      })
    const comparisonMatch = path.match(/\/revisions\/(fixture-draft|fixture-previous)\/comparison(?:\?|$)/)
    if (comparisonMatch) {
      const target = comparisonMatch[1] === revision.id ? revision : fixturePreviousRevision
      const fromRevisionId = new URL(path, "http://fixture.local").searchParams.get("fromRevisionId")
      comparisonRequests.push({ revisionId: target.id, fromRevisionId })
      if (fromRevisionId === target.id) throw new Error("A revision cannot be its own comparison source.")
      if (fromRevisionId && (!history || fromRevisionId !== fixturePreviousRevision.id))
        throw new Error(`Unexpected comparison source: ${fromRevisionId}`)
      const before = structuredClone(content)
      before.SKILLS!.skills[0].translations[0].description = "Gây 280 sát thương vật lý."
      before.COMBAT_STATS!.values[0].baseValue = 3300
      return Response.json({
        status: fromRevisionId ? "AVAILABLE" : "BASELINE_ONLY",
        from: fromRevisionId ? fixturePreviousRevision : null,
        to: target,
        before: fromRevisionId ? { skills: before.SKILLS, combatStats: before.COMBAT_STATS } : {},
        after: { skills: content.SKILLS, combatStats: content.COMBAT_STATS },
        changes: fromRevisionId
          ? [
              {
                section: "skills",
                path: "/skills/passive/translations/vi-VN/description",
                kind: "CHANGED",
                before: "Gây 280 sát thương vật lý.",
                after: content.SKILLS!.skills[0].translations[0].description,
              },
              {
                section: "combatStats",
                path: "/values/HP/baseValue",
                kind: "CHANGED",
                before: 3300,
                after: content.COMBAT_STATS!.values[0].baseValue,
              },
            ]
          : [],
        warnings: [],
      })
    }
    if (path.endsWith("/revisions")) return Response.json(history ? [revision, fixturePreviousRevision] : [revision])
    if (path.endsWith("/revisions/fixture-draft")) return Response.json({ revision, content })
    if (annotations && path.endsWith("/revisions/fixture-published"))
      return Response.json({ revision: { ...revision, id: "fixture-published", state: "PUBLISHED" }, content })
    if (init?.method === "PUT") {
      const section = SECTIONS.find(([, slug]) => path.endsWith(`/drafts/fixture-draft/${slug}`))?.[0]
      if (section) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        if (body.expectedDraftVersion !== revision.version)
          return Response.json({ code: "HERO_REVISION_VERSION_CONFLICT" }, { status: 409 })
        writes.push({ section, body })
        const { expectedDraftVersion, changeNote, ...value } = body
        content = { ...content, [section]: value }
        revision = { ...revision, version: revision.version + 1 }
        return Response.json(revision)
      }
    }
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  return {
    fetcher,
    writes,
    comparisonRequests,
    get content() {
      return content
    },
    get revision() {
      return revision
    },
  }
}
