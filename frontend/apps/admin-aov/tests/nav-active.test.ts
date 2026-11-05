import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NAV_ICONS } from "../src/app/aov-nav-icon"
import { activeNavItem, pageNavIcon, NAV_ITEMS, MEDIA_NAV } from "../src/app/nav"

test("only the most specific navigation item is active", () => {
  assert.equal(activeNavItem("/hero/media")?.title, "Không gian ảnh")
  assert.equal(activeNavItem("/media/head")?.title, "Không gian ảnh")
  assert.equal(activeNavItem("/hero")?.title, "Tướng")
  assert.equal(activeNavItem("/hero/fixture-hero")?.title, "Tướng")
  assert.equal(activeNavItem("/")?.title, "Bảng điều khiển")
  assert.equal(activeNavItem("/unknown"), undefined)
})

test("page tabs use the selected media view and specific profile directory artwork", () => {
  assert.equal(pageNavIcon("/hero/media"), "portrait")
  assert.equal(pageNavIcon("/hero/media?tab=head&hero=dolia"), "head")
  assert.equal(pageNavIcon("/hero/media?tab=cover"), "cover")
  assert.equal(pageNavIcon("/hero/media?tab=badges"), "badges")
  assert.equal(pageNavIcon("/hero/media?tab=invalid"), "portrait")
  assert.equal(pageNavIcon("/hero/dolia"), "heroes")
  assert.equal(pageNavIcon("/teams"), "teams")
  assert.equal(pageNavIcon("/players"), "players")
  assert.equal(pageNavIcon("/organizations"), "organizations")
  assert.equal(pageNavIcon("/circuits"), "circuits")
  assert.equal(pageNavIcon("/coaches"), "coaches")
  assert.equal(pageNavIcon("/broadcast"), "broadcast")
  assert.equal(pageNavIcon("/page-requests"), "moderation")
  assert.equal(pageNavIcon("/tournaments/example"), "tournaments")
  assert.equal(pageNavIcon("/unknown"), "page")
})

test("navigation artwork resolves to unique symbols with valid local references", () => {
  const sources = new Set<string>()
  for (const Icon of Object.values(NAV_ICONS)) {
    const markup = renderToStaticMarkup(createElement(Icon, { size: 20 }))
    assert.match(markup, /aria-hidden="true"/)
    assert.match(markup, /width="20"/)
    const href = markup.match(/<use href="([^"]+)"/)?.[1]
    assert.ok(href)
    assert.ok(!sources.has(href), `Artwork is reused for a distinct concept: ${href}`)
    sources.add(href)
    const url = new URL(href)
    const symbol = url.hash.slice(1)
    url.hash = ""
    url.search = ""
    const svg = readFileSync(url, "utf8")
    assert.ok(svg.includes(`<symbol id="${symbol}"`), `Missing symbol ${symbol}`)
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
    assert.equal(new Set(ids).size, ids.length, "SVG IDs must be unique within each sprite")
    for (const [, target] of svg.matchAll(/url\(#([^)]*)\)/g)) {
      assert.ok(ids.includes(target), `Missing local SVG reference ${target}`)
    }
  }
  for (const item of [...NAV_ITEMS, ...MEDIA_NAV]) assert.ok(item.icon in NAV_ICONS)
  const profile = NAV_ITEMS.find((item) => item.to === "/organizations")
  const users = NAV_ITEMS.find((item) => item.to === "/users")
  const moderation = NAV_ITEMS.find((item) => item.to === "/page-requests")
  assert.equal(new Set([profile?.icon, users?.icon, moderation?.icon]).size, 3)
})
