import assert from "node:assert/strict"
import { test } from "node:test"
import { traitSkillNotes } from "../src/features/hero/model/hero-trait-skills.ts"

const skills = [
  { skillKey: "skill-2-1", name: "Ảnh biến" },
  { skillKey: "skill-3-1", name: "Bão phi tiêu" },
]

test("each part of the note goes to the skill it starts with, without the name and the brackets", () => {
  assert.deepEqual(traitSkillNotes("Ảnh biến (hồi chiêu 6 giây); Bão phi tiêu (hồi chiêu 50 giây)", skills), {
    skills: [
      { skillKey: "skill-2-1", note: "hồi chiêu 6 giây" },
      { skillKey: "skill-3-1", note: "hồi chiêu 50 giây" },
    ],
    rest: null,
  })
})

test("a part that names no skill stays as the rest of the note", () => {
  assert.deepEqual(traitSkillNotes("Lướt qua tường khi trúng tướng", skills), {
    skills: [
      { skillKey: "skill-2-1", note: null },
      { skillKey: "skill-3-1", note: null },
    ],
    rest: "Lướt qua tường khi trúng tướng",
  })
})

test("a skill without a note is still listed", () => {
  assert.deepEqual(traitSkillNotes(null, skills).skills, [
    { skillKey: "skill-2-1", note: null },
    { skillKey: "skill-3-1", note: null },
  ])
})

test("the name matches whatever its case", () => {
  assert.equal(traitSkillNotes("ảnh biến: lướt hai lần", skills).skills[0]?.note, "lướt hai lần")
})
