import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createEntityIndex,
  parseRichText,
  resolveEntityRoute,
  safeLinkUrl,
  safeEntityIconUrl,
  validateRichTextSettings,
  type EntityReference,
  type RichTextNode,
} from "@aov/ui/lib/entity-rich-text"

const hero: EntityReference = {
  id: "hero-1",
  kind: "hero",
  translations: [
    { locale: "vi-VN", name: "Triệu Vân", aliases: ["Tướng Triệu Vân", "Long"], description: "Đấu sĩ" },
    { locale: "en-US", name: "Zanis", aliases: [], description: "Warrior" },
  ],
}
const term: EntityReference = {
  id: "term-1",
  kind: "term",
  translations: [{ locale: "vi-VN", name: "sát thương", aliases: ["Long"], description: "Damage" }],
}
const index = createEntityIndex([hero, term], "vi-VN", "en-US")
const flatten = (nodes: RichTextNode[]): string =>
  nodes
    .map((node) => ("children" in node ? flatten(node.children) : node.type === "text" ? node.text : node.label))
    .join("")
const refs = (nodes: RichTextNode[]): Extract<RichTextNode, { type: "reference" }>[] =>
  nodes.flatMap((node) => (node.type === "reference" ? [node] : "children" in node ? refs(node.children) : []))

test("bold and italic parse as semantic nodes with nested legacy colors", () => {
  const source = "<b>Bold <i>italic <color=#aabbcc>color</color></i></b>"
  const nodes = parseRichText(source, index, { autoRecognize: false })
  assert.deepEqual(nodes, [
    {
      type: "strong",
      children: [
        { type: "text", text: "Bold " },
        {
          type: "emphasis",
          children: [
            { type: "text", text: "italic " },
            {
              type: "color",
              color: "#aabbcc",
              children: [{ type: "text", text: "color" }],
            },
          ],
        },
      ],
    },
  ])
  const serialize = (items: RichTextNode[]): string =>
    items
      .map((node) => {
        if (node.type === "text") return node.text
        if (node.type === "reference") return `<ref=${node.entity.kind}:${node.entity.id}>${node.label}</ref>`
        if (node.type === "color") return `<color=${node.color}>${serialize(node.children)}</color>`
        const tag = node.type === "strong" ? "b" : "i"
        return `<${tag}>${serialize(node.children)}</${tag}>`
      })
      .join("")
  assert.equal(serialize(nodes), source)
  assert.equal(flatten(nodes), "Bold italic color")
})

test("formatting preserves recognition, noauto and manual reference priority", () => {
  const nodes = parseRichText(
    "<b>Triệu Vân <noauto><i>sát thương</i></noauto> <ref=term:term-1><i>Long</i></ref></b>",
    index,
  )
  assert.equal(nodes[0]?.type, "strong")
  assert.equal(refs(nodes).length, 2)
  assert.equal(refs(nodes)[0]?.manual, false)
  assert.equal(refs(nodes)[1]?.manual, true)
  assert.equal(refs(nodes)[1]?.label, "<i>Long</i>")
  assert.equal(flatten(nodes), "Triệu Vân sát thương <i>Long</i>")
})

test("formatting rejects attributes and malformed nesting and respects depth limits", () => {
  for (const source of [
    "<b>unclosed",
    "<i>unclosed",
    "<b><i>x</b></i>",
    '<b onclick="alert(1)">x</b>',
    '<i style="color:red">x</i>',
    "<strong>x</strong>",
    "<em>x</em>",
  ]) {
    const nodes = parseRichText(source, index)
    assert.equal(flatten(nodes), source)
    assert.ok(nodes.every((node) => node.type === "text"))
  }
  assert.deepEqual(parseRichText("<b><i>x</i></b>", index, { maxDepth: 1 }), [
    { type: "strong", children: [{ type: "text", text: "<i>x</i>" }] },
  ])
  assert.equal(refs(parseRichText("<b>".repeat(10000) + "Triệu Vân" + "</b>".repeat(10000), index)).length, 0)
})

test("recognition uses longest Unicode phrases and retains original combining marks", () => {
  const text = "TƯỚNG TRIỆU VÂN, Triệu Vân! " + "Triệu Vân".normalize("NFD")
  const nodes = parseRichText(text, index)
  assert.equal(refs(nodes).length, 3)
  assert.equal(refs(nodes)[0]?.label, "TƯỚNG TRIỆU VÂN")
  assert.equal(flatten(nodes), text)
})

test("boundaries do not match substrings, unaccented names, or ambiguous aliases", () => {
  const text = "xTriệu Vân Triệu Vânx Triệu Vân2 _Triệu Vân Trieu Van Long"
  assert.equal(refs(parseRichText(text, index)).length, 0)
  assert.equal(refs(parseRichText("(Triệu Vân), sát thương.", index)).length, 2)
})

