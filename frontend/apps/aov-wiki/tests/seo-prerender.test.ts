import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { createServer, type RequestListener } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { test, type TestContext } from "node:test"
import { prerender } from "../scripts/prerender.mts"
import { renderRobots } from "../src/lib/seo/head-tags.ts"
import {
  buildStaticPages,
  renderSitemap,
  renderStaticPage,
  repeatedMeta,
  type PublishedCatalog,
  type PublishedEntry,
} from "../src/lib/seo/static-pages.ts"

const SITE = "https://wiki.example.test"
const TEMPLATE = `<!doctype html>
<html lang="vi"><head>
<title>AOV WiKi</title>
<!-- seo:head --><meta data-seo name="robots" content="noindex" /><!-- /seo:head -->
<script type="module" src="/assets/app.js"></script>
</head><body><div id="root"><!-- seo:body --></div></body></html>`

const media = (url: string, width = 1200, height = 600) => ({ currentVersion: { url, width, height } })
const entry = (id: string, code: string, name: string, state = "PUBLISHED"): PublishedEntry => ({
  id,
  code,
  revision: { state, publishedAt: "2026-11-04T11:05:52.976552Z" },
  content: { iconAssetId: "icon", translations: [{ locale: "vi-VN", name, summary: `Tóm tắt ${name}` }] },
  media: { icon: media(`https://cdn.test/${code}.png`, 100, 100) },
})

const catalog: PublishedCatalog = {
  heroes: [
    {
      id: "hero-1",
      code: "airi",
      name: "Airi",
      roles: ["ASSASSIN"],
      positions: ["TOP"],
      title: "Ninja rồng",
      summary: "Xông vào",
      media: { SPLASH: media("https://cdn.test/airi.jpg") },
      skills: [{ name: "Phi tiêu", description: "gây <color=#fff>280</color> sát thương" }, { name: null }],
      skins: [{ name: "Ninja Xanh Lá" }],
    },
    {
      id: "hero-2",
      code: "alice",
      name: "Alice <&>",
      roles: ["MAGE"],
      summary: 'Có "dấu" $& lạ',
      media: {},
      skills: [],
      skins: [],
    },
  ],
  skins: [{ heroCode: "airi", heroName: "Airi", name: "Ninja Xanh Lá" }],
  warehouse: {
    items: [entry("item-1", "ao-choang", "Áo choàng"), entry("item-2", "ban-nhap", "Bản nháp", "DRAFT")],
    enchantments: [entry("ench-1", "am-kich", "Ám kích")],
    arcana: [entry("arc-1", "do-1", "Đỏ I")],
    spells: [entry("spell-1", "boc-pha", "Bộc phá")],
  },
  terms: [{ id: "giap", name: "Giáp", description: "Giảm <info>sát thương</info>" }],
  patches: [{ code: "2026-10-30", title: "Giữa mùa", summary: "", effectiveAt: "2026-11-04T11:27:08Z" }],
}

const pages = buildStaticPages(catalog)
const pageAt = (pagePath: string) => pages.find((page) => page.path === pagePath)

test("every public page exists with one title and description of its own", () => {
  for (const expected of [
    "/",
    "/contact",
    "/hero",
    "/hero/airi",
    "/skins",
    "/warehouse",
    "/warehouse/items",
    "/warehouse/items/ao-choang",
    "/warehouse/enchantments",
    "/warehouse/enchantments/am-kich",
    "/warehouse/arcana",
    "/warehouse/arcana/do-1",
    "/warehouse/spells",
    "/warehouse/spells/boc-pha",
    "/terms",
    "/terms/giap",
    "/updates",
    "/updates/2026-10-30",
  ])
    assert.ok(pageAt(expected), expected)
  assert.deepEqual(repeatedMeta(pages), [])
})

test("an entry whose revision is not published gets no page and no link", () => {
  assert.equal(pageAt("/warehouse/items/ban-nhap"), undefined)
  assert.ok(!pageAt("/warehouse/items")!.body.includes("ban-nhap"))
  assert.ok(!renderSitemap(pages, SITE).includes("ban-nhap"))
})

test("older links by id preview the same page and name the code address as canonical", () => {
  const byId = pageAt("/hero/hero-1")!
  assert.equal(byId.meta.path, "/hero/airi")
  assert.equal(byId.listed, false)
  assert.equal(pageAt("/warehouse/items/item-1")!.meta.path, "/warehouse/items/ao-choang")
  assert.equal(pageAt("/warehouse")!.meta.path, "/warehouse/items")
  assert.equal(pageAt("/warehouse")!.listed, false)
})

