import assert from "node:assert/strict"
import { test } from "node:test"
import {
  selectSkillTranslation,
  skillLabel,
  skillSlot,
  skillVariant,
  skillVariantLabel,
  groupHeroSkills,
} from "../src/features/publishing/model/skills/hero-skills"
import { skill, withView } from "./fixtures/hero-skills-view"

test("skill labels use stable source slots and translations fall back without inventing text", () => {
  const value = skill("skill-3-2")
  value.translations.push({ locale: "en-US", name: "English skill", description: "English description" })
  assert.equal(selectSkillTranslation(value, "en-US")?.description, "English description")
  assert.equal(selectSkillTranslation(value, "th-TH")?.locale, "vi-VN")
  assert.equal(skillSlot(value), 3)
  assert.equal(skillVariant(value), 2)
  assert.equal(skillLabel(value), "Chiêu 3")
  assert.equal(skillVariantLabel(value, [value]), undefined)
  const otherVariant = skill("skill-3-1")
  assert.equal(skillVariantLabel(value, [value, otherVariant]), "Biến thể 2")
  assert.equal(skillVariantLabel(otherVariant, [value, otherVariant]), "Biến thể 1")
  assert.equal(skillVariantLabel({ ...value, formKey: "known-form" }, [value, otherVariant]), undefined)
  const unknownCapture = skill("capture-unknown")
  unknownCapture.effects = [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 3 } }]
  assert.deepEqual(
    groupHeroSkills([value, otherVariant, unknownCapture]).map((group) =>
      group.skills.map((member) => member.skillKey),
    ),
    [[value.skillKey, otherVariant.skillKey], [unknownCapture.skillKey]],
  )
  assert.equal(
    groupHeroSkills([otherVariant, skill("skill-3-01")]).length,
    2,
    "Ambiguous variant numbers remain separate",
  )
  const custom = skill("stable-custom-key")
  custom.effects = [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 4 } }]
  assert.equal(skillSlot(custom), 4)
  assert.equal(skillVariant(custom), null)
  assert.equal(skillLabel(custom), "Chiêu 4")
  custom.kind = "PASSIVE"
  assert.equal(skillLabel(custom), "Nội tại")
  custom.translations = []
  assert.equal(selectSkillTranslation(custom, "th-TH"), undefined)
  const opaque = skill("skill-unknown")
  assert.equal(skillSlot(opaque), null)
  assert.equal(skillVariant(opaque), null)
})

test("only the selected skill mounts its description and duplicate names preserve form identity across reorders", async () => {
  await withView(async ({ document, HeroSkillsView, render, click }) => {
    const passive = { ...skill("skill-0-1", 0), kind: "PASSIVE" as const }
    const human = skill("skill-2-1", 1, "human")
    const fox = skill("skill-2-2", 2, "fox")
    const skills = [fox, human, passive]
    const details = () => document.querySelector('[aria-label="Chi tiết kỹ năng"]')!
    const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Chọn kỹ năng"] button')]
    await render(<HeroSkillsView skills={skills} locale="vi-VN" heroId="view-hero" />)
    assert.match(details().textContent!, /Nội dung riêng skill-0-1/)
    assert.doesNotMatch(document.body.textContent!, /Nội dung riêng skill-2-1|Nội dung riêng skill-2-2/)
    assert.equal(buttons().length, 2, "Verified variants share one stacked selector")
    await click(buttons().find((button) => button.getAttribute("aria-label")?.endsWith(" · 2 biến thể"))!)
    const states = () => [
      ...document.querySelectorAll<HTMLButtonElement>('[aria-label="Chuyển biến thể kỹ năng"] button'),
    ]
    const foxButton = states().find((button) => button.getAttribute("aria-label")?.startsWith("fox ·"))!
    foxButton.focus()
    await click(foxButton)
    assert.equal(document.activeElement, foxButton, "Changing a variant preserves keyboard focus")
    assert.match(details().textContent!, /Nội dung riêng skill-2-2/)
    assert.doesNotMatch(details().textContent!, /Nội dung riêng skill-2-1/)
    await click(states().find((button) => button.getAttribute("aria-label")?.startsWith("human ·"))!)
    assert.match(details().textContent!, /Nội dung riêng skill-2-1/)
    await render(
      <HeroSkillsView
        skills={[
          { ...fox, displayOrder: 0 },
          { ...human, displayOrder: 8 },
          { ...passive, displayOrder: 10 },
        ]}
        locale="vi-VN"
        heroId="view-hero"
      />,
    )
    assert.match(details().textContent!, /Nội dung riêng skill-2-1/)
    assert.equal(
      states()
        .find((button) => button.getAttribute("aria-pressed") === "true")
        ?.getAttribute("aria-label")
        ?.startsWith("human ·"),
      true,
    )
    await render(<HeroSkillsView skills={[fox, passive]} locale="vi-VN" heroId="view-hero" />)
    assert.match(details().textContent!, /Nội dung riêng skill-0-1/)
  })
})

