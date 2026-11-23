import assert from "node:assert/strict"
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

test("every navigation concept draws a shape of its own", () => {
  const shapes = new Set<string>()
  for (const [name, Icon] of Object.entries(NAV_ICONS)) {
    const markup = renderToStaticMarkup(createElement(Icon, { size: 20 }))
    assert.match(markup, /aria-hidden="true"/)
    assert.match(markup, /width="20"/)
    const shape = markup.match(/<path d="([^"]+)"/)?.[1]
    assert.ok(shape, `No shape for ${name}`)
    assert.ok(!shapes.has(shape), `The shape of ${name} is reused for another concept`)
    shapes.add(shape)
  }
  for (const item of [...NAV_ITEMS, ...MEDIA_NAV]) assert.ok(item.icon in NAV_ICONS)
  const profile = NAV_ITEMS.find((item) => item.to === "/organizations")
  const users = NAV_ITEMS.find((item) => item.to === "/users")
  const moderation = NAV_ITEMS.find((item) => item.to === "/page-requests")
  assert.equal(new Set([profile?.icon, users?.icon, moderation?.icon]).size, 3)
})