test("a static hero page carries its head, its readable body and the app's script", () => {
  const html = renderStaticPage(TEMPLATE, pageAt("/hero/airi")!, SITE)
  assert.match(html, /<title>Airi — Ninja rồng \| AOV WiKi<\/title>/)
  assert.match(html, /<meta data-seo name="description" content="Airi — Ninja rồng: tướng Sát thủ/)
  assert.match(html, /<meta data-seo property="og:image" content="https:\/\/cdn\.test\/airi\.jpg" \/>/)
  assert.match(html, /<link data-seo rel="canonical" href="https:\/\/wiki\.example\.test\/hero\/airi" \/>/)
  assert.ok(!html.includes("noindex"), "the template's noindex must be replaced")
  assert.match(html, /<div id="root"><div data-prerendered>/)
  assert.match(html, /<h1>Airi<\/h1>/)
  assert.match(html, /<strong>Phi tiêu<\/strong>: gây 280 sát thương/)
  assert.match(html, /<li>Ninja Xanh Lá<\/li>/)
  assert.match(html, /<script type="module" src="\/assets\/app\.js">/)
})

test("published text cannot break out of the markup or act as a replacement pattern", () => {
  const html = renderStaticPage(TEMPLATE, pageAt("/hero/alice")!, SITE)
  assert.ok(html.includes("<title>Alice &lt;&amp;&gt; | AOV WiKi</title>"))
  assert.ok(html.includes("<h1>Alice &lt;&amp;&gt;</h1>"))
  assert.ok(html.includes("&quot;dấu&quot; $&amp; lạ"))
  assert.ok(!html.includes("<&>"))
})

test("a hero without artwork previews the site logo", () => {
  const html = renderStaticPage(TEMPLATE, pageAt("/hero/alice")!, SITE)
  assert.match(html, /property="og:image" content="https:\/\/wiki\.example\.test\/images\/mole-logo-v4\.png"/)
})

test("the sitemap lists canonical addresses only, escaped and dated where a date is known", () => {
  const sitemap = renderSitemap(pages, SITE)
  assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  assert.ok(sitemap.includes(`<loc>${SITE}/hero/airi</loc>`))
  assert.ok(sitemap.includes(`<loc>${SITE}/warehouse/arcana/do-1</loc><lastmod>2026-11-04</lastmod>`))
  assert.ok(sitemap.includes(`<loc>${SITE}/updates/2026-10-30</loc><lastmod>2026-11-04</lastmod>`))
  assert.ok(!sitemap.includes("hero-1"), "addresses by id are not canonical")
  assert.ok(!sitemap.includes("item-1"))
  assert.ok(!sitemap.includes(`<loc>${SITE}/warehouse</loc>`))
  assert.doesNotMatch(sitemap, /<loc>[^<]*\?/, "no scope or locale variants")

  const escaped = renderSitemap([{ ...pages[0], meta: { ...pages[0].meta, path: "/a&b" } }], SITE)
  assert.ok(escaped.includes("/a&amp;b"))
})

test("robots.txt keeps the API open for rendering and closes everything without a public address", () => {
  const robots = renderRobots(SITE)
  assert.ok(robots.includes(`Sitemap: ${SITE}/sitemap.xml`))
  for (const closed of ["/auth/", "/admin/", "/idp/"]) assert.ok(robots.includes(`Disallow: ${closed}`), closed)
  assert.ok(!robots.includes("/api"), "renderers must be able to fetch page data")
  assert.ok(!robots.includes("/stream"), "Stream is public and shares this origin")
  assert.equal(renderRobots(null), "User-agent: *\nDisallow: /\n")
})

// End to end against a stand-in for the public API: the real script, real files, no backend and no domain.

const PUBLIC_API: Record<string, unknown> = {
  "/heroes": { items: [{ id: "hero-1", code: "airi", name: "Airi", roles: ["ASSASSIN"] }], totalElements: 1 },
  "/heroes/hero-1": {
    media: { SPLASH: media("https://cdn.test/airi.jpg") },
    content: {
      profile: { title: "Ninja rồng", summary: "Xông vào" },
      skills: { skills: [{ name: "Phi tiêu", description: "Ném" }] },
      skins: { skins: [{ name: "Ninja Xanh Lá" }] },
    },
  },
  "/skins": {
    page: { items: [{ heroCode: "airi", heroName: "Airi", name: "Ninja Xanh Lá" }], totalElements: 1 },
  },
  "/reference-catalog": {
    settings: {
      entities: [
        { id: "giap", kind: "term", translations: [{ locale: "vi-VN", name: "Giáp", description: "Giảm" }] },
        { id: "hero-1", kind: "hero", translations: [{ locale: "vi-VN", name: "Airi" }] },
      ],
    },
  },
  "/patches": { items: [{ code: "2026-10-30", title: "Giữa mùa" }], totalElements: 1 },
  "/items": { items: [entry("item-1", "ao-choang", "Áo choàng")], totalElements: 1 },
  "/enchantments": { items: [], totalElements: 0 },
  "/arcana": { items: [], totalElements: 0 },
  "/spells": { items: [entry("spell-1", "boc-pha", "Bộc phá")], totalElements: 1 },
  "/spells/archived": {
    items: [entry("spell-1", "boc-pha", "Bộc phá"), entry("spell-2", "cam-tru", "Cấm trụ")],
    totalElements: 2,
  },
}

async function publicApi(t: TestContext, respond?: RequestListener) {
  const requests: string[] = []
  const server = createServer((request, response) => {
    requests.push(request.url ?? "")
    if (respond) return respond(request, response)
    const body = PUBLIC_API[new URL(request.url ?? "/", "http://api").pathname.replace("/api/wiki/v1", "")]
    response.writeHead(body ? 200 : 404, { "Content-Type": "application/json" }).end(JSON.stringify(body ?? {}))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(() => server.close())
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests }
}

async function builtSite(t: TestContext) {
  const distDir = await mkdtemp(path.join(tmpdir(), "wiki-prerender-"))
  t.after(() => rm(distDir, { recursive: true, force: true }))
  await writeFile(path.join(distDir, "200.html"), TEMPLATE)
  return distDir
}

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  )

test("prerendering writes each page, the sitemap and robots.txt from anonymous public requests", async (t) => {
  const api = await publicApi(t)
  const distDir = await builtSite(t)
  await prerender({ distDir, siteUrl: SITE, apiBase: api.url })

  const hero = await readFile(path.join(distDir, "hero", "airi", "index.html"), "utf8")
  assert.match(hero, /<title>Airi — Ninja rồng \| AOV WiKi<\/title>/)
  assert.match(hero, /property="og:image" content="https:\/\/cdn\.test\/airi\.jpg"/)

  const home = await readFile(path.join(distDir, "index.html"), "utf8")
  assert.match(home, /<link data-seo rel="canonical" href="https:\/\/wiki\.example\.test\/" \/>/)
  assert.ok(await exists(path.join(distDir, "warehouse", "items", "ao-choang", "index.html")))
  // A retired talent stays readable, and appears once even when both lists return it.
  assert.ok(await exists(path.join(distDir, "warehouse", "spells", "cam-tru", "index.html")))

  const sitemap = await readFile(path.join(distDir, "sitemap.xml"), "utf8")
  assert.equal(sitemap.match(/warehouse\/spells\/boc-pha</g)?.length, 1)
  assert.ok((await readFile(path.join(distDir, "robots.txt"), "utf8")).includes(`Sitemap: ${SITE}/sitemap.xml`))

  assert.ok(api.requests.every((url) => url.startsWith("/api/wiki/v1/") && !url.includes("/admin/")))
  assert.ok(api.requests.every((url) => url.includes("region=VN") && url.includes("locale=vi-VN")))
  // The template stays neutral, so the step can run again without a new build.
  assert.equal(await readFile(path.join(distDir, "200.html"), "utf8"), TEMPLATE)
})

test("running again removes the page of anything no longer published", async (t) => {
  const api = await publicApi(t)
  const distDir = await builtSite(t)
  const stale = path.join(distDir, "hero", "unpublished", "index.html")
  await mkdir(path.dirname(stale), { recursive: true })
  await writeFile(stale, "old")
  await writeFile(path.join(distDir, "keep.txt"), "not ours")

  await prerender({ distDir, siteUrl: SITE, apiBase: api.url })

  assert.equal(await exists(stale), false)
  assert.equal(await exists(path.join(distDir, "keep.txt")), true)
})

test("a failing API changes nothing, so the last good pages stay online", async (t) => {
  const api = await publicApi(t, (_request, response) => response.writeHead(503).end())
  const distDir = await builtSite(t)
  const previous = path.join(distDir, "hero", "airi", "index.html")
  await mkdir(path.dirname(previous), { recursive: true })
  await writeFile(previous, "last good")

  await assert.rejects(prerender({ distDir, siteUrl: SITE, apiBase: api.url, retryDelayMs: 1 }), /503/)

  assert.equal(await readFile(previous, "utf8"), "last good")
  assert.equal(await exists(path.join(distDir, "sitemap.xml")), false)
})

test("an API answering with no heroes cannot wipe the site", async (t) => {
  const api = await publicApi(t, (_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        items: [],
        totalElements: 0,
        page: { items: [], totalElements: 0 },
        settings: { entities: [] },
      }),
    )
  })
  const distDir = await builtSite(t)
  await assert.rejects(prerender({ distDir, siteUrl: SITE, apiBase: api.url }), /no published heroes/)
  assert.equal(await exists(path.join(distDir, "sitemap.xml")), false)
})

test("the step refuses to run on a folder that was never built", async (t) => {
  const api = await publicApi(t)
  const distDir = await mkdtemp(path.join(tmpdir(), "wiki-prerender-"))
  t.after(() => rm(distDir, { recursive: true, force: true }))
  await assert.rejects(prerender({ distDir, siteUrl: SITE, apiBase: api.url }), /Run the Wiki build first/)
  assert.equal(api.requests.length, 0)
})
