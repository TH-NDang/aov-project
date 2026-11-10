import assert from "node:assert/strict"
import { test } from "node:test"
import { groupSkillKit, skillCooldownRange, skillFormName } from "@aov/ui/lib/skill-kit"

const skill = (skillKey: string, displayOrder: number, extra: Record<string, unknown> = {}) => ({
  skillKey,
  kind: skillKey.startsWith("skill-0-") ? "PASSIVE" : "ACTIVE",
  displayOrder,
  ...extra,
})

test("the kit groups the forms of a slot and keeps other skills on their own", () => {
  const groups = groupSkillKit([
    skill("skill-1-1", 2),
    skill("skill-0-1", 1),
    skill("skill-1-2", 3, { formKey: "Viên đao" }),
    skill("capture-skill-2", 4),
    skill("skill-3-1", 5),
  ])
  assert.deepEqual(
    groups.map((group) => [group.key, group.skills.map((entry) => entry.skillKey)]),
    [
      ["skill:skill-0-1", ["skill-0-1"]],
      ["slot:1", ["skill-1-1", "skill-1-2"]],
      ["skill:capture-skill-2", ["capture-skill-2"]],
      ["skill:skill-3-1", ["skill-3-1"]],
    ],
  )
})

test("a variant is named by its form, otherwise by its number", () => {
  assert.equal(skillFormName(skill("skill-1-2", 1, { formKey: " Viên đao " })), "Viên đao")
  assert.equal(skillFormName(skill("skill-1-2", 1)), "Biến thể 2")
  assert.equal(
    skillFormName(skill("skill-1-3", 1), (n) => `Form ${n}`),
    "Form 3",
  )
  assert.equal(skillFormName(skill("capture-skill-1", 1)), "")
})

test("the cooldown range comes from the level table and stays single when every rank is the same", () => {
  const table = (values: unknown[], label = "Hồi chiêu") => ({
    effects: [
      { effectType: "SOURCE_SNAPSHOT", metadata: { levelTable: { rows: [{ label, display_values: values }] } } },
    ],
  })
  assert.equal(skillCooldownRange({ ...skill("skill-1-1", 1), ...table([7, 6.7, 6.4, 6.1, 5.8, 5.5]) }), "7s → 5.5s")
  assert.equal(skillCooldownRange({ ...skill("skill-1-1", 1), ...table(["10s", "10s"]) }), "10s")
  assert.equal(
    skillCooldownRange({ ...skill("skill-1-1", 1), ...table([12, 9], "<color=#C6633E>Hồi chiêu (giây)</color>") }),
    "12s → 9s",
  )
  assert.equal(skillCooldownRange({ ...skill("skill-1-1", 1), ...table([300, 400], "ST gốc") }), null)
  assert.equal(skillCooldownRange(skill("skill-1-1", 1)), null)
})
