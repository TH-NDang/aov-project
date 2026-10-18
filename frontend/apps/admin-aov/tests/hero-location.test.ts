import assert from "node:assert/strict"
import { test } from "node:test"
import {
  closeHeroLocation,
  heroLocationId,
  heroPageLocation,
  openHeroLocation,
  patchHeroLocation,
  readHeroLocation,
} from "../src/features/publishing/hero-location.ts"

test("opening and closing a hero retain list filters without mutating the current URL", () => {
  const original = new URLSearchParams("season=s3&patch=baseline&hero=old&tab=media&target=th-TH&compare=previous")
  const next = openHeroLocation(original, "hero-42", "revision-2")
  assert.equal(next.get("hero"), "hero-42")
  assert.equal(next.get("revision"), "revision-2")
  assert.equal(next.get("tab"), null)
  assert.equal(next.get("target"), null)
  assert.equal(next.get("compare"), null)
  assert.equal(original.get("hero"), "old")
  assert.equal(closeHeroLocation(next).toString(), "season=s3&patch=baseline")
})

test("hero URL restores both tab levels and independent reading and translation languages", () => {
  const params = new URLSearchParams(
    "view=translations&tab=skills&section=SKILLS&readLocale=vi-VN&target=th-TH&source=en-US",
  )
  assert.deepEqual(readHeroLocation(params), {
    view: "translations",
    tab: "skills",
    section: "SKILLS",
    readLocale: "vi-VN",
    targetLocale: "th-TH",
    sourceLocale: "en-US",
  })
  const reading = patchHeroLocation(params, { view: "overview" })
  assert.equal(readHeroLocation(reading).tab, "skills")
  assert.equal(readHeroLocation(reading).readLocale, "vi-VN")
  assert.equal(readHeroLocation(reading).targetLocale, "th-TH")
  assert.equal(readHeroLocation(new URLSearchParams("locale=en-US"), true).targetLocale, "en-US")
  assert.equal(readHeroLocation(new URLSearchParams("locale=en-US"), true).readLocale, "vi-VN")
})

test("full-page links carry hero navigation and comparison state without list-only parameters", () => {
  const params = new URLSearchParams(
    "hero=hero-42&season=s3&patch=baseline&view=history&tab=media&revision=revision-1&compare=revision-0&diff=split&changes=skills&unrelated=value",
  )
  const url = new URL(heroPageLocation("hero-42", params, "revision-2"), "http://localhost")
  assert.equal(url.pathname, "/publishing/hero-42")
  assert.equal(url.searchParams.get("revision"), "revision-2")
  assert.equal(url.searchParams.get("view"), "history")
  assert.equal(url.searchParams.get("compare"), "revision-0")
  assert.equal(url.searchParams.get("diff"), "split")
  assert.equal(url.searchParams.get("hero"), null)
  assert.equal(url.searchParams.get("season"), null)
  assert.equal(url.searchParams.get("unrelated"), null)
})

test("unknown tabs and invalid identities are ignored safely", () => {
  const state = readHeroLocation(
    new URLSearchParams("view=invalid&tab=invalid&section=INVALID&target=invalid&readLocale=invalid"),
  )
  assert.equal(state.view, "overview")
  assert.equal(state.tab, "overview")
  assert.equal(state.section, "PROFILE")
  assert.equal(state.targetLocale, "en-US")
  assert.equal(state.readLocale, "vi-VN")
  assert.equal(heroLocationId("6001c409-56b5-42f3-b51d-8163d58c2e90"), "6001c409-56b5-42f3-b51d-8163d58c2e90")
  for (const value of [null, "", "../admin", "/heroes", "id?query", "id#hash", "x".repeat(129)]) {
    assert.equal(heroLocationId(value), "")
  }
})