test("optional accent folding handles Vietnamese d and preserves original labels without ambiguous matches", () => {
  const damage: EntityReference = {
    id: "damage",
    kind: "term",
    translations: [{ locale: "vi-VN", name: "Đấu sĩ", aliases: [], description: "" }],
  }
  const folded = createEntityIndex([hero, damage], "vi-VN", "vi-VN", { accentInsensitive: true })
  const source = "TRIEU VAN, dau si, " + "Đấu sĩ".normalize("NFD")
  const nodes = parseRichText(source, folded)
  assert.equal(refs(nodes).length, 3)
  assert.equal(flatten(nodes), source)
  const collision = { ...damage, id: "collision", translations: [{ ...damage.translations[0]!, name: "Dau si" }] }
  assert.equal(
    refs(parseRichText("dau si", createEntityIndex([damage, collision], "vi-VN", "vi-VN", { accentInsensitive: true })))
      .length,
    0,
  )
})

test("first occurrence policy spans formatting while explicit references remain available", () => {
  const source = "Triệu Vân <b>Triệu Vân</b> <ref=HERO:hero-1>Long</ref> sát thương sát thương"
  const nodes = parseRichText(source, index, { firstOccurrenceOnly: true })
  assert.equal(refs(nodes).length, 3)
  assert.equal(refs(nodes).filter((node) => node.manual).length, 1)
  assert.equal(flatten(nodes), "Triệu Vân Triệu Vân Long sát thương sát thương")
})

test("equipment names require explicit references or per-item opt-in without disabling hero or term recognition", () => {
  const airi: EntityReference = {
    id: "airi",
    kind: "hero",
    translations: [{ locale: "vi-VN", name: "Airi", aliases: [], description: "" }],
  }
  const projectile: EntityReference = {
    id: "phi-tieu",
    kind: "item",
    icon: "/images/phi-tieu.png",
    translations: [{ locale: "vi-VN", name: "Phi Tiêu", aliases: ["phi tieu"], description: "Trang bị" }],
  }
  const catalog = createEntityIndex([airi, projectile, term], "vi-VN", "vi-VN")
  const prose = "Airi ném phi tiêu gây sát thương."
  assert.deepEqual(
    refs(parseRichText(prose, catalog)).map((node) => node.entity.kind),
    ["hero", "term"],
  )
  const manual = refs(parseRichText("<ref=item:phi-tieu>Phi Tiêu</ref>", catalog))
  assert.equal(manual[0]?.entity.icon, "/images/phi-tieu.png")
  assert.equal(manual[0]?.manual, true)
  const optedIn = createEntityIndex([airi, { ...projectile, autoMatch: true }, term], "vi-VN", "vi-VN")
  assert.deepEqual(
    refs(parseRichText(prose, optedIn)).map((node) => node.entity.kind),
    ["hero", "item", "term"],
  )
  const optedOut = createEntityIndex([{ ...airi, autoMatch: false }, term], "vi-VN", "vi-VN")
  assert.deepEqual(
    refs(parseRichText(prose, optedOut)).map((node) => node.entity.kind),
    ["term"],
  )
})

test("icons allow local development object storage and reject remote HTTP or SVG payloads", () => {
  for (const url of [
    "http://localhost:9000/a.png",
    "http://127.0.0.1:9000/a.png",
    "http://192.168.1.20:9000/a.png",
    "https://cdn.example.com/a.png",
    "/__resources/a.png",
  ])
    assert.equal(safeEntityIconUrl(url), url)
  for (const url of [
    "http://evil.test/a.png",
    "http://10.evil.test/a.png",
    "http://172.32.0.1/a.png",
    "//evil.test/a.png",
    "/image%252esvg",
    "javascript:alert(1)",
  ])
    assert.equal(safeEntityIconUrl(url), undefined)
})

test("manual references override recognition and never nest links", () => {
  const nodes = parseRichText("<ref=hero:hero-1>sát thương <ref=term:term-1>Long</ref></ref>", index)
  assert.equal(refs(nodes).length, 1)
  assert.equal(refs(nodes)[0]?.entity.id, "hero-1")
  assert.equal(refs(nodes)[0]?.manual, true)
  assert.equal(refs(nodes)[0]?.label, "sát thương <ref=term:term-1>Long</ref>")
})

test("explicit noauto and global switch preserve manual references and colors", () => {
  const nodes = parseRichText("<noauto>Triệu Vân <color=#abc>sát thương</color></noauto> Triệu Vân", index)
  assert.equal(refs(nodes).length, 1)
  assert.equal(flatten(nodes), "Triệu Vân sát thương Triệu Vân")
  assert.equal(refs(parseRichText("Triệu Vân <ref=hero:hero-1>Z</ref>", index, { autoRecognize: false })).length, 1)
})

test("malformed markup, missing IDs and injection stay inert plain text", () => {
  for (const text of [
    "<ref=hero:missing>Triệu Vân</ref>",
    "<ref=hero:hero-1>Triệu Vân",
    "<color=#abc>unclosed",
    "<color=#12345>invalid</color>",
    '<color=red style="background:url(javascript:alert(1))">x</color>',
    '<script>alert(1)</script><img src=x onerror="alert(1)">',
    "<ref=hero:hero-1 onclick=alert(1)>x</ref>",
  ]) {
    const nodes = parseRichText(text, index)
    assert.equal(flatten(nodes), text)
    assert.equal(refs(nodes).length, 0)
    assert.ok(nodes.every((node) => node.type === "text"))
  }
})

