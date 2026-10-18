import assert from "node:assert/strict"
import { test } from "node:test"
import { reconcileDraft } from "../src/app/drafts/draft-merge"
import { heroWorkingConflict, mergeHeroWorkingCopy } from "../src/features/publishing/hero-working-copy"
import { fixtureContent } from "./fixtures/hero-workspace-data"

test("three-way merge preserves remote changes to untouched fields and flags overlapping text edits", () => {
  const base = { name: "Airi", description: "Original" }
  assert.deepEqual(reconcileDraft(base, { ...base, name: "My name" }, { ...base, description: "New server text" }), {
    value: { name: "My name", description: "New server text" },
    conflict: false,
  })
  assert.deepEqual(reconcileDraft(base, { ...base, name: "Mine" }, { ...base, name: "Theirs" }), {
    value: { name: "Mine", description: "Original" },
    conflict: true,
  })
})

test("stable locale and skill identities keep edits independent of insertions and display order", () => {
  const base = [
    { locale: "vi-VN", name: "Việt" },
    { locale: "en-US", name: "English" },
  ]
  const local = [
    { locale: "vi-VN", name: "Việt" },
    { locale: "en-US", name: "My English" },
  ]
  const remote = [
    { locale: "th-TH", name: "Thai" },
    { locale: "en-US", name: "English" },
    { locale: "vi-VN", name: "Việt mới" },
  ]
  assert.deepEqual(reconcileDraft(base, local, remote), {
    value: [
      { locale: "th-TH", name: "Thai" },
      { locale: "en-US", name: "My English" },
      { locale: "vi-VN", name: "Việt mới" },
    ],
    conflict: false,
  })
  const deleted = reconcileDraft([{ skillKey: "one", name: "Old" }], [], [{ skillKey: "one", name: "Changed" }])
  assert.equal(deleted.conflict, true)
  assert.deepEqual(deleted.value, [])
})

test("duplicate identities and overlapping primitive arrays require review rather than guessed alignment", () => {
  const result = reconcileDraft(
    [{ locale: "en", name: "old" }],
    [
      { locale: "en", name: "one" },
      { locale: "en", name: "two" },
    ],
    [{ locale: "en", name: "server" }],
  )
  assert.equal(result.conflict, true)
  assert.equal(reconcileDraft([1], [2], [3]).conflict, true)
  assert.deepEqual(reconcileDraft(NaN, null, NaN), { value: null, conflict: false })
})

test("hero working copies retain remote skills and Vietnamese text while only the English translation is edited", () => {
  const base = { content: structuredClone(fixtureContent), notes: {} }
  base.content.PROFILE!.translations.push({ locale: "en-US", name: "English", title: null, summary: null, lore: null })
  const local = structuredClone(base)
  local.content.PROFILE!.translations[1].name = "My English"
  const remote = structuredClone(base)
  remote.content.PROFILE!.translations[0].name = "Tên Việt mới"
  remote.content.SKILLS!.skills[0].translations[0].description = "New server skill"
  assert.equal(heroWorkingConflict(base, local, remote), false)
  const merged = mergeHeroWorkingCopy(base, local, remote)
  assert.equal(merged.content.PROFILE!.translations[1].name, "My English")
  assert.equal(merged.content.PROFILE!.translations[0].name, "Tên Việt mới")
  assert.deepEqual(merged.content.SKILLS, remote.content.SKILLS)
})
