import assert from "node:assert/strict"
import { test } from "node:test"
import { pageSummary, streamCanonical, streamHeadTags, streamOrigin } from "../src/lib/stream-head.ts"

test("Stream reads its public origin from the Wiki address and has none without a real one", () => {
  assert.equal(streamOrigin("https://athahub.com/"), "https://athahub.com")
  assert.equal(streamOrigin(" https://athahub.com/wiki "), "https://athahub.com")
  assert.equal(streamOrigin(""), null)
  assert.equal(streamOrigin(undefined), null)
  assert.equal(streamOrigin("not a url"), null)
  assert.equal(streamOrigin("ftp://athahub.com"), null)
})

test("a canonical address keeps the app's base path, and home ends with a slash", () => {
  assert.equal(streamCanonical("https://athahub.com", "/stream/", "/"), "https://athahub.com/stream/")
  assert.equal(streamCanonical("https://athahub.com", "/stream/", "/teams/t1"), "https://athahub.com/stream/teams/t1")
  assert.equal(streamCanonical("https://athahub.com", "/", "/credits"), "https://athahub.com/credits")
  assert.equal(streamCanonical(null, "/stream/", "/credits"), null)
})

test("a public page names its canonical address, describes itself and is indexed", () => {
  const tags = streamHeadTags(
    { title: "Saigon Phantom — AOV Stream", description: "Đội tuyển", path: "/teams/t1", locale: "vi-VN" },
    "https://athahub.com/stream/teams/t1",
  )
  const find = (key: string) => tags.find(({ attrs }) => (attrs.rel ?? attrs.name ?? attrs.property) === key)
  assert.equal(find("canonical")?.attrs.href, "https://athahub.com/stream/teams/t1")
  assert.equal(find("og:url")?.attrs.content, "https://athahub.com/stream/teams/t1")
  assert.equal(find("og:title")?.attrs.content, "Saigon Phantom — AOV Stream")
  assert.equal(find("og:locale")?.attrs.content, "vi_VN")
  assert.equal(find("description")?.attrs.content, "Đội tuyển")
  assert.equal(find("og:description")?.attrs.content, "Đội tuyển")
  assert.equal(find("robots"), undefined)
})

test("an account page, a missing page and a build without a public address are not indexed", () => {
  const page = { title: "Tài khoản — AOV Stream", path: "/account", locale: "vi-VN", noindex: true }
  for (const tags of [
    streamHeadTags(page, "https://athahub.com/stream/account"),
    streamHeadTags({ ...page, noindex: false }, null),
  ]) {
    const keys = tags.map(({ attrs }) => attrs.rel ?? attrs.name ?? attrs.property)
    assert.ok(keys.includes("robots"))
    assert.ok(!keys.includes("canonical"))
    assert.ok(!keys.includes("og:url"))
    assert.ok(!keys.includes("description"))
  }
})

test("a description cut from a biography ends on a whole word", () => {
  assert.equal(pageSummary("  Đội tuyển   đến từ\nTP.HCM. "), "Đội tuyển đến từ TP.HCM.")
  assert.equal(pageSummary(""), undefined)
  assert.equal(pageSummary(null), undefined)
  const long = pageSummary("một hai ba bốn năm sáu bảy tám chín mười, ".repeat(10))
  assert.ok(long && long.length <= 160)
  assert.ok(long?.endsWith("…"))
  assert.ok(!long?.endsWith(" …") && !long?.endsWith(",…"))
})
