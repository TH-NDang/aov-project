import assert from "node:assert/strict"
import { test } from "node:test"
import type { HeroDetail, HeroListItem } from "../src/features/hero/hero-api.ts"
import {
  currentScope,
  formLabelRole,
  heroAtPatch,
  heroFormPath,
  heroSearchTexts,
  heroWithForm,
  resolveHeroRoute,
  selectedForm,
} from "../src/features/hero/hero-forms.ts"
import { buildStaticPages, renderSitemap, type PublishedCatalog } from "../src/lib/seo/static-pages.ts"
import { wikiScrollKey } from "../src/lib/wiki-catalog.ts"

const ad = {
  id: "form-ad",
  code: "flowborn-ad",
  formKey: "ad",
  revisionId: "rev-ad",
  name: "Flowborn Xạ thủ",
  actualLocale: "vi-VN",
  roles: ["MARKSMAN" as const],
  positions: ["DRAGON" as const],
}
const mid = {
  ...ad,
  id: "form-mid",
  code: "flowborn-mid",
  formKey: "mid",
  name: "Flowborn Pháp sư",
  roles: ["MAGE" as const],
}
const flowborn: HeroListItem = {
  id: "hero-flowborn",
  code: "flowborn",
  revisionId: "rev-flowborn",
  name: "Flowborn",
  actualLocale: "vi-VN",
  roles: ["MARKSMAN", "MAGE"],
  forms: [ad, mid],
}
const airi: HeroListItem = {
  id: "hero-airi",
  code: "airi",
  revisionId: "rev-airi",
  name: "Airi",
  actualLocale: "vi-VN",
  roles: ["ASSASSIN"],
}
const items = [airi, flowborn]

test("the default form keeps the hero's address and every other form has its own", () => {
  assert.equal(heroFormPath("flowborn", "ad", [ad, mid]), "/hero/flowborn")
  assert.equal(heroFormPath("flowborn", "mid", [ad, mid]), "/hero/flowborn/mid")
  assert.equal(heroFormPath("airi"), "/hero/airi")
})

test("a hero page opens its default form, a known form, or falls back from an unknown one", () => {
  assert.deepEqual(resolveHeroRoute(items, "flowborn"), { kind: "hero", hero: flowborn, form: ad })
  assert.deepEqual(resolveHeroRoute(items, "flowborn", "mid"), { kind: "hero", hero: flowborn, form: mid })
  assert.deepEqual(resolveHeroRoute(items, "flowborn", "tank"), { kind: "redirect", path: "/hero/flowborn" })
  assert.deepEqual(resolveHeroRoute(items, "airi"), { kind: "hero", hero: airi, form: undefined })
  assert.deepEqual(resolveHeroRoute(items, "airi", "x"), { kind: "redirect", path: "/hero/airi" })
  assert.deepEqual(resolveHeroRoute(items, "missing"), { kind: "missing" })
})

test("old form addresses and ids lead to the form on the hero's page", () => {
  assert.deepEqual(resolveHeroRoute(items, "flowborn-ad"), { kind: "redirect", path: "/hero/flowborn" })
  assert.deepEqual(resolveHeroRoute(items, "flowborn-mid"), { kind: "redirect", path: "/hero/flowborn/mid" })
  assert.deepEqual(resolveHeroRoute(items, "form-mid"), { kind: "redirect", path: "/hero/flowborn/mid" })
  assert.deepEqual(resolveHeroRoute(items, "hero-flowborn", "mid"), { kind: "hero", hero: flowborn, form: mid })
})

test("the switcher names a form by its first role unless another form shares it", () => {
  assert.equal(formLabelRole(ad, [ad, mid]), "MARKSMAN")
  assert.equal(formLabelRole(ad, [ad, { ...mid, roles: ["MARKSMAN"] }]), undefined)
  assert.equal(formLabelRole({ roles: [] }, [ad]), undefined)
})

test("the library search finds a hero by the names and codes of its forms", () => {
  assert.deepEqual(heroSearchTexts(flowborn), [
    "Flowborn",
    "flowborn",
    "Flowborn Xạ thủ",
    "flowborn-ad",
    "Flowborn Pháp sư",
    "flowborn-mid",
  ])
})

test("a form is read under the shared name, title and lore with its own gameplay", () => {
  const context = {
    region: "VN",
    requestedLocale: "vi-VN",
    patch: { id: "p", code: "p" },
    ruleset: { id: "r", code: "r" },
  }
  const hero: HeroDetail = {
    id: "hero-flowborn",
    code: "flowborn",
    revisionId: "rev-flowborn",
    context,
    media: {},
    content: { profile: { name: "Flowborn", roles: [], title: "Hậu duệ Khởi Nguyên", lore: "Truyện", summary: null } },
    forms: [
      {
        id: "form-mid",
        code: "flowborn-mid",
        revisionId: "rev-mid",
        formKey: "mid",
        displayOrder: 2,
        media: {},
        content: {
          profile: { name: "Flowborn Pháp sư", roles: ["MAGE"], summary: "Đứng cạnh đồng đội" },
          skills: { skills: [{ skillKey: "skill-1-1", kind: "ACTIVE", displayOrder: 1 }] },
        },
      },
    ],
  }
  assert.equal(selectedForm(hero, "tank")?.formKey, "mid")
  const page = heroWithForm(hero, selectedForm(hero, "mid"))
  assert.equal(page.id, "form-mid")
  assert.equal(page.revisionId, "rev-mid")
  assert.equal(page.context, context)
  assert.deepEqual(page.content.profile, {
    name: "Flowborn",
    title: "Hậu duệ Khởi Nguyên",
    summary: "Đứng cạnh đồng đội",
    lore: "Truyện",
    roles: ["MAGE"],
  })
  assert.equal(page.content.skills?.skills?.[0].skillKey, "skill-1-1")
  assert.equal(heroWithForm(hero, undefined), hero)
})

