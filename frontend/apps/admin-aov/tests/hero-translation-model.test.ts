import assert from "node:assert/strict"
import { test } from "node:test"
import { fixtureContent } from "./fixtures/hero-workspace-data"
import {
  missingTranslationFields,
  sectionTextFields,
  translatedText,
  translationStatus,
  translationStatusLabel,
} from "../src/features/publishing/hero-translation-model"

test("translation coverage requires all populated source fields and ignores fields without a source", () => {
  const content = structuredClone(fixtureContent)
  content.PROFILE!.translations[0].lore = null
  content.PROFILE!.translations.push({ locale: "en-US", name: "Airi", title: null, summary: "", lore: null })
  const progress = translationStatus(content, "en-US")
  assert.equal(progress.profile, false)
  assert.equal(progress.completedFields, 1)
  assert.equal(progress.totalFields, 6)
  assert.deepEqual(
    progress.missing.filter((row) => row.section === "PROFILE").map((row) => row.field),
    ["title", "summary"],
  )
  assert.match(translationStatusLabel(progress), /Đã dịch một phần/)
})

test("fallback text stays readable without counting as a translation or changing source data", () => {
  const rows = [
    { locale: "vi-VN", name: "Nội tại", description: "Mô tả nguồn" },
    { locale: "en-US", name: "Passive", description: " " },
  ]
  const original = structuredClone(rows)
  assert.equal(translatedText(rows, "en-US", sectionTextFields.SKILLS)?.description, "Mô tả nguồn")
  assert.deepEqual(missingTranslationFields(rows, "en-US", sectionTextFields.SKILLS), [
    { field: "description", sourceLocale: "vi-VN" },
  ])
  assert.deepEqual(rows, original)
})

test("each revision computes its own missing fields and no text means no source progress", () => {
  const older = structuredClone(fixtureContent)
  older.PROFILE!.translations.push({ ...older.PROFILE!.translations[0], locale: "en-US" })
  for (const skill of older.SKILLS!.skills) skill.translations.push({ ...skill.translations[0], locale: "en-US" })
  for (const skin of older.SKINS!.skins) skin.translations.push({ ...skin.translations[0], locale: "en-US" })
  assert.equal(translationStatus(older, "en-US").missing.length, 0)
  const newer = structuredClone(older)
  newer.SKILLS!.skills.push({
    ...structuredClone(newer.SKILLS!.skills[0]),
    skillKey: "alternate",
    translations: [{ locale: "vi-VN", name: "Dạng khác", description: "Mô tả khác" }],
  })
  assert.deepEqual(
    translationStatus(newer, "en-US").missing.map(({ key, field }) => [key, field]),
    [
      ["alternate", "name"],
      ["alternate", "description"],
    ],
  )
  assert.equal(translationStatus(older, "en-US").missing.length, 0)
  const empty = {
    PROFILE: null,
    SKILLS: null,
    SKINS: null,
    MEDIA_BINDINGS: null,
    COMBAT_STATS: null,
    OVERVIEW_RATINGS: null,
  }
  assert.equal(translationStatusLabel(translationStatus(empty, "en-US")), "Chưa có nội dung nguồn")
})

test("empty translation records do not imply availability and sources may come from another language", () => {
  const content = structuredClone(fixtureContent)
  content.PROFILE!.translations = [
    { locale: "en-US", name: "Airi", title: null, summary: "English source", lore: null },
    { locale: "th-TH", name: "", title: null, summary: null, lore: null },
  ]
  const progress = translationStatus(content, "th-TH")
  assert.equal(progress.exists, false)
  assert.equal(progress.missing.find((row) => row.field === "summary")?.sourceLocale, "en-US")
  assert.equal(translationStatusLabel(progress), "Chưa có bản dịch")
})
