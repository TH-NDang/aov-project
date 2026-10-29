import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EntityRichText, EntityReferenceIcon } from "@aov/ui/components/entity-rich-text"
import {
  createEntityIndex,
  defaultEntityColor,
  parseRichText,
  resolveEntityRoute,
  safeEntityIconUrl,
  validateRichTextSettings,
  type EntityReference,
} from "@aov/ui/lib/entity-rich-text"
import { countryReferences, countryReferenceFlag } from "@aov/ui/lib/country-references"
import { referenceInputParts } from "@aov/ui/lib/reference-input-dom"

const channel = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel")
Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, value: undefined })
const { combineReferenceSearches, createCommunityReferenceApi, communityReferenceKeys, extractCommunityReferenceIds } =
  await import("../src/features/terminology/community-reference-api")
if (channel) Object.defineProperty(globalThis, "BroadcastChannel", channel)

const teamId = "11111111-1111-4111-8111-111111111111"
const playerId = "22222222-2222-4222-8222-222222222222"
const entity = (id: string, kind: EntityReference["kind"] = "team", name = id): EntityReference => ({
  id,
  kind,
  translations: [{ locale: "vi-VN", name, aliases: [], description: "" }],
  autoMatch: true,
})

test("community and country reference tokens remain atomic and resolve durable identities", () => {
  const text = `<ref=team:${teamId}>SGP</ref> với <ref=player:${playerId}>Fish</ref> tại <ref=country:VN>Việt Nam</ref>`
  const teams = [entity(teamId, "team", "Saigon Phantom"), entity(playerId, "player", "Fish"), ...countryReferences]
  const parts = referenceInputParts(text).filter((part) => part.type === "reference")
  assert.deepEqual(
    parts.map((part) => part.kind),
    ["team", "player", "country"],
  )
  const references = parseRichText(text, createEntityIndex(teams, "vi-VN", "vi-VN")).filter(
    (node) => node.type === "reference",
  )
  assert.deepEqual(
    references.map((node) => node.entity.id),
    [teamId, playerId, "VN"],
  )
  assert.deepEqual(extractCommunityReferenceIds(text + text), [teamId, playerId])
  assert.deepEqual(extractCommunityReferenceIds("<ref=team:not-an-id>Fake</ref>"), [])
})

test("community references cannot be written into Wiki settings or linked to a draft admin page from Wiki", () => {
  for (const kind of ["team", "player", "country"] as const) {
    const value = entity(kind === "country" ? "VN" : teamId, kind)
    assert.throws(
      () =>
        validateRichTextSettings({ schemaVersion: 1, autoRecognize: true, fallbackLocale: "vi-VN", entities: [value] }),
      /Managed references/,
    )
    assert.equal(resolveEntityRoute({ ...value, destinations: { wiki: "/tournaments" } }, "wiki"), undefined)
  }
  assert.equal(resolveEntityRoute(entity(teamId), "admin"), `/tournaments?tab=teams&team=${teamId}`)
  assert.equal(resolveEntityRoute(entity(playerId, "player"), "admin"), `/tournaments?tab=players&player=${playerId}`)
})

test("country artwork uses bundled flags without allowing arbitrary SVG icon URLs", () => {
  assert.ok(countryReferenceFlag("VN"))
  assert.equal(countryReferenceFlag("__proto__"), undefined)
  assert.equal(safeEntityIconUrl("https://attacker.example/icon.svg"), undefined)
  const markup = renderToStaticMarkup(
    <EntityReferenceIcon entity={{ ...entity("VN", "country"), icon: "https://attacker.example/icon.svg" }} />,
  )
  assert.ok(markup.includes("img"))
  assert.ok(!markup.includes("attacker.example"))
  const aliases = countryReferences.find((item) => item.id === "VN")!.translations[0]!.aliases
  assert.ok(aliases.includes("Vietnam"))
})

