import assert from "node:assert/strict"
import { test } from "node:test"
import {
  textDifference,
  comparisonValue,
  plainComparisonText,
  comparisonPathLabels,
  comparisonImages,
} from "../src/features/publishing/hero-comparison"
import { captureDataset } from "../src/features/publishing/hero-source-dataset"
import {
  heroReviewItems,
  setHeroReviewResolved,
  sourceHttpUrl,
  sourceReviewNotes,
} from "../src/features/publishing/hero-source-review"

test("Vietnamese differences reconstruct both texts and do not silently drop words or numbers", () => {
  const before = "Sát thương 120 (+50% công vật lý).\nLàm chậm 1 giây."
  const after = "Sát thương 150 (+60% công vật lý).\nLàm chậm 1,5 giây."
  const parts = textDifference(before, after)
  assert.equal(
    parts
      .filter((part) => part.type !== "added")
      .map((part) => part.text)
      .join(""),
    before,
  )
  assert.equal(
    parts
      .filter((part) => part.type !== "removed")
      .map((part) => part.text)
      .join(""),
    after,
  )
  assert.equal(comparisonValue(null), "Chưa ghi nhận")
  assert.notEqual(comparisonValue(null), comparisonValue(0))
})

test("long descriptions use bounded work while preserving both sides", () => {
  const before = "Cũ một ".repeat(6000)
  const after = "Mới hai ".repeat(6000)
  const parts = textDifference(before, after)
  assert.equal(
    parts
      .filter((part) => part.type !== "added")
      .map((part) => part.text)
      .join(""),
    before,
  )
  assert.equal(
    parts
      .filter((part) => part.type !== "removed")
      .map((part) => part.text)
      .join(""),
    after,
  )
  assert.ok(parts.length < 10)
})

test("visible text comparison ignores safe formatting without interpreting arbitrary HTML", () => {
  assert.equal(plainComparisonText("<color=#FD8841>120</color> <ref=hero:airi>Airi</ref>"), "120 Airi")
  assert.equal(plainComparisonText("<script>run()</script>"), "<script>run()</script>")
})

test("structured comparison fields use readable labels without rewriting descriptive text", () => {
  assert.equal(
    comparisonValue({ statKey: "ATTACK_DAMAGE", baseValue: 173, unit: "POINT" }),
    "Chỉ số: Công vật lý\nGiá trị ghi nhận: 173\nĐơn vị: Điểm",
  )
  assert.equal(comparisonValue("UNKNOWN", "unit"), "Chưa xác định")
  assert.equal(comparisonValue(["WARRIOR", "ASSASSIN"], "roles"), "Đấu sĩ · Sát thủ")
  assert.equal(comparisonValue("PASSIVE", "kind"), "Nội tại")
  assert.equal(comparisonValue("PASSIVE"), "PASSIVE")
  assert.equal(comparisonValue({ futureField: "Nội dung" }), "Thông tin khác: Nội dung")
  assert.deepEqual(comparisonPathLabels("skins", "/headAssetId", [], "vi-VN"), ["Trang phục", "Ảnh đại diện"])
})

test("image comparisons resolve direct references and gallery arrays without exposing asset IDs as text", () => {
  assert.deepEqual(comparisonImages("image-a", "headAssetId"), [{ id: "image-a" }])
  assert.deepEqual(comparisonImages("image-a", "HEAD"), [{ id: "image-a" }])
  assert.deepEqual(comparisonImages([{ assetId: "image-a", label: "source.jpg" }, { assetId: "image-b" }], "HEAD"), [
    { id: "image-a" },
    { id: "image-b" },
  ])
  assert.deepEqual(comparisonImages(null, "headAssetId"), [])
  assert.deepEqual(comparisonImages("Mô tả kỹ năng", "description"), [])
  assert.deepEqual(comparisonImages(["Tăng ST", "Vật lý"], "tags"), [])
})

test("comparison paths identify skills by name and retain removed and unknown identities", () => {
  const previous = {
    skills: { skills: [{ skillKey: "skill-1-1", translations: [{ locale: "vi-VN", name: "Phi tiêu" }] }] },
  }
  assert.deepEqual(
    comparisonPathLabels("skills", "skills/skill-1-1/translations/vi-VN/description", [{}, previous], "vi-VN"),
    ["Kỹ năng", "Phi tiêu", "Bản dịch", "vi-VN", "Mô tả"],
  )
  assert.deepEqual(comparisonPathLabels("skills", "skills/unknown~1key", [previous], "vi-VN"), [
    "Kỹ năng",
    "unknown/key",
  ])
  assert.deepEqual(
    comparisonPathLabels(
      "skills",
      "/skills/skill-1-1/effects/SOURCE_SNAPSHOT/metadata/cooldown/display",
      [previous],
      "vi-VN",
    ),
    ["Kỹ năng", "Phi tiêu", "Hồi chiêu"],
  )
  assert.equal(
    comparisonValue({ label: "Sát thương", display_values: ["325", "390"] }),
    "Tên chỉ số: Sát thương\nGiá trị: 325 · 390",
  )
})

