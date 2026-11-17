import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { fixtureContent } from "./fixtures/hero-workspace-data"
import { changedRows } from "../src/features/publishing/components/patch-changes/hero-draft-changes"
import { comparisonPathLabels } from "../src/features/publishing/model/assessment/hero-comparison"
import { buildSkillComparison } from "../src/features/publishing/model/skills/hero-skill-comparison"
import {
  missingTranslationFields,
  sectionTextFields,
  translatedText,
  translationFieldLabel,
  translationStatus,
} from "../src/features/publishing/model/hero-translation-model"
import { heroWorkingSchema } from "../src/features/publishing/model/hero-working-copy"
import type { HeroComparison } from "../src/features/publishing/api/publishing-api"
import {
  SKILL_SUMMARY_LIMIT,
  SkillSummaryField,
  SkillSummaryText,
  singleParagraph,
  summaryValue,
} from "../src/features/publishing/components/skills/skill-summary-field"
import { updateTranslation } from "../src/features/publishing/components/translation-editor"
import type { Revision, Skill, Skills } from "../src/features/publishing/api/types"

// Source files compile with the classic JSX runtime in tests, as in the other rendering tests.
Object.defineProperty(globalThis, "React", { configurable: true, writable: true, value: React })

const summary = "Lướt tới, hất tung mục tiêu và gây sát thương vật lý."
const skill = (text: string | null | undefined, description = "Mô tả đầy đủ của game."): Skill => ({
  skillKey: "skill-1-1",
  kind: "ACTIVE",
  formKey: null,
  displayOrder: 1,
  iconAssetId: null,
  translations: [
    { locale: "vi-VN", name: "Bồi thẩm đoàn", description, ...(text === undefined ? {} : { summary: text }) },
  ],
  effects: [],
})

test("a summary is one paragraph and an emptied one is stored as none", () => {
  assert.equal(singleParagraph("Lướt tới.\r\n  Hất tung mục tiêu.\n"), "Lướt tới. Hất tung mục tiêu. ")
  assert.equal(singleParagraph(summary), summary)
  assert.equal(summaryValue("  "), null)
  assert.equal(summaryValue(""), null)
  assert.equal(summaryValue(summary), summary)
})

test("the summary box counts against the length the writing rule asks for and stops at the server's limit", () => {
  const render = (value: string) =>
    new JSDOM(renderToStaticMarkup(<SkillSummaryField value={value} onChange={() => {}} />)).window.document
  const short = render(summary)
  const box = short.querySelector("textarea")!
  assert.equal(box.getAttribute("maxlength"), String(SKILL_SUMMARY_LIMIT))
  assert.equal(short.querySelector("label")?.textContent, "Tóm tắt")
  assert.equal(short.querySelector("label")?.getAttribute("for"), box.id)
  assert.equal(short.getElementById(box.getAttribute("aria-describedby")!)?.textContent, `${summary.length}/200`)

  const long = render("a".repeat(201))
  assert.equal(long.querySelector("[id$='-count']")?.textContent, "Nên rút gọn · 201/200")
  const text = new JSDOM(renderToStaticMarkup(<SkillSummaryText text={summary} />)).window.document
  assert.match(text.body.textContent ?? "", /^Tóm tắt/)
  assert.ok(text.body.textContent?.includes(summary))
})

test("a skill's summary is translated like its other texts and named apart from a hero's introduction", () => {
  assert.deepEqual(sectionTextFields.SKILLS, ["name", "summary", "description"])
  assert.equal(translationFieldLabel("SKILLS", "summary"), "Tóm tắt")
  assert.equal(translationFieldLabel("PROFILE", "summary"), "Giới thiệu")
  assert.equal(translationFieldLabel("SKILLS", "description"), "Mô tả")

  const rows = [
    { locale: "vi-VN", name: "Bồi thẩm đoàn", description: "Mô tả nguồn", summary },
    { locale: "en-US", name: "Jury", description: "Source description", summary: null },
  ]
  assert.equal(translatedText(rows, "en-US", sectionTextFields.SKILLS)?.summary, summary)
  assert.deepEqual(missingTranslationFields(rows, "en-US", sectionTextFields.SKILLS), [
    { field: "summary", sourceLocale: "vi-VN" },
  ])

  const content = structuredClone(fixtureContent)
  const translated = { ...content.SKILLS!.skills[0].translations[0], locale: "en-US" }
  content.SKILLS!.skills[0].translations.push(translated)
  const before = translationStatus(content, "en-US").missing.filter((row) => row.section === "SKILLS")
  assert.deepEqual(before, [], "a skill without a summary in any language asks for none")
  content.SKILLS!.skills[0].translations[0].summary = summary
  assert.deepEqual(
    translationStatus(content, "en-US")
      .missing.filter((row) => row.section === "SKILLS")
      .map((row) => row.field),
    ["summary"],
  )
})

