import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Skill } from "../src/features/publishing/types"
import type { SkillImage } from "../src/features/publishing/skill-artwork"
import {
  selectSkillTranslation,
  skillLabel,
  skillSlot,
  skillVariant,
  skillVariantLabel,
  groupHeroSkills,
} from "../src/features/publishing/hero-skills"
import { createHeroFixture, fixtureContent, fixtureRevision } from "./fixtures/hero-workspace-data"
import {
  createEntityIndex,
  parseRichText,
  resolveEntityRoute,
  type EntityReference,
  type RichTextNode,
} from "@aov/ui/lib/entity-rich-text"
import { analyzeStat, statDistribution } from "../src/features/publishing/hero-stat-analysis"
import { combatAttributeRows, type StatDefault, type StatSample } from "../src/features/publishing/combat-attributes"

let currentFetch: typeof fetch
const dispatchFetch: typeof fetch = (input, init) => currentFetch(input, init)

test("hero descriptions resolve named and implicit skill slots in the viewed revision only", async () => {
  await withView(async () => {
    const { revisionSkillReferences } = await import("../src/features/publishing/revision-skill-references")
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
    const { revisionSkillReferences } = await import("../src/features/publishing/revision-skill-references")
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

test("relative stat levels count ties, including zero, and need five other heroes", () => {
  assert.equal(statDistribution(200, [200, 200, 200, 200]).label, "Chưa đủ mẫu")
  assert.equal(statDistribution(200, [200, 200, 200, 200, 200]).label, "Đồng mức")
  assert.equal(statDistribution(0, [0, 0, 0, 0, 1, 2]).label, "Phổ biến")
  const peers = [10, 20, 30, 30, 40, 50]
  assert.equal(statDistribution(10, peers).label, "Thấp")
  assert.equal(statDistribution(30, peers).label, "Trung bình")
  assert.equal(statDistribution(50, peers).label, "Cao")
  assert.equal(statDistribution(30, peers).median, 30)
  assert.equal(statDistribution(3, [1, 2, 4, 8]).median, 3)
  assert.equal(statDistribution("Đánh gần", Array(6).fill("Đánh xa")).label, "Chưa gặp trong nhóm")
})

test("stat comparisons keep recorded source, patch, level, resource type and armor components separate", () => {
  const values = {
    physicalDefense: 140,
    physicalDefensePercent: 0,
    maxResource: 460,
    resourceLabel: "Năng lượng tối đa",
  }
  const capture = { patchCode: "s4", level: null, values }
  const rows = combatAttributeRows(null, { ...capture, image: undefined }, [])
  const peer = (id: string, details: StatSample["capture"]): StatSample => ({
    heroId: id,
    draft: true,
    roles: [],
    baseStats: { ARMOR: { value: 999, unit: "POINT" }, MAX_RESOURCE: { value: 460, unit: "POINT" } },
    capture: details,
  })
  const peers = [
    peer("1", capture),
    peer("2", { ...capture, patchCode: "s3" }),
    peer("3", { ...capture, level: 1 }),
    peer("4", { ...capture, values: { physicalDefensePercent: 0, maxResource: 460, resourceLabel: "Nội năng" } }),
    peer("5", null),
  ]
  const armor = analyzeStat(
    rows.find((r) => r.key === "ARMOR")!,
    peers,
    "s4",
    null,
  )
  assert.equal(armor?.primary?.total, 1)
  assert.equal(armor?.primary?.matches, 1)
  assert.equal(armor?.secondary?.total, 2)
  assert.equal(armor?.secondary?.matches, 2)
  assert.equal(
    analyzeStat(
      rows.find((r) => r.key === "MAX_RESOURCE")!,
      peers,
      "s4",
      null,
    )?.primary?.total,
    1,
  )
  const own = combatAttributeRows(
    { values: [{ statKey: "ARMOR", baseValue: 999, unit: "POINT", growthPerLevel: null }], sources: [] },
    undefined,
    [],
  )[0]
  peers[0].baseStats.ARMOR.unit = "PERCENT"
  assert.equal(analyzeStat(own, peers, "s4", null)?.primary?.matches, 4)
  const resourceStats = {
    values: [{ statKey: "MAX_RESOURCE", baseValue: 460, unit: "POINT", growthPerLevel: null }],
    sources: [],
  }
  const resource = combatAttributeRows(resourceStats, { ...capture, image: undefined }, []).find(
    (r) => r.key === "MAX_RESOURCE",
  )!
  assert.equal(analyzeStat(resource, peers, "s4", null)?.primary?.total, 2)
  assert.equal(analyzeStat(combatAttributeRows(resourceStats, undefined, [])[0], peers, "s4", null)?.primary?.total, 0)
  const fallback = combatAttributeRows(null, undefined, [
    {
      statKey: "ARMOR",
      baseValue: 140,
      unit: "POINT",
      variantId: "v",
      patchCode: "s4",
      sourceUrl: "https://example.com/source",
      version: 1,
    },
  ])[0]
  assert.equal(analyzeStat(fallback, peers, "s4", null), undefined)
})

test("hero analysis opens on demand and excludes the selected hero from both role groups", async () => {
  await withView(async ({ document, render, click, client, waitFor }) => {
    const { HeroCombatAttributes } = await import("../src/features/publishing/hero-combat-attributes")
    const sample = (heroId: string, roles: string[]): StatSample => ({
      heroId,
      roles,
      draft: true,
      baseStats: { HP: { value: 3500, unit: "HP" } },
      capture: null,
    })
    client.setQueryData(
      ["hero-stat-samples", "s4"],
      [
        sample("view-hero", ["MAGE"]),
        sample("tank", ["TANK"]),
        ...Array.from({ length: 5 }, (_, i) => sample(String(i), ["MAGE", "SUPPORT"])),
      ],
    )
    const stats = { values: [{ statKey: "HP", baseValue: 3500, unit: "POINT", growthPerLevel: null }], sources: [] }
    await render(
      <HeroCombatAttributes
        stats={stats}
        skills={null}
        roles={["MAGE"]}
        heroId="view-hero"
        variantId="s4"
        patchCode="s4"
        defaults={[]}
      />,
    )
    assert.doesNotMatch(document.body.textContent!, /Đồng mức/)
    // The comparison opens in the attributes window, on its own tab.
    const trigger = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "So sánh")!
    await click(trigger)
    assert.ok(document.querySelector('[role="dialog"]'), "The comparison opens in a window of its own")
    await waitFor(() => document.body.textContent!.includes("Đồng mức · 6 mẫu"))
    await click(Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Cùng vai trò")!)
    assert.match(document.body.textContent!, /Đồng mức · 5 mẫu/)
    assert.match(document.body.textContent!, /Chưa có mặc định được xác nhận/)
  })
})

test("combat attributes keep observed crit damage, patch defaults and explicit overrides distinct", async () => {
  await withView(async ({ document, render }) => {
    const { HeroCombatAttributes } = await import("../src/features/publishing/hero-combat-attributes")
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
                  values: [{ statKey: "CRITICAL_DAMAGE", unit: "PERCENT", baseValue, growthPerLevel: null }],
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
    const { HeroCombatAttributes } = await import("../src/features/publishing/hero-combat-attributes")
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
        { statKey: "ATTACK_DAMAGE", baseValue: 176, growthPerLevel: null, unit: "POINT" },
        { statKey: "ABILITY_POWER", baseValue: 0, growthPerLevel: null, unit: "POINT" },
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

test("armor is typed the way the game shows it and a malformed value cannot be saved", async () => {
  await withView(async ({ document, render, dom }) => {
    const { HeroStatsEditor } = await import("../src/features/publishing/hero-stats-editor")
    let stats: NonNullable<typeof fixtureContent.COMBAT_STATS> = {
      values: [
        { statKey: "ARMOR", baseValue: null, growthPerLevel: null, unit: "POINT" },
        { statKey: "HP", baseValue: 3720, percentValue: null, growthPerLevel: null, unit: "HP" },
      ],
      sources: [],
    }
    const mount = () =>
      render(
        <HeroStatsEditor
          value={stats}
          onChange={(v) => {
            stats = v
          }}
        />,
      )
    const type = async (next: string) => {
      const node = document.querySelector<HTMLInputElement>('input[placeholder="150 | 20%"]')!
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(node, next)
        node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      })
      await mount()
      return document.querySelector<HTMLInputElement>('input[placeholder="150 | 20%"]')!
    }
    await mount()
    assert.equal(document.querySelectorAll('input[placeholder="150 | 20%"]').length, 1, "HP keeps its number box")
    assert.match(document.body.textContent!, /Gõ đúng như game hiện: số, dấu |, rồi phần trăm/)
    assert.equal(document.querySelectorAll("select").length, 3, "armor has no unit to pick, HP still does")

    let input = await type("150 | 20%")
    assert.deepEqual(stats.values[0], {
      statKey: "ARMOR",
      baseValue: 150,
      percentValue: 20,
      growthPerLevel: null,
      unit: "POINT",
    })
    assert.equal(input.validationMessage, "")
    assert.match(document.body.textContent!, /Đã đọc: số 150, phần trăm 20%/)

    input = await type("150 |")
    assert.equal(stats.values[0].percentValue, 20, "The last good reading stays until the box parses again")
    assert.match(input.validationMessage, /Thiếu phần trăm sau dấu |/)
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /Thiếu phần trăm/)
    assert.equal(input.getAttribute("aria-invalid"), "true")

    input = await type("145")
    assert.equal(stats.values[0].baseValue, 145)
    assert.equal(stats.values[0].percentValue, null)
    assert.equal(input.validationMessage, "")
    assert.match(document.body.textContent!, /chưa có phần trăm/)
  })
})

test("a stat without a percent in the game drops one when the row switches to it", async () => {
  await withView(async ({ document, render, dom }) => {
    const { HeroStatsEditor } = await import("../src/features/publishing/hero-stats-editor")
    let stats: NonNullable<typeof fixtureContent.COMBAT_STATS> = {
      values: [{ statKey: "ARMOR", baseValue: 150, percentValue: 20, growthPerLevel: null, unit: "POINT" }],
      sources: [],
    }
    const mount = () =>
      render(
        <HeroStatsEditor
          value={stats}
          onChange={(v) => {
            stats = v
          }}
        />,
      )
    await mount()
    assert.equal(document.querySelector<HTMLInputElement>('input[placeholder="150 | 20%"]')!.value, "150 | 20%")
    const select = document.querySelector("select")!
    await act(async () => {
      select.value = "MOVEMENT_SPEED"
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    assert.equal(stats.values[0].percentValue, null)
    assert.equal(stats.values[0].baseValue, 150)
  })
})

test("a hero can override a shared stat and switch back without storing a copy", async () => {
  await withView(async ({ document, render, click }) => {
    const { HeroStatsEditor } = await import("../src/features/publishing/hero-stats-editor")
    const rule: StatDefault = {
      statKey: "CRITICAL_DAMAGE",
      baseValue: 200,
      unit: "PERCENT",
      sourceUrl: "https://example.com/patch",
      variantId: "variant",
      patchCode: "s4",
      version: 1,
    }
    let stats: NonNullable<typeof fixtureContent.COMBAT_STATS> = { values: [], sources: [] }
    const mount = () =>
      render(
        <HeroStatsEditor
          value={stats}
          defaults={[rule]}
          onChange={(v) => {
            stats = v
          }}
        />,
      )
    await mount()
    await click(
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Đặt giá trị riêng"))!,
    )
    assert.deepEqual(stats.values, [
      { statKey: "CRITICAL_DAMAGE", baseValue: null, growthPerLevel: null, unit: "PERCENT" },
    ])
    await mount()
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Dùng mặc định của patch"]')!)
    assert.deepEqual(stats.values, [])
    await mount()
    assert.match(document.body.textContent!, /Mặc định của patch.*200%/)
  })
})

test("hero overview shows the hero's positions and five-point ratings without changing stored content", async () => {
  await withView(async ({ document, render, click }) => {
    const { HeroContent } = await import("../src/features/publishing/hero-content")
    const content = structuredClone(fixtureContent)
    content.PROFILE!.translations[0].summary = "Giới thiệu dài cần giữ đầy đủ khi người xem mở rộng. ".repeat(10)
    Object.assign(content.OVERVIEW_RATINGS!, { survivability: null })
    content.PROFILE!.positions = ["TOP", "JUNGLE"]
    const original = JSON.stringify(content)
    await render(
      <MemoryRouter>
        <HeroContent content={content} locale="vi-VN" editable={false} busy={false} onEdit={() => {}} />
      </MemoryRouter>,
    )
    const role = document.querySelector('[aria-label="Vai trò: Sát thủ"]')!
    assert.match(role.querySelector("img")!.getAttribute("src")!, /images\/hero\/vai-tro\/sat-thu.png$/)
    const position = document.querySelector('[aria-label="Vị trí đi: Rừng"]')!
    assert.equal(position.querySelector("img"), null)
    assert.equal(position.querySelector("svg")!.getAttribute("fill"), "currentColor")
    assert.equal(position.querySelector("svg")!.getAttribute("aria-hidden"), "true")
    assert.match(document.body.textContent!, /3\.5\/5/)
    assert.match(document.body.textContent!, /4\/5/)
    assert.match(document.body.textContent!, /Sinh tồnChưa có/)
    assert.doesNotMatch(document.body.textContent!, /\/10/)
    const expand = document.querySelector<HTMLButtonElement>('button[aria-controls][aria-expanded="false"]')!
    assert.ok(expand)
    await click(expand)
    assert.equal(expand.getAttribute("aria-expanded"), "true")
    assert.equal(
      document.getElementById(expand.getAttribute("aria-controls")!)!.textContent,
      content.PROFILE!.translations[0].summary,
    )
    // The lore waits behind one icon on the hero card and opens in its own window.
    assert.equal(document.querySelector("[role=dialog]"), null)
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Đọc cốt truyện"]')!)
    assert.ok(
      document.querySelector("[role=dialog]")?.textContent?.includes(content.PROFILE!.translations[0].lore!),
      "The lore opens in its own window",
    )
    assert.equal(JSON.stringify(content), original)
    const withoutLore = structuredClone(content)
    withoutLore.PROFILE!.translations[0].lore = null
    await render(
      <MemoryRouter>
        <HeroContent content={withoutLore} locale="vi-VN" editable={false} busy={false} onEdit={() => {}} />
      </MemoryRouter>,
    )
    assert.equal(document.querySelector('button[aria-label="Đọc cốt truyện"]'), null)
    assert.equal(document.querySelector('button[aria-label^="Cốt truyện"]'), null)
  })
})

test("five-point rating edits preserve stored scale, fractional values, zero and missing input", async () => {
  await withView(async ({ dom, document, render }) => {
    const { SectionEditor } = await import("../src/features/publishing/section-editor")
    let value = structuredClone(fixtureContent.OVERVIEW_RATINGS!)
    const mount = () =>
      render(
        <SectionEditor
          section="OVERVIEW_RATINGS"
          value={value}
          locale="vi-VN"
          onChange={(next) => {
            value = next as typeof value
          }}
        />,
      )
    await mount()
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="number"]')]
    assert.deepEqual(
      inputs.map((input) => input.value),
      ["2", "3.5", "3", "4"],
    )
    assert.ok(inputs.every((input) => input.max === "5"))
    for (const [display, stored] of [
      ["3.5", 7],
      ["0", 0],
      ["5", 10],
      ["", NaN],
    ] as const) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(inputs[0], display)
        inputs[0].dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      })
      assert.equal(value.survivability, stored)
      assert.equal(value.scaleCode, "GAME_OVERVIEW_10")
      await mount()
    }
  })
})

test("stat choices and calendar inputs preserve unknown data, zero and missing values", async () => {
  await withView(async ({ dom, document, render, click }) => {
    const { SectionEditor } = await import("../src/features/publishing/section-editor")
    let value = structuredClone(fixtureContent.COMBAT_STATS!)
    value.values.push({ statKey: "CUSTOM_STAT", baseValue: 17, growthPerLevel: null, unit: "custom-unit" })
    value.sources = [
      {
        label: "Source",
        sourceUrl: null,
        observedAt: "2026-11-01T02:43:10.386Z",
        verificationState: "VERIFIED",
        note: null,
      },
    ]
    const mount = () =>
      render(
        <SectionEditor
          section="COMBAT_STATS"
          value={value}
          locale="vi-VN"
          onChange={(next) => {
            value = next as typeof value
          }}
        />,
      )
    const select = async (node: HTMLSelectElement, next: string) => {
      await act(async () => {
        node.value = next
        node.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
      })
      await mount()
    }
    const type = async (node: HTMLInputElement, next: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(node, next)
        node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      })
      await mount()
    }
    await mount()
    assert.doesNotMatch(document.body.textContent!, /BCP 47|ISO 8601|Mã chỉ số \(HP/)
    const choice = document.querySelector<HTMLSelectElement>("select")!
    assert.equal(choice.selectedOptions[0].textContent, "Máu")
    assert.equal(choice.querySelector<HTMLOptionElement>('option[value="ARMOR"]')!.disabled, true)
    await select(choice, "CRITICAL_CHANCE")
    assert.equal(value.values[0].unit, "PERCENT")
    await type(document.querySelector<HTMLInputElement>('input[type="number"]')!, "0")
    assert.equal(value.values[0].baseValue, 0)
    await type(document.querySelector<HTMLInputElement>('input[type="number"]')!, "")
    assert.equal(value.values[0].baseValue, null)
    assert.deepEqual(value.values[2], {
      statKey: "CUSTOM_STAT",
      baseValue: 17,
      growthPerLevel: null,
      unit: "custom-unit",
    })
    const openSources = () => click(document.querySelector<HTMLButtonElement>('[aria-label="Nguồn tham khảo (1)"]')!)
    const applySources = async () => {
      await click(document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')!)
      await mount()
    }
    await openSources()
    assert.equal(
      value.sources[0].observedAt,
      "2026-11-01T02:43:10.386Z",
      "Opening the calendar must not rewrite source precision",
    )
    await type(document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!, "2026-11-04T10:15:00")
    await applySources()
    assert.equal(value.sources[0].observedAt, new Date("2026-11-04T10:15:00").toISOString())
    await openSources()
    await type(document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!, "")
    await applySources()
    assert.equal(value.sources[0].observedAt, null)
  })
})

function skill(skillKey: string, displayOrder = 0, formKey: string | null = null): Skill {
  return {
    skillKey,
    displayOrder,
    formKey,
    kind: "ACTIVE",
    iconAssetId: null,
    translations: [{ locale: "vi-VN", name: "Chiêu cùng tên", description: `Nội dung riêng ${skillKey}` }],
    effects: [],
  }
}

function image(id: string, overrides: Partial<SkillImage> = {}): SkillImage {
  return {
    id,
    heroId: "view-hero",
    skillKey: null,
    sourceSlot: 2,
    variantNo: 1,
    assetId: `asset-${id}`,
    sourceFilename: `${id}.png`,
    label: null,
    version: 1,
    ...overrides,
  }
}

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

async function withView(run: (view: Awaited<ReturnType<typeof createView>>) => Promise<void>) {
  const view = await createView()
  try {
    await run(view)
  } finally {
    await view.close()
  }
}

async function createView() {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero/view-hero", pretendToBeVisual: true })
  const fixture = createHeroFixture()
  const requests: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const path = String(input).replace("/api/wiki/v1", "")
    requests.push(path)
    const match = /^\/admin\/media\/assets\/([^/?]+)$/.exec(path)
    if (match)
      return Response.json({
        id: match[1],
        semanticType: "SKILL_ICON",
        state: "ACTIVE",
        version: 1,
        currentVersionId: `version-${match[1]}`,
        currentUrl: `/media/${match[1]}.webp`,
        versions: [{ id: `version-${match[1]}`, url: `/media/${match[1]}.webp` }],
        provenance: [],
      })
    return fixture.fetcher(input, init)
  }
  currentFetch = fetcher
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    BroadcastChannel: undefined,
    fetch: dispatchFetch,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { HeroSkillsView } = await import("../src/features/publishing/hero-skills-view")
  const { SkillArtwork, skillImageMatch } = await import("../src/features/publishing/skill-artwork")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(["hero-skill-images", "view-hero"], [])
  await verifySession()
  return {
    dom,
    document: dom.window.document,
    client,
    requests,
    HeroSkillsView,
    SkillArtwork,
    skillImageMatch,
    render: async (node: React.ReactNode) =>
      act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)),
    click: async (node: HTMLElement) => act(async () => node.click()),
    waitFor: async (condition: () => boolean) => {
      for (let attempt = 0; attempt < 100 && !condition(); attempt++)
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5))
        })
      assert.ok(condition(), "Expected skill view state was not reached")
    },
    close: async () => {
      await act(async () => root.unmount())
      client.clear()
      await logout()
      dom.window.close()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}

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