const source = {
  dataset_type: "aov_heroes_manual_image_extraction",
  heroes: [
    {
      hero: {
        slug: "edras",
        name: "Edras",
        title: "",
        roles: { names: null },
        attributes: {
          hero_level: null,
          basic: { health: { value: 3500 }, max_energy: { value: 0 } },
          offensive: { critical_chance: { value: 0, unit: "percent" }, attack_range: { value: "Đánh gần" } },
        },
        skills: [
          {
            slot: "passive",
            index: 0,
            name: "Nội tại",
            description: "<color=#FD8841>120</color> sát thương",
            skill_level_table: {
              column_labels: ["Lv 1"],
              rows: [{ label: "ST gốc", display_values: ["8"], review_required: true }],
            },
          },
        ],
      },
      review_flags: [{ field: "hero.skills", status: "unresolved", note: "Chưa có dạng khác." }],
    },
  ],
}

test("capture imports preserve unknowns, raw source tables and incomplete forms without invention", () => {
  const dataset = captureDataset(source)!
  assert.equal(dataset.rows.length, 1)
  const row = dataset.rows[0]
  assert.equal(dataset.reviewCount, 1)
  assert.equal(row.roles, undefined)
  assert.equal(row.overviewRatings, undefined)
  const skills = row.skills as {
    skillKey: string
    description: string
    effects: { metadata: Record<string, unknown> }[]
  }[]
  assert.equal(skills.length, 1)
  assert.equal(skills[0].skillKey, "skill-0-1")
  assert.equal(skills[0].description, "<color=#FD8841>120</color> sát thương")
  assert.equal(skills[0].effects[0].metadata.heroLevel, null)
  assert.deepEqual(skills[0].effects[0].metadata.levelTable, source.heroes[0].hero.skills[0].skill_level_table)
  assert.equal((row.combatStats as { values: unknown[] }).values.length, 3)
  assert.equal(captureDataset({ heroes: [{ name: "Normal JSON" }] }), null)
})

test("reviewed aliases avoid duplicate heroes while ambiguous Flowborn forms require an explicit identity", () => {
  const dataset = captureDataset({
    ...source,
    heroes: [
      { ...source.heroes[0], hero: { ...source.heroes[0].hero, slug: "apnette", name: "Annette" } },
      { ...source.heroes[0], hero: { ...source.heroes[0].hero, slug: "flowborn", name: "Flowborn" } },
    ],
  })!
  assert.equal(dataset.rows[0].code, "annette")
  assert.equal(dataset.rows[0].__sourceCode, "apnette")
  assert.equal(dataset.rows[1].code, "")
})

test("mismatched capture slots cannot overwrite canonical skills", () => {
  const dataset = captureDataset({
    ...source,
    heroes: [
      {
        ...source.heroes[0],
        review_flags: [{ field: "hero.skills", type: "source_filename_display_mismatch", status: "unresolved" }],
        hero: {
          ...source.heroes[0].hero,
          skills: [
            { slot: "skill_1", index: 1, name: "Chiêu được chụp", description: "Nội dung" },
            { slot: "skill_2", index: 2, name: "Chiêu được chụp", description: "Trùng", duplicate_of: "skill_1" },
            {
              slot: "skill_3",
              index: 3,
              name: "Chiêu số 4",
              description: "Số hiển thị khác tên ảnh",
              displayed_skill_number: 4,
            },
          ],
        },
      },
    ],
  })!
  const skills = dataset.rows[0].skills as { skillKey: string; effects: { metadata: Record<string, unknown> }[] }[]
  assert.deepEqual(
    skills.map((skill) => skill.skillKey),
    ["capture-skill-1", "capture-skill-3"],
  )
  assert.equal((skills[0].effects[0].metadata.duplicateCaptures as unknown[]).length, 1)
})

