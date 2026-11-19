import assert from "node:assert/strict"
import { test } from "node:test"
import type { Skill } from "@/lib/hero-types"
import { fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"
import {
  createEntityIndex,
  parseRichText,
  resolveEntityRoute,
  type EntityReference,
  type RichTextNode,
} from "@aov/ui/lib/entity-rich-text"
import { skill, withView } from "./fixtures/hero-skills-view"

test("hero descriptions resolve named and implicit skill slots in the viewed revision only", async () => {
  await withView(async () => {
    const { revisionSkillReferences } =
      await import("../src/features/publishing/model/skills/revision-skill-references")
    const revision = { ...fixtureRevision, heroId: "d3eedc27-7cfd-4f08-8f80-32df46a55719" }
    const content = structuredClone(fixtureContent)
    content.PROFILE!.translations[0].name = "Dolia"
    content.SKILLS!.skills = [skill("skill-1-1"), skill("skill-3-1"), { ...skill("passive"), kind: "PASSIVE" }]
    const translation = (name: string) => [{ locale: "vi-VN", name, description: "", aliases: [] }]
    const catalog: EntityReference[] = [
      { kind: "hero", id: revision.heroId, translations: [{ ...translation("Dolia")[0]!, aliases: ["Doli"] }] },
      { kind: "term", id: "noi-tai", translations: translation("Nội tại") },
      { kind: "hero", id: "airi", translations: translation("Airi") },
    ]
    const index = () =>
      createEntityIndex([...catalog, ...revisionSkillReferences(revision, content, [])], "vi-VN", "vi-VN")
    const references = (text: string) =>
      parseRichText(text, index()).filter(
        (node): node is Extract<RichTextNode, { type: "reference" }> =>
          node.type === "reference" && node.entity.kind === "skill",
      )
    const ultimate = references("Hãy cố gắng dùng chiêu cuối Dolia cho những chiêu quan trọng.")[0]!
    assert.equal(ultimate.label, "chiêu cuối Dolia")
    assert.equal(ultimate.entity.skillKey, "skill-3-1")
    assert.equal(references("doli chiêu cuối")[0]?.label, "doli chiêu cuối")
    assert.equal(references("Airi chiêu cuối").length, 0)
    assert.ok(resolveEntityRoute(ultimate.entity, "admin")!.includes(`revision=${revision.id}`))
    assert.deepEqual(
      references("Dùng chiêu 1 rồi kích hoạt nội tại.").map((n) => n.entity.skillKey),
      ["skill-1-1", "passive"],
    )
    assert.equal(references("nội tại của Dolia")[0]?.label, "nội tại của Dolia")
    assert.equal(references("chiêu cuối của đồng minh, chiêu 1 Airi, chiêu 12").length, 0)
    assert.equal(references("<noauto>chiêu cuối</noauto>").length, 0)
    assert.equal(parseRichText("chiêu cuối Dolia", index(), { autoRecognize: false })[0]?.type, "text")
    content.SKILLS!.skills.push(skill("skill-1-2"))
    assert.equal(references("chiêu 1 và chiêu 1 Dolia").length, 0)
  })
})

test("bracketed names link the matching revision skill and keep adjacent slot labels in a single reference", async () => {
  await withView(async () => {
    const { revisionSkillReferences } =
      await import("../src/features/publishing/model/skills/revision-skill-references")
    const revision = { ...fixtureRevision, heroId: "d3eedc27-7cfd-4f08-8f80-32df46a55719" }
    const content = structuredClone(fixtureContent)
    const namedSkill = (key: string, name: string): Skill => ({
      ...skill(key),
      translations: [{ locale: "vi-VN", name, description: "" }],
    })
    content.SKILLS!.skills = [
      namedSkill("skill-0-1", "Linh lực biển sâu"),
      namedSkill("skill-3-1", "Tiên cá thánh ca"),
      namedSkill("skill-1-1", "Dạng một"),
      namedSkill("skill-1-2", "Dạng hai"),
    ]
    const index = () => createEntityIndex(revisionSkillReferences(revision, content, []), "vi-VN", "vi-VN")
    const references = (text: string) =>
      parseRichText(text, index(), { firstOccurrenceOnly: true }).filter((node) => node.type === "reference")
    const sample = "<Linh lực biển sâu>, chiêu 3 <Tiên cá thánh ca> và <TIÊN CÁ\nTHÁNH CA>."
    assert.deepEqual(
      references(sample).map((node) => [node.label, node.entity.skillKey]),
      [
        ["<Linh lực biển sâu>", "skill-0-1"],
        ["chiêu 3 <Tiên cá thánh ca>", "skill-3-1"],
        ["<TIÊN CÁ\nTHÁNH CA>", "skill-3-1"],
      ],
    )
    assert.equal(references("chiêu 1 <Dạng hai>")[0]?.entity.skillKey, "skill-1-2")
    assert.deepEqual(references("Tiên cá thánh ca, <Thanh máu ảo>, <noauto><Linh lực biển sâu></noauto>"), [])
    const colored = parseRichText("<color=#D0B88E><Linh lực biển sâu></color>", index())[0]
    assert.equal(colored?.type === "color" && colored.children[0]?.type, "reference")
    content.SKILLS!.skills.push(namedSkill("skill-1-3", "Dạng hai"))
    assert.deepEqual(references("chiêu 1 <Dạng hai>, <Dạng hai>"), [])
  })
})