test("inventory matches only unambiguous skill identities and explicit version artwork always wins", async () => {
  await withView(async ({ document, client, SkillArtwork, skillImageMatch, render, waitFor }) => {
    const value = skill("skill-2-1")
    const exact = image("exact", { skillKey: value.skillKey, sourceSlot: 9, variantNo: 8 })
    const loose = image("loose")
    assert.equal(skillImageMatch(value, [loose, exact])?.id, exact.id)
    assert.equal(skillImageMatch(value, [exact, image("second-exact", { skillKey: value.skillKey }), loose]), undefined)
    assert.equal(skillImageMatch(value, [loose])?.id, loose.id)
    assert.equal(skillImageMatch(value, [loose, image("second-loose")]), undefined)
    assert.equal(skillImageMatch(value, [image("other-key", { skillKey: "another-skill" })]), undefined)
    assert.equal(skillImageMatch(value, [image("wrong-slot", { sourceSlot: 1 })]), undefined)
    assert.equal(skillImageMatch(value, [image("wrong-variant", { variantNo: 2 })]), undefined)
    const unverified = skill("custom-unidentified")
    unverified.effects = [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 2 } }]
    assert.equal(skillImageMatch(unverified, [loose]), undefined)
    const conflicting = { ...value, effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 3 } }] }
    assert.equal(skillImageMatch(conflicting, [image("conflicting-slot", { sourceSlot: 3 })]), undefined)
    client.setQueryData(["hero-skill-images", "view-hero"], [exact])
    await render(<SkillArtwork skill={{ ...value, iconAssetId: "version-icon" }} heroId="view-hero" preview />)
    await waitFor(() => !!document.querySelector('img[src="/media/version-icon.webp"]'))
    assert.equal(
      document.querySelector('img[alt="Ảnh kỹ năng của phiên bản"]')?.getAttribute("src"),
      "/media/version-icon.webp",
    )
    assert.equal(document.querySelector('img[alt="Ảnh thư viện kỹ năng"]'), null)
    await render(<SkillArtwork skill={value} heroId="view-hero" />)
    await waitFor(() => !!document.querySelector('img[src="/media/asset-exact.webp"]'))
    // No mark on the icon; the picture names its origin and the tooltip explains it.
    assert.ok(document.querySelector('img[alt="Ảnh thư viện kỹ năng"]'))
    assert.ok(document.querySelector('[title*="không phải ảnh xác nhận riêng"]'))
  })
})

