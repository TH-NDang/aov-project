import assert from "node:assert/strict"
import { test } from "node:test"
import {
  contentBlockers,
  publicationPatchLink,
  publishBlockers,
  usesObservedStats,
  type PublishContent,
} from "../src/features/publishing/publish-rules"
import type { Content, Revision } from "../src/features/publishing/types"
import { fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"

const complete = (): Content => {
  const content = structuredClone(fixtureContent)
  content.MEDIA_BINDINGS!.bindings = { HEAD: "head", PORTRAIT: "portrait", SPLASH: "splash" }
  return content
}
const keys = (content: PublishContent, observed = false) => contentBlockers(content, observed).map(({ key }) => key)

test("a complete draft has no blockers and each gap points at its own section", () => {
  assert.deepEqual(keys(complete()), [])

  const noRoles = complete()
  noRoles.PROFILE!.roles = []
  assert.deepEqual(keys(noRoles), ["PROFILE"])

  const noText = complete()
  noText.PROFILE!.translations = []
  assert.deepEqual(keys(noText), ["PROFILE"])

  const unrated = complete()
  unrated.OVERVIEW_RATINGS = null
  assert.deepEqual(keys(unrated), ["OVERVIEW_RATINGS"])

  const noStats = complete()
  noStats.COMBAT_STATS = null
  assert.deepEqual(keys(noStats), ["COMBAT_STATS"])

  const noSkills = complete()
  noSkills.SKILLS!.skills = []
  assert.deepEqual(keys(noSkills), ["SKILLS"])

  const noSkins = complete()
  noSkins.SKINS = null
  assert.deepEqual(keys(noSkins), ["SKINS"])

  for (const role of ["HEAD", "PORTRAIT", "SPLASH"] as const) {
    const noImage = complete()
    delete noImage.MEDIA_BINDINGS!.bindings[role]
    assert.deepEqual(keys(noImage), ["MEDIA_BINDINGS"], role)
  }
})

test("ratings are checked for a scale and for every value on it, including values the database left empty", () => {
  const rated = complete().OVERVIEW_RATINGS!
  for (const change of [
    { scaleCode: null },
    { survivability: null },
    { attackDamage: Number.NaN },
    { skillEffects: -1 },
    { difficulty: 11 },
  ]) {
    const content: PublishContent = { ...complete(), OVERVIEW_RATINGS: { ...rated, ...change } }
    assert.deepEqual(keys(content), ["OVERVIEW_RATINGS"], JSON.stringify(change))
  }
  assert.deepEqual(keys({ ...complete(), OVERVIEW_RATINGS: { ...rated, difficulty: 0, survivability: 10 } }), [])
})

test("blank skill text blocks publishing, while screenshots can stand in for missing stats", () => {
  const blank = complete()
  blank.SKILLS!.skills[0].translations[0].description = "   "
  assert.deepEqual(keys(blank), ["SKILLS"])

  const noName = complete()
  noName.SKILLS!.skills[0].translations[0].name = " "
  assert.deepEqual(keys(noName), ["SKILLS"])

  const noValues = complete()
  noValues.COMBAT_STATS!.values = []
  assert.deepEqual(keys(noValues), ["COMBAT_STATS"])
  assert.deepEqual(keys(noValues, true), [])
})

test("the rules also accept the narrow draft the overview loads, without lore, effects or images", () => {
  const narrow: PublishContent = {
    PROFILE: { roles: ["MAGE"], translations: [{ locale: "vi-VN", name: "Airi" }] },
    OVERVIEW_RATINGS: {
      scaleCode: "GAME_OVERVIEW_10",
      survivability: 5,
      attackDamage: 5,
      skillEffects: 5,
      difficulty: 5,
    },
    COMBAT_STATS: { values: ["HP"] },
    SKILLS: { skills: [{ translations: [{ name: "Chiêu", description: "Mô tả" }] }] },
    SKINS: {},
    MEDIA_BINDINGS: { bindings: { HEAD: "a", PORTRAIT: "b", SPLASH: "c" } },
  }
  assert.deepEqual(contentBlockers(narrow), [])
})

const baseline: Revision = { ...fixtureRevision, cause: "DATA_BASELINE", effectiveFromPatchVariantId: "patch" }
const patch = {
  id: "patch",
  rulesetId: baseline.rulesetId,
  patchCode: "2026-10-30",
  status: "PUBLISHED",
  seasonId: "s",
}

test("the patch comes first among the blockers, in the words the header button shows", () => {
  const blocked = complete()
  blocked.SKINS = null
  const blockers = publishBlockers({
    revision: baseline,
    content: blocked,
    patch: { ...patch, status: "DRAFT" },
    patchLoading: false,
    observedStats: false,
  })
  assert.deepEqual(
    blockers.map(({ key }) => key),
    ["PATCH", "SKINS"],
  )
  assert.match(blockers[0].message, /xuất bản patch 2026-10-30/)
  assert.deepEqual(
    publishBlockers({ revision: baseline, content: complete(), patch, patchLoading: false, observedStats: false }),
    [],
  )
})

test("observed stats count only at the draft's own patch and only when no stat was entered", () => {
  const content = complete()
  const observation = {
    method: "MANUAL_VISUAL_TRANSCRIPTION",
    scope: "DISPLAYED_SNAPSHOT_NOT_LEVEL_ONE",
    values: { health: 3500 },
  }
  content.SKILLS!.skills[0].effects.push({
    effectType: "SOURCE_SNAPSHOT",
    metadata: { patchCode: patch.patchCode, observedAttributes: observation },
  })
  assert.equal(usesObservedStats(content, patch), false, "entered stats leave nothing to stand in for")
  content.COMBAT_STATS!.values = []
  assert.equal(usesObservedStats(content, patch), true)
  assert.equal(usesObservedStats(content, { patchCode: "another-patch" }), false)
  assert.equal(usesObservedStats(content, undefined), false)
})

test("only a draft patch of the same ruleset links to where it can be published", () => {
  assert.equal(publicationPatchLink(baseline, patch), undefined)
  assert.equal(publicationPatchLink(baseline, undefined), undefined)
  assert.equal(publicationPatchLink(baseline, { ...patch, status: "DRAFT", rulesetId: "other" }), undefined)
  assert.deepEqual(publicationPatchLink(baseline, { ...patch, status: "DRAFT" }), {
    to: "/game-configuration?season=s&patch=patch",
    code: "2026-10-30",
  })
})
