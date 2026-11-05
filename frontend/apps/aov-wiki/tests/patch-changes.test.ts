import assert from "node:assert/strict"
import test from "node:test"
import { changedSubjects, publishedNotesForSubject } from "../src/lib/published-change-subjects.ts"

test("catalog baselines do not create a changed patch or a row above the catalog", () => {
  const item = { id: "blade", code: "blade", displayName: "Blade" }
  assert.equal(changedSubjects([{ subject: item, changeKinds: ["DATA_BASELINE"] }]).size, 0)
  assert.deepEqual(
    [...changedSubjects([{ subject: item, changeKinds: ["BUFF"] }]).values()],
    [{ id: "blade", name: "Blade", kind: "BUFF" }],
  )
})

test("a seasonal row lists each subject once and preserves legacy removal events", () => {
  const talent = { id: "talent", code: "talent" }
  const result = changedSubjects([
    { spellId: "talent", name: "Talent" },
    { subject: talent, changeKinds: ["REMOVED"] },
    { heroId: "hero", overallKind: "BUFF" },
    { heroId: "hero", overallKind: "NERF" },
    { heroId: "baseline" },
  ])
  assert.deepEqual(
    [...result.values()],
    [
      { id: "talent", name: "Talent", kind: "REMOVED" },
      { id: "hero", name: undefined, kind: "ADJUSTMENT" },
    ],
  )
})

test("entry updates show only its published gameplay notes and sourced legacy removals", () => {
  const subject = { id: "talent", code: "talent" }
  const note = { subject, confirmed: true, changeKinds: ["BUFF"], summary: "Shorter cooldown." }
  const removal = { spellId: "talent", sourceUrl: "https://example.com/patch" }
  assert.deepEqual(
    publishedNotesForSubject(
      [
        note,
        removal,
        { ...note, confirmed: false },
        { ...note, changeKinds: ["DATA_BASELINE"] },
        { ...note, subject: { id: "other", code: "other" } },
      ],
      "talent",
    ),
    [note, removal],
  )
})