test("every supported country has a bundled flag and added regional SVGs contain no active or remote content", () => {
  for (const country of countryReferences.filter((entry) => entry.id !== "GLOBAL"))
    assert.ok(countryReferenceFlag(country.id), country.id)
  for (const code of ["HK", "MO", "SG", "MY", "PH"]) {
    const svg = readFileSync(new URL(countryReferenceFlag(code)!), "utf8")
    const dom = new JSDOM(svg, { contentType: "image/svg+xml" })
    const root = dom.window.document.documentElement
    assert.equal(root.localName, "svg")
    assert.equal(root.namespaceURI, "http://www.w3.org/2000/svg")
    assert.ok(root.getAttribute("viewBox"))
    assert.equal(root.querySelector("script, foreignObject, iframe, image"), null)
    for (const node of [root, ...root.querySelectorAll("*")])
      for (const attribute of node.attributes) {
        assert.ok(!/^on/i.test(attribute.name))
        if (attribute.localName === "href") assert.ok(attribute.value.startsWith("#"))
        assert.ok(!/url\(\s*["']?(?:https?:|\/\/|data:)/i.test(attribute.value))
      }
    dom.window.close()
  }
})

test("public rendering resolves static countries and preserves unknown community labels without private links", () => {
  const text = `<ref=team:${teamId}>Saigon Phantom</ref> · <ref=player:${playerId}>Fish</ref> · <ref=country:VN>Việt Nam</ref>`
  const markup = renderToStaticMarkup(<EntityRichText text={text} locale="vi-VN" context="wiki" />)
  assert.ok(markup.includes("Saigon Phantom"))
  assert.ok(markup.includes("Fish"))
  assert.ok(markup.includes("Việt Nam"))
  assert.ok(!markup.includes("&lt;ref="))
  assert.ok(!markup.includes("/tournaments"))
  assert.match(markup, /entity-icon-placeholder/)
  assert.match(markup, /<img/)
  const parsed = parseRichText(`<ref=team:${teamId}>SGP</ref>`, createEntityIndex([], "vi-VN", "vi-VN"))
  assert.equal(parsed[0]?.type, "reference")
  if (parsed[0]?.type === "reference") {
    assert.equal(parsed[0].entity.unresolved, true)
    assert.equal(resolveEntityRoute(parsed[0].entity, "admin"), undefined)
  }
})

test("semantic term colors adapt by theme and custom colors win over defaults", () => {
  const magic = entity("sat-thuong-phep", "term", "Sát thương phép")
  assert.equal(defaultEntityColor(magic), "light-dark(#7e22ce, #d8b4fe)")
  assert.equal(defaultEntityColor({ ...magic, id: teamId }), "light-dark(#7e22ce, #d8b4fe)")
  const markup = renderToStaticMarkup(
    <EntityRichText text="Sát thương phép" entities={[magic]} locale="vi-VN" context="admin" />,
  )
  assert.match(markup, /color:light-dark/)
  assert.match(markup, /border-bottom:1px dotted currentColor/)
  const customized = renderToStaticMarkup(
    <EntityRichText
      text="Sát thương phép"
      entities={[{ ...magic, display: { color: "#123456", underline: false } }]}
      locale="vi-VN"
      context="admin"
    />,
  )
  assert.match(customized, /color:#123456/)
  assert.ok(!customized.includes("border-bottom"))
  const explicit = renderToStaticMarkup(
    <EntityRichText text="<color=#abcdef>Sát thương phép</color>" entities={[magic]} locale="vi-VN" context="admin" />,
  )
  assert.ok(!explicit.includes("light-dark"))
})

test("community reference API sends scoped names-only requests and rejects oversized identity lookups", async () => {
  const calls: URL[] = []
  const api = createCommunityReferenceApi(async (path) => {
    calls.push(new URL(path, "http://localhost"))
    return { items: [entity(teamId)], totalElements: 1, page: 0, size: 20 } as never
  })
  const signal = new AbortController().signal
  await api.search("SGP", "team", 0, signal)
  assert.equal(calls[0]!.pathname, "/admin/reference-catalog")
  assert.equal(calls[0]!.searchParams.get("kind"), "TEAM")
  assert.equal(calls[0]!.searchParams.get("q"), "SGP")
  await api.lookup([teamId, teamId, playerId], signal)
  assert.equal(calls[1]!.searchParams.get("ids"), `${teamId},${playerId}`)
  assert.throws(
    () =>
      api.lookup(
        Array.from({ length: 51 }, (_, index) => `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`),
        signal,
      ),
    /at most 50/,
  )
  assert.throws(() => api.lookup(["not-a-uuid"], signal), /UUID/)
  assert.notDeepEqual(
    communityReferenceKeys.catalog("issuer", "alice"),
    communityReferenceKeys.catalog("issuer", "bob"),
  )
})

test("combined skill and community pagination keeps uneven source tails and exact totals", async () => {
  const first = Array.from({ length: 25 }, (_, index) => entity(`skill-${index}`, "skill"))
  const second = Array.from({ length: 43 }, (_, index) => entity(`team-${index}`))
  const search =
    (items: EntityReference[]) =>
    async ({ page }: { page: number }) => ({
      items: items.slice(page * 20, page * 20 + 20),
      totalElements: items.length,
      size: 20,
      page,
    })
  const combined = combineReferenceSearches(search(first), search(second))
  const results: EntityReference[] = []
  for (let page = 0; page < 4; page++) {
    const response = await combined({ query: "", locale: "vi-VN", page, signal: new AbortController().signal })
    assert.equal(response.totalElements, 68)
    assert.equal(response.size, 20)
    results.push(...response.items)
  }
  assert.deepEqual(
    results.map((item) => item.id),
    [...first, ...second].map((item) => item.id),
  )
  assert.equal(new Set(results.map((item) => item.id)).size, 68)
})

test("combined searches return the second source when the first has no result", async () => {
  const items = [entity(teamId)]
  const combined = combineReferenceSearches(
    async ({ page }) => ({ items: [], totalElements: 0, page, size: 20 }),
    async ({ page }) => ({ items, totalElements: 1, page, size: 20 }),
  )
  const response = await combined({ query: "SGP", locale: "vi-VN", page: 0, signal: new AbortController().signal })
  assert.deepEqual(response.items, items)
  assert.equal(response.totalElements, 1)
})
