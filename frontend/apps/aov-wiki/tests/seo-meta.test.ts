import assert from "node:assert/strict"
import { test } from "node:test"
import { absoluteUrl, applyPageHead, headTags, parseSiteUrl } from "../src/lib/seo/head-tags.ts"
import {
  clampDescription,
  DEFAULT_IMAGE,
  heroMeta,
  homeMeta,
  libraryPageMeta,
  notFoundMeta,
  patchMeta,
  plainText,
  sectionMeta,
  termMeta,
  warehouseEntryMeta,
} from "../src/lib/seo/page-meta.ts"

const SITE = "https://wiki.example.test"
const splash = {
  currentVersion: { url: "https://cdn.test/airi.jpg", width: 1187, height: 667, mimeType: "image/jpeg" },
}
const hero = {
  code: "airi",
  name: "Airi",
  roles: ["ASSASSIN"],
  title: "Ninja rồng",
  summary: "Xông vào",
  media: { SPLASH: splash },
}
const item = {
  code: "ao-choang",
  content: {
    iconAssetId: "icon",
    translations: [{ locale: "vi-VN", name: "Áo choàng", summary: "Làm chậm", description: "+200 Giáp\n+800 Máu" }],
  },
  media: { icon: { currentVersion: { url: "https://cdn.test/ao.png", width: 100, height: 100 } } },
}
const attribute = (tags: ReturnType<typeof headTags>, key: string) =>
  tags.find(({ attrs }) => attrs.property === key || attrs.name === key)?.attrs.content

test("the public address is an origin, so a path or a typo cannot produce wrong canonical links", () => {
  assert.equal(parseSiteUrl("https://wiki.example.test"), SITE)
  assert.equal(parseSiteUrl(" https://wiki.example.test/ "), SITE)
  assert.equal(parseSiteUrl("http://localhost:5173"), "http://localhost:5173")
  for (const invalid of [
    "",
    null,
    undefined,
    "wiki.example.test",
    "ftp://x.test",
    "https://x.test/wiki",
    "https://x.test?a=1",
  ])
    assert.equal(parseSiteUrl(invalid), null)
})

test("a hero page names the hero, describes it and previews its own artwork", () => {
  const meta = heroMeta(hero, "vi-VN")
  assert.equal(meta.title, "Airi — Ninja rồng | AOV WiKi")
  assert.equal(meta.path, "/hero/airi")
  assert.match(meta.description, /^Airi — Ninja rồng: tướng Sát thủ trong Liên Quân Mobile\. Xông vào$/)

  const tags = headTags(meta, SITE)
  assert.equal(attribute(tags, "og:image"), "https://cdn.test/airi.jpg")
  assert.equal(attribute(tags, "og:image:width"), "1187")
  assert.equal(attribute(tags, "og:image:type"), "image/jpeg")
  assert.equal(attribute(tags, "twitter:card"), "summary_large_image")
  assert.equal(tags.find(({ attrs }) => attrs.rel === "canonical")?.attrs.href, `${SITE}/hero/airi`)
  assert.equal(attribute(tags, "robots"), undefined)
})

test("hero artwork prefers the widest image and falls back to the site logo only when there is none", () => {
  const image = (media: Parameters<typeof heroMeta>[0]["media"]) => heroMeta({ ...hero, media }, "vi-VN").image?.url
  const version = (url: string) => ({ currentVersion: { url } })
  assert.equal(image({ SPLASH: version("s"), PORTRAIT: version("p"), HEAD: version("h") }), "s")
  assert.equal(image({ PORTRAIT: version("p"), HEAD: version("h") }), "p")
  assert.equal(image({ HEAD: version("h") }), "h")
  assert.equal(image({}), DEFAULT_IMAGE.url)
})

test("an item page previews the item's own icon with its real size on a small card", () => {
  const meta = warehouseEntryMeta("items", item, "vi-VN")
  assert.equal(meta.title, "Áo choàng — Trang bị | AOV WiKi")
  assert.equal(meta.path, "/warehouse/items/ao-choang")
  assert.equal(meta.description, "Áo choàng: Trang bị trong Liên Quân Mobile. Làm chậm. +200 Giáp +800 Máu")
  const tags = headTags(meta, SITE)
  assert.equal(attribute(tags, "og:image"), "https://cdn.test/ao.png")
  assert.equal(attribute(tags, "og:image:width"), "100")
  assert.equal(attribute(tags, "twitter:card"), "summary")
})

test("canonical links ignore locale and browsing scope, which only change the view of one page", () => {
  for (const locale of ["vi-VN", "en-US"]) assert.equal(heroMeta(hero, locale).path, "/hero/airi")
  assert.equal(sectionMeta("arcana", "en-US").path, "/warehouse/arcana")
  assert.equal(heroMeta(hero, "en-US").locale, "en-US")
  assert.match(heroMeta(hero, "en-US").description, /Assassin hero in Arena of Valor/)
})

test("library pages take their description from the address alone", () => {
  assert.equal(libraryPageMeta("/hero", "vi-VN")?.title, "Tướng | AOV WiKi")
  assert.equal(libraryPageMeta("/skins", "vi-VN")?.path, "/skins")
  assert.equal(libraryPageMeta("/warehouse", "vi-VN")?.path, "/warehouse/items")
  assert.equal(libraryPageMeta("/warehouse/spells", "vi-VN")?.title, "Phụ trợ | AOV WiKi")
  for (const detail of ["/hero/airi", "/warehouse/items/ao-choang", "/terms/giap", "/updates/2026-10-30", "/"])
    assert.equal(libraryPageMeta(detail, "vi-VN"), null)
})