test("locale selection is exact with explicit fallback and reports actual locale", () => {
  const english = createEntityIndex([hero, term], "en-US", "vi-VN")
  assert.equal(refs(parseRichText("Zanis sát thương Triệu Vân", english)).length, 2)
  assert.equal(refs(parseRichText("sát thương", english))[0]?.actualLocale, "vi-VN")
  assert.equal(refs(parseRichText("Triệu Vân", createEntityIndex([hero], "fr-FR", "de-DE"))).length, 0)
})

test("index skips malformed runtime records without crashing the renderer", () => {
  const malformed = [
    null,
    {},
    { ...hero, translations: null },
    { ...hero, translations: [null, { locale: 1 }, ...hero.translations] },
  ]
  const safe = createEntityIndex(malformed as unknown as EntityReference[], "vi-VN", "en-US")
  assert.equal(refs(parseRichText("Triệu Vân", safe)).length, 1)
  assert.equal(safe.byId.get("hero:hero-1")?.entity.translations.length, 2)
})

test("resource limits cap references, depth, input and tolerate hostile bracket runs", () => {
  assert.equal(refs(parseRichText("Triệu Vân ".repeat(1000), index, { maxReferences: 2 })).length, 2)
  assert.equal(flatten(parseRichText("a".repeat(200000), index)).length, 100001)
  const nested = "<color=#abc>".repeat(1000) + "Triệu Vân" + "</color>".repeat(1000)
  assert.equal(refs(parseRichText(nested, index)).length, 0)
  assert.equal(flatten(parseRichText("<".repeat(100000), index)).length, 100000)
  assert.deepEqual(parseRichText("Triệu Vân", index, { maxDepth: 0 }), [{ type: "text", text: "Triệu Vân" }])
  assert.equal(refs(parseRichText("Triệu Vân", index, { maxReferences: NaN })).length, 1)
})

test("safe URLs reject script, credentials, protocol-relative and encoded bypasses", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:image/svg+xml,x",
    "//evil.test/x",
    "/\\evil.test",
    "/%2fexample.com",
    "/%255cevil",
    "https://a:b@example.com",
    " https://example.com",
    "https://example.com/\nX",
    "/%00x",
  ]) {
    assert.equal(safeLinkUrl(value), undefined, value)
  }
  assert.equal(safeLinkUrl("/images/hero.png"), "/images/hero.png")
  assert.equal(safeLinkUrl("https://cdn.example.com/a.png"), "https://cdn.example.com/a.png")
})

test("route resolution separates application contexts and validates custom destinations", () => {
  assert.equal(resolveEntityRoute(hero, "admin"), "/hero/hero-1")
  assert.equal(resolveEntityRoute(hero, "wiki", "vi-VN"), "/?hero=hero-1&locale=vi-VN")
  assert.equal(resolveEntityRoute({ ...hero, kind: "item" }, "admin"), "/items?item=hero-1")
  assert.equal(resolveEntityRoute(term, "admin"), "/terminology?term=term-1")
  assert.equal(resolveEntityRoute({ ...hero, destinations: { admin: "/safe" } }, "admin"), "/safe")
  assert.equal(resolveEntityRoute({ ...hero, destinations: { admin: "javascript:alert(1)" } }, "admin"), "/hero/hero-1")
  assert.equal(resolveEntityRoute({ ...hero, id: "../../secrets" }, "admin"), undefined)
})

test("settings validate catalog, style and URL bounds and discard unrecognized fields", () => {
  const settings = { schemaVersion: 1, autoRecognize: true, fallbackLocale: "vi-VN", entities: [hero] }
  assert.deepEqual(validateRichTextSettings(settings), settings)
  assert.throws(() => validateRichTextSettings({ ...settings, schemaVersion: 2 }))
  assert.throws(() => validateRichTextSettings({ ...settings, autoRecognize: "true" }))
  assert.throws(() => validateRichTextSettings({ ...settings, entities: [{ ...hero, autoMatch: "false" }] }))
  assert.equal(
    validateRichTextSettings({ ...settings, entities: [{ ...hero, autoMatch: false }] }).entities[0]?.autoMatch,
    false,
  )
  assert.throws(() => validateRichTextSettings({ ...settings, entities: [hero, hero] }))
  assert.throws(() => validateRichTextSettings({ ...settings, entities: Array(2001).fill(hero) }))
  for (const extra of [
    { display: { color: "red;background:blue" } },
    { icon: "javascript:x" },
    { destinations: { admin: "https://evil.test" } },
    { translations: [] },
    { translations: [{ ...hero.translations[0], aliases: Array(21).fill("x") }] },
  ]) {
    assert.throws(() => validateRichTextSettings({ ...settings, entities: [{ ...hero, ...extra }] }))
  }
  const safe = validateRichTextSettings({
    ...settings,
    extra: "ignored",
    entities: [{ ...hero, display: { color: "#12345678", showIcon: true, underline: false, style: "ignored" } }],
  })
  assert.deepEqual(safe.entities[0]?.display, { color: "#12345678", showIcon: true, underline: false })
})