test("capture provenance keeps exact image and folder links while rejecting executable or credential URLs", () => {
  const folder = "https://drive.google.com/drive/folders/example"
  const image = "https://drive.google.com/file/d/skill-source/view?usp=drivesdk"
  const record = {
    ...source.heroes[0],
    sources: {
      folder_url: folder,
      images: [
        { file_name: "another.png", url: "https://example.test/wrong" },
        { file_name: "skill.png", url: image },
      ],
    },
    hero: {
      ...source.heroes[0].hero,
      skills: [{ ...source.heroes[0].hero.skills[0], source_image: "skill.png" }],
    },
  }
  const row = captureDataset({ ...source, heroes: [record] })!.rows[0]
  const stats = row.combatStats as { sources: { sourceUrl: string | null }[] }
  const skills = row.skills as { effects: { metadata: Record<string, unknown> }[] }[]
  assert.equal(stats.sources[0].sourceUrl, folder)
  assert.equal(skills[0].effects[0].metadata.sourceImage, "skill.png")
  assert.equal(skills[0].effects[0].metadata.sourceImageUrl, image)
  assert.equal(sourceHttpUrl("javascript:alert(1)"), null)
  assert.equal(sourceHttpUrl("data:text/html,source"), null)
  assert.equal(sourceHttpUrl("https://user:secret@example.test/source"), null)
  assert.equal(sourceHttpUrl("//example.test/source"), null)
  const unsafe = captureDataset({
    ...source,
    heroes: [
      { ...record, sources: { folder_url: "javascript:bad", images: [{ file_name: "skill.png", url: "data:bad" }] } },
    ],
  })!.rows[0]
  assert.equal((unsafe.combatStats as typeof stats).sources[0].sourceUrl, null)
  assert.equal((unsafe.skills as typeof skills)[0].effects[0].metadata.sourceImageUrl, null)
})

test("warning counts include clipped and missing forms but exclude routine capture provenance", () => {
  const common = [
    { type: "unlabeled_icons", status: "not_inferred", field: "hero.roles", note: "Unlabeled roles" },
    { type: "not_visible_in_source", status: "left_null", field: "hero.attributes.hero_level" },
    { type: "not_visible_in_source", field: "heroLevel", note: "Ảnh chưa xác nhận cấp tướng." },
    { type: "screenshot_color_sampling", field: "color_metadata" },
    { type: "visual_bar_measurement", field: "hero.overview_ratings" },
    { type: "raw_labels_and_values", field: "hero.skills[].skill_level_table" },
  ]
  const clipped = {
    type: "source_text_clipped",
    status: "visible_text_preserved",
    field: "hero.skills[0].description",
    note: "Chỉ giữ phần mô tả nhìn thấy.",
  }
  const missingForm = { type: "alternate_form_not_supplied", field: "hero.skills", note: "Chưa có dạng còn lại." }
  const fixture = (slug: string, flags: Record<string, unknown>[]) => ({
    ...source.heroes[0],
    hero: { ...source.heroes[0].hero, slug },
    review_flags: [...common, ...flags],
  })
  const dataset = captureDataset({
    ...source,
    heroes: [fixture("complete", []), fixture("clipped", [clipped]), fixture("forms", [missingForm])],
  })!
  assert.equal(dataset.reviewCount, 2)
  assert.deepEqual(sourceReviewNotes([...common, clipped, missingForm, clipped]), [clipped.note, missingForm.note])
  const curated = captureDataset({
    ...source,
    review_index: [{ record_id: "apnette", flags: [clipped] }],
    heroes: [fixture("apnette", [clipped]), fixture("forms", [missingForm])],
  })!
  assert.equal(curated.rows[0].code, "annette")
  assert.equal(curated.reviewCount, 1, "The curated index refers to the source identity, before aliases")
})

test("skill warning matching handles both array paths and named source slots without leaking to another skill", () => {
  const bracket = { field: "hero.skills[1].description", type: "clipped_text", note: "Bị cắt ở chiêu 1." }
  const dotted = {
    field: "hero.skills.skill_1.energy_cost",
    type: "no_numeric_cost_in_source",
    note: "Chưa biết tiêu hao.",
  }
  const passive = {
    field: "hero.skills.passive.description",
    type: "unusual_source_formula",
    note: "Kiểm tra nội tại.",
  }
  const row = captureDataset({
    ...source,
    heroes: [
      {
        ...source.heroes[0],
        review_flags: [bracket, dotted, passive],
        hero: {
          ...source.heroes[0].hero,
          skills: [
            { ...source.heroes[0].hero.skills[0], index: 0, slot: "passive" },
            { ...source.heroes[0].hero.skills[0], index: 1, slot: "skill_1" },
          ],
        },
      },
    ],
  })!.rows[0]
  const skills = row.skills as { effects: { metadata: { reviewFlags: unknown[]; completeness: string } }[] }[]
  assert.deepEqual(skills[0].effects[0].metadata.reviewFlags, [passive])
  assert.deepEqual(skills[1].effects[0].metadata.reviewFlags, [bracket, dotted])
  assert.equal(skills[1].effects[0].metadata.completeness, "NEEDS_REVIEW")
})