test("ambiguous and unbound inventory stays available in a gallery that loads asset metadata only after opening", async () => {
  await withView(async ({ dom, document, client, requests, HeroSkillsView, render, waitFor }) => {
    const value = skill("skill-2-1")
    const images = [
      image("ambiguous-a", { skillKey: value.skillKey }),
      image("ambiguous-b", { skillKey: value.skillKey }),
      image("unknown", { sourceSlot: 4, variantNo: 3 }),
    ]
    client.setQueryData(["hero-skill-images", "view-hero"], images)
    await render(<HeroSkillsView skills={[value]} locale="vi-VN" heroId="view-hero" />)
    const gallery = [...document.querySelectorAll("details")].find((node) =>
      node.querySelector("summary")?.textContent?.includes("Ảnh chưa gắn nội dung"),
    )!
    assert.ok(gallery)
    assert.match(gallery.querySelector("summary")!.textContent!, /3/)
    assert.equal(gallery.open, false)
    assert.equal(gallery.querySelector("img"), null)
    assert.equal(
      requests.some((path) => path.startsWith("/admin/media/assets/asset-")),
      false,
    )
    await act(async () => {
      gallery.open = true
      gallery.dispatchEvent(new dom.window.Event("toggle"))
    })
    await waitFor(() => gallery.querySelectorAll("img").length === 3)
    assert.ok(gallery.querySelector('img[src="/media/asset-unknown.webp"]'))
    await act(async () => {
      gallery.open = false
      gallery.dispatchEvent(new dom.window.Event("toggle"))
    })
    assert.equal(gallery.querySelectorAll("img").length, 0)
  })
})