test("writing a summary in the translation editor touches only that language, and clearing it leaves none", () => {
  const skills: Skills = { skills: [skill(summary)], sources: [] }
  const english = updateTranslation("SKILLS", skills, "skill-1-1", "en-US", "summary", "Dashes in.") as Skills
  assert.deepEqual(english.skills[0].translations, [
    skills.skills[0].translations[0],
    { locale: "en-US", name: "", description: "", summary: "Dashes in." },
  ])
  const cleared = updateTranslation("SKILLS", english, "skill-1-1", "vi-VN", "summary", "  ") as Skills
  assert.equal(cleared.skills[0].translations[0].summary, null)
  assert.equal(cleared.skills[0].translations[0].description, "Mô tả đầy đủ của game.")
  assert.equal(cleared.skills[0].translations[1].summary, "Dashes in.")
})

test("a working copy restored from this device keeps the summaries it held", () => {
  const content = structuredClone(fixtureContent)
  content.SKILLS!.skills = [
    skill(summary),
    { ...skill(null), skillKey: "skill-2-1" },
    { ...skill(undefined), skillKey: "skill-3-1" },
  ]
  const restored = heroWorkingSchema.parse({ content, notes: {} })
  assert.deepEqual(
    restored.content.SKILLS!.skills.map((item) => item.translations[0].summary),
    [summary, null, undefined],
  )
  assert.deepEqual(restored.content.SKILLS, content.SKILLS)
})

test("comparing versions shows a summary change on its own row, apart from the description", () => {
  const compare = (before: Skill[], after: Skill[]): HeroComparison => ({
    status: "AVAILABLE",
    from: { id: "previous" } as Revision,
    to: { id: "current" } as Revision,
    before: { skills: { skills: before } },
    after: { skills: { skills: after } },
    changes: [],
    warnings: [],
  })
  const added = buildSkillComparison(compare([skill(null)], [skill(summary)]), "vi-VN")
  assert.equal(added.skills.length, 1)
  assert.deepEqual(added.skills[0].descriptions, [])
  assert.deepEqual(
    added.skills[0].rows.map(({ id, label, before, after }) => ({ id, label, before, after })),
    [{ id: "summary.vi-VN", label: "Tóm tắt (vi-VN)", before: null, after: summary }],
  )
  const untouched = buildSkillComparison(compare([skill(summary)], [skill(summary)]), "vi-VN")
  assert.deepEqual(untouched.skills, [])

  assert.deepEqual(
    comparisonPathLabels(
      "skills",
      "/skills/skill-1-1/translations/vi-VN/summary",
      [{ skills: { skills: [skill(summary)] } }],
      "vi-VN",
    ),
    ["Kỹ năng", "Bồi thẩm đoàn", "Bản dịch", "vi-VN", "Tóm tắt"],
  )
})

test("the unsaved changes of a skill name its summary as a summary", () => {
  const rows = changedRows({ skills: [skill(null)] }, { skills: [skill(summary)] }, "vi-VN", { summary: "Tóm tắt" })
  assert.deepEqual(rows, [
    { label: "Kỹ năng · Bồi thẩm đoàn · Bản dịch · vi-VN · Tóm tắt", field: "summary", before: null, after: summary },
  ])
  const profile = changedRows(
    { translations: [{ locale: "vi-VN", name: "Airi", summary: null }] },
    {
      translations: [{ locale: "vi-VN", name: "Airi", summary: "Sát thủ cơ động." }],
    },
    "vi-VN",
  )
  assert.equal(profile[0]?.label.endsWith("Giới thiệu"), true)
})
