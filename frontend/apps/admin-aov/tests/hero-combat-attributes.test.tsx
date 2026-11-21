import assert from "node:assert/strict"
import { test } from "node:test"
import { fixtureContent } from "./fixtures/hero-workspace-data"
import type { StatDefault } from "../src/features/publishing/model/assessment/combat-attributes"
import { withView } from "./fixtures/hero-skills-view"

test("combat attributes keep observed crit damage, patch defaults and explicit overrides distinct", async () => {
  await withView(async ({ document, render }) => {
    const { HeroCombatAttributes } =
      await import("../src/features/publishing/components/assessment/hero-combat-attributes")
    const skills = structuredClone(fixtureContent.SKILLS!)
    const values = {
      criticalChancePercent: 0,
      criticalDamagePercent: 200,
      physicalDefense: 140,
      physicalDefensePercent: 0,
    }
    skills.skills[0].effects.push({
      effectType: "SOURCE_SNAPSHOT",
      metadata: {
        patchCode: "s4",
        observedAttributes: {
          scope: "DISPLAYED_SNAPSHOT_NOT_LEVEL_ONE",
          method: "MANUAL_VISUAL_TRANSCRIPTION",
          values,
        },
      },
    })
    const rule: StatDefault = {
      statKey: "CRITICAL_DAMAGE",
      baseValue: 200,
      unit: "PERCENT",
      sourceUrl: "https://example.com/source",
      variantId: "v",
      patchCode: "s4",
      version: 1,
    }
    const mount = (patchCode: string, baseValue?: number) =>
      render(
        <HeroCombatAttributes
          skills={skills}
          stats={
            baseValue === undefined
              ? null
              : {
                  values: [{ statKey: "CRITICAL_DAMAGE", unit: "PERCENT", baseValue }],
                  sources: [],
                }
          }
          defaults={patchCode === "s4" ? [rule] : []}
          patchCode={patchCode}
        />,
      )
    const valueOf = (label: string) =>
      Array.from(document.querySelectorAll("dt")).find((dt) => dt.textContent === label)?.nextElementSibling
        ?.textContent

    await mount("s4")
    assert.match(valueOf("Giáp")!, /140 \| 0%/)
    assert.match(valueOf("Tỷ lệ chí mạng")!, /^0%/)
    assert.match(valueOf("Sát thương chí mạng")!, /200%.*Khớp mặc định/)
    assert.match(valueOf("Công vật lý")!, /Chưa ghi nhận/)
    values.criticalDamagePercent = 175
    await mount("s4")
    assert.match(valueOf("Sát thương chí mạng")!, /175%.*Mặc định 200%/)
    await mount("s4", 180)
    assert.match(valueOf("Sát thương chí mạng")!, /180%.*Giá trị riêng.*Ảnh ghi 175%/)
    await mount("s3")
    assert.equal(valueOf("Sát thương chí mạng"), undefined)
    assert.doesNotMatch(document.body.textContent!, /175%/)
  })
})

test("attack summary follows roles and active skill scaling while full details keep both stats", async () => {
  await withView(async ({ document, render, click }) => {
    const { HeroCombatAttributes } =
      await import("../src/features/publishing/components/assessment/hero-combat-attributes")
    const skills = structuredClone(fixtureContent.SKILLS!)
    const skill = skills.skills[0]
    skill.kind = "ACTIVE"
    // The whole list lives in the attributes window; it stays open while the roles change.
    const fullList = async () => {
      if (!document.querySelector('[role="dialog"]'))
        await click(document.querySelector<HTMLButtonElement>("button[data-review-attributes]")!)
      return document.querySelector('[role="dialog"]')!.textContent!
    }
    const stats = {
      values: [
        { statKey: "ATTACK_DAMAGE", baseValue: 176, unit: "POINT" },
        { statKey: "ABILITY_POWER", baseValue: 0, unit: "POINT" },
      ],
      sources: [],
    }
    const mount = async (roles: NonNullable<typeof fixtureContent.PROFILE>["roles"], text: string) => {
      skill.translations[0].description = text
      await render(<HeroCombatAttributes stats={stats} skills={skills} roles={roles} />)
      const list = await fullList()
      assert.match(list, /Công vật lý/)
      assert.match(list, /Công phép/)
      return Array.from(
        document.querySelectorAll('dl[aria-label="Thuộc tính nổi bật theo vai trò"] dt'),
        (el) => el.textContent,
      )
    }
    assert.deepEqual(await mount(["SUPPORT"], "(+25% Công phép)"), ["Công phép"])
    assert.deepEqual(await mount(["SUPPORT", "TANK"], "(+80%Công vật lý)"), ["Công vật lý"])
    assert.deepEqual(await mount(["MAGE", "ASSASSIN"], ""), ["Công phép"])
    assert.deepEqual(await mount(["MARKSMAN"], ""), ["Công vật lý"])
    assert.deepEqual(await mount(["ASSASSIN"], "(+20% công phép)"), ["Công phép"])
    assert.deepEqual(await mount(["SUPPORT"], "(+15%Công vật lý) (+20%Công phép)"), ["Công vật lý", "Công phép"])
    assert.deepEqual(await mount([], ""), ["Công vật lý", "Công phép"])
  })
})
