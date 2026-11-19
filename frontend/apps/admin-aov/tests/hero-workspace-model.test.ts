import assert from "node:assert/strict"
import { test } from "node:test"
import type { PublicationOverview } from "../src/features/publishing/api/publication-overview"
import {
  canMoveBaseline,
  canRecordPatchChanges,
  changeNoteKey,
  defaultRevision,
  fallbackReadLocale,
  headerActionOf,
  profileEditFields,
  switchedHeroRevision,
  versionPatchLabel,
  withChangeNote,
} from "../src/features/publishing/model/hero-workspace-model"
import type { Revision } from "@/lib/hero-types"
import { fixtureRevision } from "./fixtures/hero-workspace-data"

const version = (id: string, patch: Partial<Revision> = {}): Revision => ({ ...fixtureRevision, id, ...patch })
const draft = version("draft", { revisionNo: 3 })
const published = version("published", { state: "PUBLISHED", revisionNo: 2 })
const discarded = version("discarded", { state: "DISCARDED", revisionNo: 1 })

const variant = (id: string, rulesetOrdinal: number) => ({
  id,
  patchId: id,
  patchCode: id,
  rulesetId: fixtureRevision.rulesetId,
  rulesetOrdinal,
  status: "PUBLISHED" as const,
  seasonId: "season",
})
const overview = {
  variants: [variant("patch-1", 1), variant("patch-2", 2)],
  seasons: [],
} as unknown as PublicationOverview

test("a hero opened without a version shows its draft first", () => {
  assert.equal(defaultRevision([discarded, published, draft]), draft)
})

test("a hero without a draft opens on its published version", () => {
  assert.equal(defaultRevision([discarded, published]), published)
})

test("a hero with neither a draft nor a published version opens on the first version listed", () => {
  assert.equal(defaultRevision([discarded]), discarded)
})

test("another hero opens on the version the catalog scope shows", () => {
  const before = version("before", { state: "PUBLISHED", effectiveFromPatchVariantId: "patch-1" })
  const after = version("after", { revisionNo: 2, effectiveFromPatchVariantId: "patch-2" })
  const hero = { revisions: [before, after] }

  assert.equal(switchedHeroRevision(hero, overview, { seasonId: "", variantId: "patch-1" }, ""), before)
})

test("another hero without a version in scope opens on its newest kept version of the ruleset", () => {
  const otherRuleset = version("other", { revisionNo: 9, rulesetId: "other-rules" })
  const hero = { revisions: [published, version("thrown-away", { state: "DISCARDED", revisionNo: 8 }), otherRuleset] }

  const opened = switchedHeroRevision(hero, overview, { seasonId: "gone", variantId: "" }, fixtureRevision.rulesetId)

  assert.equal(opened, published)
})

test("a hero that has the reading language keeps it", () => {
  assert.equal(fallbackReadLocale(["vi-VN", "th-TH"], "th-TH"), undefined)
})

test("a hero without the reading language reads in English before Vietnamese", () => {
  assert.equal(fallbackReadLocale(["vi-VN", "en-US"], "th-TH"), "en-US")
})

test("a hero with neither English nor Vietnamese reads in its first language", () => {
  assert.equal(fallbackReadLocale(["zh-TW", "th-TH"], "id-ID"), "zh-TW")
})

test("editing the lore keeps its change note apart from the rest of the profile", () => {
  assert.equal(changeNoteKey(true, "PROFILE", "lore"), "PROFILE_LORE")
  assert.equal(changeNoteKey(true, "PROFILE", "information"), "PROFILE")
  assert.equal(changeNoteKey(false, "PROFILE", "lore"), "PROFILE")
})

test("a change note is set under its key and an empty one is taken out", () => {
  const notes = { SKILLS: "Kept" }

  assert.deepEqual(withChangeNote(notes, "PROFILE", "New"), { SKILLS: "Kept", PROFILE: "New" })
  assert.deepEqual(withChangeNote({ ...notes, PROFILE: "Old" }, "PROFILE", ""), notes)
  assert.deepEqual(notes, { SKILLS: "Kept" }, "The notes given are left as they were")
})

test("a form's profile asks for no title, since its holder shares one", () => {
  assert.deepEqual(profileEditFields("information", true), ["name", "summary"])
  assert.deepEqual(profileEditFields("information", false), ["name", "title", "summary"])
  assert.deepEqual(profileEditFields("lore", false), ["lore"])
})

test("an imported baseline may move to another patch until its ruleset has a published version", () => {
  assert.equal(canMoveBaseline(draft, [draft]), true)
  assert.equal(canMoveBaseline(draft, [draft, published]), false)
  assert.equal(canMoveBaseline(draft, [draft, version("elsewhere", { state: "PUBLISHED", rulesetId: "other" })]), true)
})

test("only a baseline that started the hero's history may move", () => {
  assert.equal(canMoveBaseline({ ...draft, sourceRevisionId: "earlier" }, [draft]), false)
  assert.equal(canMoveBaseline({ ...draft, cause: "CONTENT_CORRECTION" }, [draft]), false)
  assert.equal(canMoveBaseline(undefined, [draft]), false)
})

test("gameplay changes are recorded only on a published version a game patch brought", () => {
  const patched = version("patched", {
    state: "PUBLISHED",
    cause: "GAME_PATCH",
    effectiveFromPatchVariantId: "patch-2",
  })

  assert.equal(canRecordPatchChanges(patched), true)
  assert.equal(canRecordPatchChanges({ ...patched, state: "DRAFT" }), false)
  assert.equal(canRecordPatchChanges({ ...patched, effectiveFromPatchVariantId: null }), false)
  assert.equal(canRecordPatchChanges({ ...patched, cause: "CONTENT_CORRECTION" }), false)
})

test("the header offers publishing a draft and a pencil on a published version", () => {
  assert.equal(headerActionOf(draft, true, true), "publish")
  assert.equal(headerActionOf(draft, false, true), null)
  assert.equal(headerActionOf(published, true, true), "draft")
  assert.equal(headerActionOf(published, true, false), null)
  assert.equal(headerActionOf(discarded, true, true), null)
})

test("a version's patch names its title and its code once each", () => {
  assert.equal(versionPatchLabel({ patchTitle: "Mùa mới", patchCode: "2026-11" }), "Mùa mới · 2026-11")
  assert.equal(versionPatchLabel({ patchTitle: "2026-11", patchCode: "2026-11" }), "2026-11")
  assert.equal(versionPatchLabel({ patchTitle: null, patchCode: "2026-11" }), "2026-11")
  assert.equal(versionPatchLabel(undefined), "Chưa rõ patch")
})