test("review resolution clears all copies of one warning, preserves evidence and can be reopened", () => {
  const flag = { field: "hero.skills[1].description", note: "Clipped description", status: "visible_text_preserved" }
  const other = { ...flag, field: "hero.skills[2].description" }
  const skills: import("../src/features/publishing/types").Skill[] = [1, 2].map((index) => ({
    skillKey: `skill-${index}-1`,
    kind: "ACTIVE",
    displayOrder: index,
    formKey: null,
    iconAssetId: null,
    translations: [{ locale: "vi-VN", name: "Skill", description: "Recorded description" }],
    effects: [
      {
        effectType: "SOURCE_SNAPSHOT",
        metadata: {
          [index === 1 ? "review_flags" : "reviewFlags"]: [index === 1 ? flag : other],
          heroReviewFlags: [flag, other],
          sourceImage: "source.png",
        },
      },
      { effectType: "DAMAGE", metadata: { value: 100 } },
    ],
  }))
  const before = structuredClone(skills)
  const selected = heroReviewItems(skills).find((item) => item.skillKey === "skill-1-1")!
  const resolved = setHeroReviewResolved(skills, selected, true)
  assert.deepEqual(skills, before)
  assert.equal(heroReviewItems(resolved).length, 1)
  assert.equal(heroReviewItems(resolved)[0].skillKey, "skill-2-1")
  for (const skill of resolved) {
    const flags = skill.effects[0].metadata.heroReviewFlags as Record<string, unknown>[]
    assert.deepEqual(flags[0], { ...flag, reviewResolution: "RESOLVED" })
    assert.deepEqual(flags[1], other)
    assert.deepEqual(skill.effects[1], before[0].effects[1])
    assert.equal(skill.effects[0].metadata.sourceImage, "source.png")
  }
  assert.deepEqual(sourceReviewNotes(resolved[0].effects[0].metadata.review_flags), [])
  assert.equal(heroReviewItems(resolved, true).length, 2)
  assert.deepEqual(setHeroReviewResolved(resolved, selected, false), before)
})

test("unscoped warnings with identical wording remain independent for each skill", () => {
  const skills = ["skill-1", "skill-2"].map((skillKey) => ({
    skillKey,
    kind: "ACTIVE" as const,
    displayOrder: 0,
    formKey: null,
    iconAssetId: null,
    translations: [],
    effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { reviewFlags: [{ note: "Check source" }] } }],
  }))
  const resolved = setHeroReviewResolved(skills, heroReviewItems(skills)[0], true)
  assert.equal(heroReviewItems(resolved)[0].skillKey, "skill-2")
  assert.equal(heroReviewItems(resolved).length, 1)
})

test("skill source details render a safe source link and keep clipped text in hero warnings", async () => {
  const React = await import("react")
  const previous = Object.getOwnPropertyDescriptor(globalThis, "React")
  const previousBroadcast = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel")
  Object.defineProperty(globalThis, "React", { configurable: true, writable: true, value: React })
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: undefined })
  try {
    const { SkillSourceDetails, heroReviewNotes } = await import("../src/features/publishing/hero-source-details")
    const { renderToStaticMarkup } = await import("react-dom/server")
    const note = "Mô tả đã bị cắt, cần bổ sung phần còn lại."
    const skill: import("../src/features/publishing/types").Skill = {
      skillKey: "skill-1-1",
      kind: "ACTIVE",
      formKey: null,
      displayOrder: 0,
      iconAssetId: null,
      translations: [{ locale: "vi-VN", name: "Kỹ năng", description: "Nội dung nhìn thấy" }],
      effects: [
        {
          effectType: "SOURCE_SNAPSHOT",
          metadata: {
            sourceImageUrl: "https://example.test/source.png?one=1&two=2",
            heroReviewFlags: [{ type: "source_text_clipped", status: "visible_text_preserved", note }],
          },
        },
      ],
    }
    const html = renderToStaticMarkup(React.createElement(SkillSourceDetails, { skill }))
    assert.match(html, /href="https:\/\/example\.test\/source\.png\?one=1&amp;two=2"/)
    assert.match(html, /rel="noopener noreferrer"/)
    assert.match(html, /Xem ảnh chụp nguồn/)
    assert.deepEqual(heroReviewNotes([skill]), [note])
    skill.effects[0].metadata.sourceImageUrl = "javascript:alert(1)"
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(SkillSourceDetails, { skill })), /<a\b/)
  } finally {
    if (previous) Object.defineProperty(globalThis, "React", previous)
    else Reflect.deleteProperty(globalThis, "React")
    if (previousBroadcast) Object.defineProperty(globalThis, "BroadcastChannel", previousBroadcast)
    else Reflect.deleteProperty(globalThis, "BroadcastChannel")
  }
})