test("switching forms keeps the reader's scroll position, other pages still start at the top", () => {
  assert.equal(wikiScrollKey("/hero/flowborn/mid"), wikiScrollKey("/hero/flowborn"))
  assert.notEqual(wikiScrollKey("/hero/flowborn"), wikiScrollKey("/hero/airi"))
  assert.equal(wikiScrollKey("/hero"), "/hero")
})

test("each published form has a static page; former addresses preview it without being listed", () => {
  const catalog: PublishedCatalog = {
    heroes: [
      {
        id: "hero-flowborn",
        code: "flowborn",
        name: "Flowborn",
        roles: ["MARKSMAN", "MAGE"],
        title: "Hậu duệ Khởi Nguyên",
        media: {},
        skills: [],
        skins: [{ name: "Trang phục chung" }],
        forms: [
          { ...ad, skills: [{ name: "Nỏ tiễn phá không", description: "bắn" }], skins: [] },
          { ...mid, summary: "Pháp sư", skills: [{ name: "Dòng chảy pháp trận", description: "nổ" }], skins: [] },
        ],
      },
    ],
    skins: [],
    warehouse: { items: [], enchantments: [], arcana: [], spells: [] },
    terms: [],
    patches: [],
    modes: [],
  }
  const pages = buildStaticPages(catalog)
  const at = (pagePath: string) => pages.find((page) => page.path === pagePath)

  const marksman = at("/hero/flowborn")!
  assert.equal(marksman.listed, true)
  assert.equal(marksman.meta.heading, "Flowborn — Hậu duệ Khởi Nguyên")
  assert.match(marksman.body, /Nỏ tiễn phá không/)
  assert.match(marksman.body, /Trang phục chung/)
  assert.match(marksman.body, /href="\/hero\/flowborn\/mid"/)

  const mage = at("/hero/flowborn/mid")!
  assert.equal(mage.listed, true)
  assert.equal(mage.meta.path, "/hero/flowborn/mid")
  assert.equal(mage.meta.heading, "Flowborn (Pháp sư) — Hậu duệ Khởi Nguyên")
  assert.match(mage.body, /Dòng chảy pháp trận/)
  assert.doesNotMatch(mage.body, /Nỏ tiễn phá không/)

  for (const [alias, canonical] of [
    ["/hero/flowborn-ad", "/hero/flowborn"],
    ["/hero/form-ad", "/hero/flowborn"],
    ["/hero/hero-flowborn", "/hero/flowborn"],
    ["/hero/flowborn/ad", "/hero/flowborn"],
    ["/hero/flowborn-mid", "/hero/flowborn/mid"],
    ["/hero/form-mid", "/hero/flowborn/mid"],
  ]) {
    assert.equal(at(alias)?.meta.path, canonical, alias)
    assert.equal(at(alias)?.listed, false, alias)
  }
  const sitemap = renderSitemap(pages, "https://wiki.example.test")
  assert.ok(sitemap.includes("<loc>https://wiki.example.test/hero/flowborn/mid</loc>"))
  assert.ok(!sitemap.includes("flowborn-ad"))
})

test("a past patch changes only the abilities and keeps the rest of today's hero", () => {
  const hero = (skillName: string, hp: number, title: string, icon?: string) =>
    ({
      id: "h",
      code: "natalya",
      revisionId: `r-${skillName}`,
      context: { patch: { code: skillName } },
      media: {},
      skillMedia: icon ? { "skill-2-1": { assetId: icon, semanticType: "SKILL" } } : {},
      content: {
        profile: { name: "Natalya", roles: ["MAGE"], title },
        skills: { skills: [{ skillKey: "skill-2-1", kind: "ACTIVE", displayOrder: 2, name: skillName }] },
        combatStats: { values: [{ statKey: "HP", baseValue: hp }] },
      },
      forms: [
        {
          formKey: "main",
          code: "natalya",
          displayOrder: 0,
          media: {},
          content: {
            skills: { skills: [{ skillKey: "f", kind: "ACTIVE", displayOrder: 0, name: `form ${skillName}` }] },
          },
        },
      ],
    }) as unknown as HeroDetail
  const today = hero("today", 3673, "Hiểm họa địa ngục", "today-icon")
  const past = { ...hero("past", 3500, "old title"), laterObservation: { patchVariantId: "p", patchCode: "x" } }

  const page = heroAtPatch(today, past)

  assert.equal(page.content.skills?.skills?.[0]?.name, "past")
  assert.equal(page.content.profile?.title, "Hiểm họa địa ngục")
  assert.equal(page.content.combatStats?.values?.[0]?.baseValue, 3673)
  assert.equal(page.skillMedia?.["skill-2-1"]?.assetId, "today-icon")
  assert.equal(page.revisionId, "r-today")
  assert.deepEqual(page.context, past.context)
  assert.deepEqual(page.laterObservation, past.laterObservation)
  assert.equal(page.forms?.[0]?.content.skills?.skills?.[0]?.name, "form past")
  assert.deepEqual(
    currentScope({ region: "VN", locale: "vi-VN", seasonId: "s", patchVariantId: "p", includeUnscoped: true }),
    {
      region: "VN",
      locale: "vi-VN",
      seasonId: "",
      patchVariantId: "",
      includeUnscoped: false,
    },
  )
})
