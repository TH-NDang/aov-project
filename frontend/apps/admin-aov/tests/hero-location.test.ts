import assert from "node:assert/strict"
import { test } from "node:test"
import { canonicalHeroUrl } from "../src/app/legacy-hero-redirect"

test("legacy hero links preserve comparison filters, import state and anchors without touching media routes", () => {
  assert.equal(
    canonicalHeroUrl("/publishing/airi", "?revision=old&compare=base&view=history", "#skill-1"),
    "/hero/airi?revision=old&compare=base&view=history#skill-1",
  )
  assert.equal(canonicalHeroUrl("/publishing/import", "?job=existing"), "/hero/import?job=existing")
  assert.equal(canonicalHeroUrl("/publishing"), "/hero")
  assert.equal(canonicalHeroUrl("/hero/media", "?tab=head"), "/hero/media?tab=head")
  assert.equal(canonicalHeroUrl("/publishing-media"), "/publishing-media")
})
import {
  closeHeroLocation,
  heroLocationId,
  heroPageLocation,
  openHeroLocation,
  patchHeroLocation,
  readHeroLocation,
  switchHeroLocation,
} from "../src/features/publishing/hero-location.ts"

test("opening and closing a hero retain list filters without mutating the current URL", () => {
  const original = new URLSearchParams(
    "season=s3&patch=baseline&hero=old&tab=media&skill=skill-1-1&skillLayout=flat&target=th-TH&compare=previous",
  )
  const next = openHeroLocation(original, "hero-42", "revision-2")
  assert.equal(next.get("hero"), "hero-42")
  assert.equal(next.get("revision"), "revision-2")
  assert.equal(next.get("tab"), null)
  assert.equal(next.get("skill"), null)
  assert.equal(next.get("skillLayout"), null)
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
    "hero=hero-42&season=s3&patch=baseline&ruleset=regional&view=history&tab=skills&skill=skill-2-1&skillLayout=flat&revision=revision-1&compare=revision-0&diff=split&changes=skills&unrelated=value",
  )
  const url = new URL(heroPageLocation("hero-42", params, "revision-2"), "http://localhost")
  assert.equal(url.pathname, "/hero/hero-42")
  assert.equal(url.searchParams.get("revision"), "revision-2")
  assert.equal(url.searchParams.get("view"), "history")
  assert.equal(url.searchParams.get("compare"), "revision-0")
  assert.equal(url.searchParams.get("diff"), "split")
  assert.equal(url.searchParams.get("ruleset"), "regional")
  assert.equal(url.searchParams.get("skill"), "skill-2-1")
  assert.equal(url.searchParams.get("skillLayout"), "flat")
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

test("switching heroes retains workspace and list context while dropping previous hero identities", () => {
  const original = new URLSearchParams(
    "hero=old&revision=old-revision&compare=old-base&diff=split&changes=skills&skill=skill-2-1&view=translations&tab=skills&skillLayout=flat&section=SKILLS&readLocale=vi-VN&locale=en-US&target=th-TH&source=zh-TW&ruleset=shared&season=s3&patch=baseline&q=dragon&sort=edited-desc&show=all",
  )
  const before = original.toString()
  const switched = switchHeroLocation(original, "hero-42")
  assert.equal(switched.get("hero"), "hero-42")
  for (const key of ["revision", "compare", "diff", "changes", "skill"]) assert.equal(switched.get(key), null)
  for (const key of [
    "view",
    "tab",
    "skillLayout",
    "section",
    "readLocale",
    "locale",
    "target",
    "source",
    "ruleset",
    "season",
    "patch",
    "q",
    "sort",
    "show",
  ])
    assert.equal(switched.get(key), original.get(key), `${key} must survive a hero switch`)
  assert.equal(original.toString(), before)
})

test("switching heroes can select their own revision and produce a full-page URL without stale comparison state", () => {
  const original = new URLSearchParams(
    "hero=old&revision=old-revision&compare=old-base&view=history&tab=skills&skill=skill-1-1&skillLayout=flat&readLocale=en-US&ruleset=shared&season=s3",
  )
  const switched = switchHeroLocation(original, "hero-42", "new-revision")
  assert.equal(switched.get("revision"), "new-revision")
  const full = new URL(heroPageLocation("hero-42", switched), "http://localhost")
  assert.equal(full.pathname, "/hero/hero-42")
  assert.equal(full.searchParams.get("revision"), "new-revision")
  assert.equal(full.searchParams.get("view"), "history")
  assert.equal(full.searchParams.get("skillLayout"), "flat")
  assert.equal(full.searchParams.get("readLocale"), "en-US")
  assert.equal(full.searchParams.get("ruleset"), "shared")
  for (const key of ["hero", "compare", "skill", "season"]) assert.equal(full.searchParams.get(key), null)
})