test("fallback copy is explicit and skill level labels, zero costs and collapsed provenance remain faithful to source", async () => {
  await withView(async ({ document, HeroSkillsView, render }) => {
    const value = skill("skill-2-1")
    value.effects = [
      {
        effectType: "SOURCE_SNAPSHOT",
        metadata: {
          sourceSlot: 2,
          cooldown: { seconds: 0 },
          energyCost: { value: 0 },
          levelTable: {
            column_labels: ["Lv 1", "Lv 2", "Lv 3"],
            rows: [{ label: "Sát thương", display_values: ["100", "150", "200"] }],
          },
          reviewFlags: [{ type: "not_visible_in_source", note: "Thiếu dữ liệu dạng thứ hai" }],
          sourceImageUrl: "https://source.example/skill.png",
        },
      },
    ]
    await render(<HeroSkillsView skills={[value]} locale="th-TH" heroId="view-hero" />)
    const details = document.querySelector('[aria-label="Chi tiết kỹ năng"]')!
    assert.match(details.textContent!, /Chưa dịch/)
    assert.equal(document.querySelector('[aria-label="Nội dung chưa dịch"]'), null)
    assert.match(details.textContent!, /Hồi chiêu: 0 giây/)
    assert.match(details.textContent!, /Tiêu hao: 0/)
    assert.deepEqual(
      [...details.querySelectorAll("thead th")].map((node) => node.textContent),
      ["Thông số", "Cấp 1", "Cấp 2", "Cấp 3", "Tổng quan"],
    )
    assert.deepEqual(
      [...details.querySelectorAll("tbody td")].map((node) => node.textContent),
      ["100", "150", "200", "100 (+50/cấp chiêu)"],
    )
    const source = details.querySelector("details")!
    assert.equal(source.open, false)
    assert.match(source.querySelector("summary")!.textContent!, /Nguồn & đối chiếu/)
    assert.equal(source.querySelector("a")!.href, "https://source.example/skill.png")
    await render(
      <HeroSkillsView
        skills={[{ ...value, translations: [{ locale: "vi-VN", name: "Chưa đủ", description: "" }] }]}
        locale="th-TH"
        heroId="view-hero"
      />,
    )
    assert.match(details.textContent!, /Chưa có mô tả kỹ năng bằng vi-VN/)
    await render(<HeroSkillsView skills={[{ ...value, translations: [] }]} locale="th-TH" heroId="view-hero" />)
    assert.match(details.textContent!, /Chưa có mô tả kỹ năng bằng th-TH/)
  })
})