test("every section has its own title and description in both languages", () => {
  const keys = ["heroes", "skins", "items", "enchantments", "arcana", "spells", "updates", "terms"] as const
  for (const locale of ["vi-VN", "en-US"]) {
    const metas = [...keys.map((key) => sectionMeta(key, locale)), homeMeta(locale)]
    assert.equal(new Set(metas.map((meta) => meta.title)).size, metas.length)
    assert.equal(new Set(metas.map((meta) => meta.description)).size, metas.length)
  }
})

test("game markup never reaches a description", () => {
  assert.equal(
    plainText("gây 280 <color=#C6633E>(+90%Công vật lý)</color> sát thương"),
    "gây 280 (+90%Công vật lý) sát thương",
  )
  assert.equal(
    plainText("<info>Số đầu.</info>\n<example><exampletable>[[1,2]]</exampletable></example>\n<note>Cách nhau.</note>"),
    "Số đầu. Cách nhau.",
  )
  assert.equal(plainText("máu < 30% và > 10%"), "máu < 30% và > 10%")
  assert.equal(plainText(null), "")
  assert.equal(termMeta({ id: "x", name: "X", description: "<info>Một</info>" }, "vi-VN").description, "X: Một")
})

test("long descriptions end on a whole word within the length search engines show", () => {
  const long = "từ ".repeat(100).trim()
  const clamped = clampDescription(long)
  assert.ok(clamped.length <= 160)
  assert.ok(clamped.endsWith("từ…"))
  assert.equal(clampDescription("Ngắn"), "Ngắn")
  assert.ok(heroMeta({ ...hero, summary: long }, "vi-VN").description.length <= 160)
})

test("a patch without a written summary still gets its own description", () => {
  const first = patchMeta({ code: "2026-10-30", title: "Giữa mùa", summary: "", description: null }, "vi-VN")
  const second = patchMeta({ code: "2026-10-15", title: "Đầu mùa", summary: "", description: null }, "vi-VN")
  assert.notEqual(first.description, second.description)
  assert.match(first.description, /2026-10-30/)
  assert.equal(patchMeta({ code: "c", title: null, summary: "Tóm tắt" }, "vi-VN").description, "Tóm tắt")
  assert.equal(patchMeta({ code: "c", title: null }, "vi-VN").heading, "c")
})

test("a build without a public address and a missing page both stay out of the index", () => {
  const unaddressed = headTags(homeMeta("vi-VN"), null)
  assert.equal(attribute(unaddressed, "robots"), "noindex")
  assert.equal(
    unaddressed.find(({ attrs }) => attrs.rel === "canonical"),
    undefined,
  )
  assert.equal(attribute(unaddressed, "og:url"), undefined)
  // A same-origin image cannot be made absolute without an address.
  assert.equal(attribute(unaddressed, "og:image"), undefined)

  const missing = headTags(notFoundMeta("vi-VN", "/hero/none", "heroes"), SITE)
  assert.equal(attribute(missing, "robots"), "noindex")
  assert.equal(
    missing.find(({ attrs }) => attrs.rel === "canonical"),
    undefined,
  )
})

test("media stored as a same-origin path becomes absolute for previews", () => {
  assert.equal(absoluteUrl("/media/a/b.png", SITE), `${SITE}/media/a/b.png`)
  assert.equal(absoluteUrl("https://cdn.test/a.png", SITE), "https://cdn.test/a.png")
  assert.equal(absoluteUrl("https://cdn.test/a.png", null), "https://cdn.test/a.png")
  assert.equal(absoluteUrl("/media/a.png", null), null)
})

test("client navigation replaces the static page's tags instead of adding to them", () => {
  class FakeElement {
    readonly attributes = new Map<string, string>()
    removed = false
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value)
    }
    remove() {
      this.removed = true
    }
  }
  const stale = new FakeElement()
  stale.setAttribute("name", "robots")
  stale.setAttribute("data-seo", "")
  const appended: FakeElement[] = []
  const document = {
    title: "before",
    createElement: () => new FakeElement(),
    head: {
      querySelectorAll: () => [stale, ...appended.filter((element) => !element.removed)],
      append: (element: FakeElement) => appended.push(element),
    },
  }

  applyPageHead(document as unknown as Document, heroMeta(hero, "vi-VN"), SITE)
  applyPageHead(document as unknown as Document, sectionMeta("skins", "vi-VN"), SITE)

  assert.equal(document.title, "Trang phục | AOV WiKi")
  assert.equal(stale.removed, true)
  const live = appended.filter((element) => !element.removed)
  const contents = live.map((element) => element.attributes.get("content") ?? element.attributes.get("href"))
  assert.ok(contents.includes(`${SITE}/skins`))
  assert.ok(!contents.includes(`${SITE}/hero/airi`))
  assert.equal(live.filter((element) => element.attributes.get("name") === "description").length, 1)
  assert.ok(live.every((element) => element.attributes.has("data-seo")))
})