test("many source variants remain distinguishable and selected keys scroll only their compact selector", async () => {
  await withView(async ({ dom, document, HeroSkillsView, render }) => {
    const skills = [
      ...Array.from({ length: 15 }, (_, index) => skill(`skill-${Math.floor(index / 3)}-${(index % 3) + 1}`, index)),
      ...Array.from({ length: 3 }, (_, index) => skill(`capture-${index}`, index + 15)),
    ]
    const snapshot = structuredClone(skills)
    const show = (selectedSkillKey: string) =>
      render(<HeroSkillsView skills={skills} locale="vi-VN" selectedSkillKey={selectedSkillKey} />)
    await show("skill-1-2")
    const details = () => document.querySelector('[aria-label="Chi tiết kỹ năng"]')!
    const rail = document.querySelector<HTMLElement>('[aria-label="Chọn kỹ năng"]')!
    const buttons = [...rail.querySelectorAll<HTMLButtonElement>("button")]
    assert.equal(buttons.length, 8, "Three standalone captures and five verified slot groups remain")
    assert.equal(buttons.filter((button) => button.getAttribute("aria-label")?.endsWith(" · 3 biến thể")).length, 5)
    assert.equal(document.querySelectorAll('[aria-label="Chuyển biến thể kỹ năng"] button').length, 3)
    assert.ok(
      document.querySelector(
        '[aria-label="Chuyển biến thể kỹ năng"] [aria-label^="Biến thể 2 ·"][aria-pressed="true"]',
      ),
    )
    assert.match(details().textContent!, /Nội dung riêng skill-1-2/)
    assert.match(details().textContent!, /Biến thể 2/)
    let vertical = false
    Object.defineProperties(rail, {
      clientWidth: { configurable: true, get: () => (vertical ? 210 : 240) },
      scrollWidth: { configurable: true, get: () => (vertical ? 210 : 960) },
      clientHeight: { configurable: true, get: () => (vertical ? 200 : 120) },
      scrollHeight: { configurable: true, get: () => (vertical ? 704 : 120) },
    })
    rail.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, vertical ? 210 : 240, vertical ? 200 : 120)
    buttons.forEach((button, index) => {
      button.scrollIntoView = () => assert.fail("Skill selection must not scroll the outer page")
      button.getBoundingClientRect = () =>
        vertical
          ? new dom.window.DOMRect(0, index * 88 - rail.scrollTop, 210, 80)
          : new dom.window.DOMRect(index * 120 - rail.scrollLeft, 0, 112, 104)
    })
    document.documentElement.scrollTop = 321
    await show("skill-4-3")
    assert.equal(rail.scrollLeft, 352)
    assert.equal(rail.scrollTop, 0)
    assert.match(details().textContent!, /Nội dung riêng skill-4-3/)
    assert.match(details().textContent!, /Biến thể 3/)
    await show("skill-1-2")
    assert.equal(rail.scrollLeft, 120)
    vertical = true
    rail.scrollLeft = 0
    await show("capture-2")
    assert.equal(rail.scrollTop, 496)
    assert.equal(rail.scrollLeft, 0)
    assert.equal(document.documentElement.scrollTop, 321)
    await show("skill-4-1")
    assert.equal(rail.scrollTop, 352)
    assert.match(details().textContent!, /Nội dung riêng skill-4-1/)
    assert.match(details().textContent!, /Biến thể 1/)
    assert.deepEqual(skills, snapshot)
  })
})

test("flat mode keeps each verified variant in its skill region and preserves selected identity when returning to focus", async () => {
  await withView(async ({ document, HeroSkillsView, render, click }) => {
    const human = skill("skill-2-1", 1, "human")
    const fox = skill("skill-2-2", 2, "fox")
    const unknown = skill("capture-original", 0)
    unknown.translations[0].name = "Bản thu thập chưa xác định"
    const skills = [unknown, fox, human]
    await render(<HeroSkillsView skills={skills} locale="vi-VN" selectedSkillKey={fox.skillKey} />)
    const mode = (name: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Cách hiển thị kỹ năng"] button')].find(
        (button) => button.textContent?.trim() === name,
      )!
    await click(mode("Dạng phẳng"))
    assert.equal(mode("Dạng phẳng").getAttribute("aria-pressed"), "true")
    assert.equal(document.querySelector('[aria-label="Chọn kỹ năng"]'), null)
    const all = document.querySelector('[aria-label="Tất cả kỹ năng"]')!
    assert.equal(all.querySelectorAll("article").length, 3)
    const group = all.querySelector('[aria-label="Nhóm Chiêu 2 · 2 biến thể"]')!
    assert.equal(group.querySelectorAll("article").length, 2)
    assert.match(group.textContent!, /Nội dung riêng skill-2-1/)
    assert.match(group.textContent!, /Nội dung riêng skill-2-2/)
    assert.equal(group.textContent!.includes("Nội dung riêng capture-original"), false)
    await click(mode("Tập trung"))
    assert.equal(mode("Tập trung").getAttribute("aria-pressed"), "true")
    assert.match(document.querySelector('[aria-label="Chi tiết kỹ năng"]')!.textContent!, /Nội dung riêng skill-2-2/)
    assert.ok(
      document.querySelector('[aria-label="Chuyển biến thể kỹ năng"] [aria-label^="fox ·"][aria-pressed="true"]'),
    )
    let requested: string | undefined
    await render(
      <HeroSkillsView
        skills={skills}
        locale="vi-VN"
        selectedSkillKey={fox.skillKey}
        layout="flat"
        onLayoutChange={(next) => {
          requested = next
        }}
      />,
    )
    await click(mode("Tập trung"))
    assert.equal(requested, "focus")
    assert.ok(
      document.querySelector('[aria-label="Tất cả kỹ năng"]'),
      "The controlled URL layout remains authoritative",
    )
  })
})
