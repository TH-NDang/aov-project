import assert from "node:assert/strict"
import { test } from "node:test"
import type { HeroSourceCoverage, SkillSource } from "../server/patch-capture-manifest"
import {
  readinessRows,
  type Draft,
  type HeroPublishReadiness,
} from "../src/features/publishing/model/publish-readiness"
import type { PublishBlocker } from "../src/features/publishing/model/publish-rules"
import {
  captureSetFor,
  orderByCaptures,
  readinessCapturePatches,
  readinessSourceGaps,
  sourceGapGroup,
  sourceGaps,
  sourceGapSummary,
  statList,
} from "../src/features/publishing/model/captures/source-image-gaps"
import type { Revision } from "../src/features/publishing/api/types"

/** What the attributes screen shows for a hero whose numbers were all readable. */
const readable = {
  health: 3543,
  physicalAttack: 170,
  magicAttack: 0,
  physicalDefense: 137,
  magicDefense: 80,
  maxResource: 150,
  movementSpeed: 380,
  attackRange: "Đánh gần",
  physicalPierce: 0,
  magicPierce: 0,
  bonusAttackSpeedPercent: 0,
  criticalChancePercent: 0,
  criticalDamagePercent: 200,
  physicalLifestealPercent: 0,
  magicLifestealPercent: 0,
  cooldownReductionPercent: 0,
}
/** The attributes-named image that only caught the hero page, as with Ata. */
const overviewOnly = {
  health: null,
  physicalAttack: null,
  physicalDefense: null,
  resourceLabel: null,
  maxResource: null,
  movementSpeed: null,
  attackRange: null,
}

const skillSource = (skillKey: string, patch: Partial<SkillSource> = {}): SkillSource => ({
  skillKey,
  name: null,
  shown: [`${skillKey}.png`],
  withheld: [],
  cut: false,
  table: true,
  request: null,
  ...patch,
})
const coverage = (patch: Partial<HeroSourceCoverage> = {}): HeroSourceCoverage => ({
  heroCode: "airi",
  overview: ["overview.png"],
  attributes: [{ fileName: "attributes.png", values: readable }],
  skills: [skillSource("skill-0-1"), skillSource("skill-1-1")],
  ...patch,
})
const skill = (skillKey: string, name = "Tên", description = "Mô tả") => ({
  skillKey,
  translations: [{ locale: "vi-VN", name, description }],
})
const draft = (patch: Partial<Draft> = {}): Draft => ({
  revisionId: "draft",
  observedStats: true,
  skinsSaved: true,
  profile: { translations: [{ locale: "vi-VN", name: "Airi" }], roles: ["ASSASSIN"] },
  overviewRatings: { scaleCode: "GAME_OVERVIEW_10", survivability: 6, attackDamage: 6, skillEffects: 4, difficulty: 8 },
  combatStats: { values: [] },
  skills: { skills: [skill("skill-0-1"), skill("skill-1-1")] },
  mediaBindings: { bindings: { HEAD: "h", PORTRAIT: "p", SPLASH: "s" } },
  ...patch,
})
const statsBlocker: PublishBlocker = { key: "COMBAT_STATS", message: "Cần có chỉ số." }
const skillsBlocker: PublishBlocker = { key: "SKILLS", message: "Bổ sung kỹ năng." }

test("a hero whose images show every item has nothing left to capture", () => {
  assert.deepEqual(sourceGaps({ coverage: coverage(), draft: draft(), blockers: [] }), [])
})

test("an attributes image that only caught the hero page is the capture that unblocks publishing", () => {
  const [gap, ...rest] = sourceGaps({
    coverage: coverage({ attributes: [{ fileName: "2179-hero-115-attributes.png", values: overviewOnly }] }),
    draft: draft({ observedStats: false }),
    blockers: [statsBlocker],
  })
  assert.equal(rest.length, 0)
  assert.deepEqual(
    [gap!.area, gap!.reason, gap!.weight, gap!.fixes],
    ["STATS", "NOT_SHOWN", "UNBLOCKS", "COMBAT_STATS"],
  )
  assert.match(gap!.capture, /Chi tiết .*→ Thuộc tính/)
  assert.match(gap!.checks, /Máu, Công vật lý, Công phép, Giáp và 12 chỉ số khác/)
  assert.equal(gap!.data, "Bản nháp chưa có chỉ số nào.")
  assert.deepEqual(gap!.files, ["2179-hero-115-attributes.png"])
})

test("stats typed in by hand still need the image that shows them, and the rest are reported missing", () => {
  const [gap] = sourceGaps({
    coverage: coverage({ attributes: [{ fileName: "attributes.png", values: overviewOnly }] }),
    draft: draft({ observedStats: false, combatStats: { values: ["HP"] } }),
    blockers: [],
  })
  assert.equal(gap!.weight, "MISSING_DATA", "a draft with only health passes the check but is not complete")
  assert.match(gap!.data, /^Bản nháp chưa có Công vật lý, Công phép, Giáp, Giáp phép và 11 chỉ số khác\./)
  assert.match(gap!.data, /Máu đã nhập nhưng chưa đối chiếu được\.$/)

  const [entered] = sourceGaps({
    coverage: coverage({ attributes: [] }),
    draft: draft({ observedStats: false, combatStats: { values: [...Object.keys(STAT_KEYS)] } }),
    blockers: [],
  })
  assert.deepEqual([entered!.reason, entered!.weight], ["NO_IMAGE", "UNCHECKED"])
  assert.equal(entered!.problem, "Chưa có ảnh bảng Thuộc tính.")
})

const STAT_KEYS = Object.fromEntries(
  [
    "HP",
    "ATTACK_DAMAGE",
    "ABILITY_POWER",
    "ARMOR",
    "MAGIC_DEFENSE",
    "MAX_RESOURCE",
    "MOVEMENT_SPEED",
    "ATTACK_RANGE_TYPE",
    "ARMOR_PIERCE",
    "MAGIC_PIERCE",
    "BONUS_ATTACK_SPEED",
    "CRITICAL_CHANCE",
    "CRITICAL_DAMAGE",
    "PHYSICAL_LIFESTEAL",
    "MAGIC_LIFESTEAL",
    "COOLDOWN_REDUCTION",
  ].map((key) => [key, true]),
)

test("numbers covered on the image are named, so only they are captured again", () => {
  const [gap] = sourceGaps({
    coverage: coverage({
      attributes: [
        {
          fileName: "1609-hero-085-attributes.png",
          values: { ...readable, health: null, physicalAttack: null, magicAttack: null },
        },
      ],
    }),
    draft: draft(),
    blockers: [],
  })
  assert.deepEqual([gap!.reason, gap!.weight], ["PARTLY_HIDDEN", "MISSING_DATA"])
  assert.equal(gap!.problem, "Ảnh Thuộc tính bị che, không đọc được Máu, Công vật lý và Công phép.")
  assert.equal(gap!.checks, "Đối chiếu Máu, Công vật lý và Công phép.")
})

test("a hero with no resource row on its attributes screen has nothing hidden there", () => {
  const noResource = { ...readable, maxResource: null, resourceLabel: null, noResource: true }
  assert.deepEqual(
    sourceGaps({
      coverage: coverage({ attributes: [{ fileName: "a.png", values: noResource }] }),
      draft: draft(),
      blockers: [],
    }),
    [],
  )
  const [gap] = sourceGaps({
    coverage: coverage({ attributes: [{ fileName: "a.png", values: { ...noResource, noResource: undefined } }] }),
    draft: draft(),
    blockers: [],
  })
  assert.equal(
    gap!.problem,
    "Ảnh Thuộc tính bị che, không đọc được Tài nguyên tối đa.",
    "without the mark it is unread",
  )
})

test("a set that never recorded how an image was read cannot call it short", () => {
  assert.deepEqual(
    sourceGaps({
      coverage: coverage({ attributes: [{ fileName: "a.png", values: null }] }),
      draft: draft(),
      blockers: [],
    }),
    [],
  )
})

test("each skill reads as missing, wrongly captured, cut off or short of its table", () => {
  const gaps = sourceGaps({
    coverage: coverage({
      skills: [
        skillSource("skill-0-1", { shown: [], withheld: ["1747-01-hero-092-passive-detail.png"] }),
        skillSource("skill-1-1", { cut: true, request: "Cuộn xuống và chụp tiếp câu cuối sau 'giảm một'." }),
        skillSource("skill-2-1", { table: false }),
        skillSource("skill-3-1", { shown: [], withheld: ["1918-04-hero-101-skill-3-detail.png"] }),
        skillSource("capture-form-1-skill-4", { shown: [], withheld: ["1367-05-hero-072-skill-4-detail.png"] }),
      ],
    }),
    draft: draft({
      skills: { skills: [skill("skill-0-1"), skill("skill-1-1", "Điện chùy xuất kích"), skill("skill-2-1")] },
    }),
    blockers: [],
  })
  const by = (key: string) => gaps.find((gap) => gap.key === key)!
  assert.deepEqual(
    gaps.map((gap) => [gap.key, gap.reason, gap.weight]),
    [
      ["skill:skill-1-1", "CUT_OFF", "MISSING_DATA"],
      ["skill:skill-3-1", "NOT_SHOWN", "MISSING_DATA"],
      ["skill:skill-0-1", "NOT_SHOWN", "UNCHECKED"],
      ["skill:skill-2-1", "NO_TABLE", "MINOR"],
      ["skill:capture-form-1-skill-4", "NOT_SHOWN", "MINOR"],
    ],
    "strongest first",
  )
  assert.equal(by("skill:skill-1-1").title, "Chiêu 1 · Điện chùy xuất kích")
  assert.equal(
    by("skill:skill-1-1").capture,
    "Cuộn xuống và chụp tiếp câu cuối sau 'giảm một'.",
    "the reviewer's words lead",
  )
  assert.equal(by("skill:skill-3-1").data, "Bản nháp chưa có kỹ năng này.")
  assert.match(by("skill:skill-0-1").capture, /chạm biểu tượng Nội tại → Chi tiết/)
  assert.equal(by("skill:capture-form-1-skill-4").title, "Ảnh chưa rõ kỹ năng")

  const [odd] = sourceGaps({
    coverage: coverage({ skills: [] }),
    draft: draft({ skills: { skills: [skill("a", "Lôi đình")] } }),
    blockers: [],
  })
  assert.deepEqual(
    [odd!.title, odd!.weight],
    ["a · Lôi đình", "UNCHECKED"],
    "a drafted skill is never an unknown image",
  )
})

test("an empty skill only blocks on a capture when no image of it exists", () => {
  const gaps = sourceGaps({
    coverage: coverage({ skills: [skillSource("skill-0-1"), skillSource("skill-1-1")] }),
    draft: draft({
      skills: { skills: [skill("skill-0-1", "", ""), skill("skill-1-1"), skill("skill-1-2", "Chiêu 1", "")] },
    }),
    blockers: [skillsBlocker],
  })
  // The passive has an image, so what is left is typing it in.
  assert.deepEqual(
    gaps.map((gap) => [gap.key, gap.title, gap.weight, gap.fixes]),
    [["skill:skill-1-2", "Chiêu 1 · 2", "UNBLOCKS", "SKILLS"]],
  )
})

test("a hero missing from the set needs every screen, and one only published is checked, not judged", () => {
  const gaps = sourceGaps({ coverage: undefined, draft: draft(), blockers: [] })
  assert.deepEqual(
    gaps.map((gap) => [gap.key, gap.reason]),
    [
      ["stats", "NO_IMAGE"],
      ["overview", "NO_IMAGE"],
      ["skill:skill-0-1", "NO_IMAGE"],
      ["skill:skill-1-1", "NO_IMAGE"],
    ],
  )
  const published = sourceGaps({
    coverage: coverage({ skills: [skillSource("skill-0-1", { shown: [], withheld: ["passive.png"] })] }),
    blockers: [],
  })
  assert.deepEqual(
    published.map((gap) => [gap.key, gap.weight, gap.data]),
    [["skill:skill-0-1", "UNCHECKED", "Bản đã xuất bản chưa có ảnh để đối chiếu kỹ năng này."]],
  )
})

test("captures that answer every failing check put a hero first; another blocker leaves it partly unblocked", () => {
  const gaps = sourceGaps({
    coverage: coverage({ attributes: [{ fileName: "a.png", values: overviewOnly }] }),
    draft: draft({ observedStats: false }),
    blockers: [statsBlocker],
  })
  assert.equal(sourceGapGroup(gaps, [statsBlocker]), "UNBLOCKS")
  assert.equal(sourceGapGroup(gaps, [statsBlocker, { key: "MEDIA_BINDINGS", message: "Ảnh" }]), "PARTLY_UNBLOCKS")
  assert.equal(sourceGapGroup([], []), "COMPLETE")
})

test("a revision of a patch without its own set is checked against the newest set", () => {
  assert.deepEqual(captureSetFor("2026-10-30", ["2026-09-29", "2026-10-30"]), { patchCode: "2026-10-30" })
  assert.deepEqual(captureSetFor("s3-2026-observed", ["2026-09-29", "2026-10-30"]), {
    patchCode: "2026-10-30",
    revisionPatch: "s3-2026-observed",
  })
  assert.equal(captureSetFor("2026-10-30", []), null)
})

test("long stat lists stay on one line", () => {
  assert.equal(statList(["HP"]), "Máu")
  assert.equal(statList(["HP", "ARMOR"]), "Máu và Giáp")
  assert.equal(
    statList(["HP", "ARMOR", "MAGIC_DEFENSE", "ATTACK_RANGE_TYPE", "MOVEMENT_SPEED", "CRITICAL_CHANCE"]),
    "Máu, Giáp, Giáp phép, Tầm đánh và 2 chỉ số khác",
  )
})

const revision = (heroId: string, state: Revision["state"], patchVariant = "patch-1030"): Revision => ({
  id: `${heroId}-${state}`,
  heroId,
  rulesetId: "standard",
  revisionNo: state === "DRAFT" ? 2 : 1,
  state,
  version: 1,
  cause: "DATA_BASELINE",
  sections: {} as Revision["sections"],
  publishedAt: null,
  sourceRevisionId: null,
  effectiveFromPatchVariantId: patchVariant,
})
const hero = (code: string, patch: Partial<HeroPublishReadiness>): HeroPublishReadiness => ({
  id: code,
  code,
  names: [{ locale: "vi-VN", name: code[0]!.toUpperCase() + code.slice(1) }],
  headUrl: null,
  revisions: [],
  drafts: [],
  holderId: null,
  formKey: null,
  formIds: [],
  ...patch,
})
const variant = (id: string, patchCode: string) => ({
  id,
  patchId: id,
  patchCode,
  rulesetId: "standard",
  rulesetOrdinal: 1,
  seasonId: "s4",
  status: "PUBLISHED",
})

test("rows are ranked by how useful their captures are, and heroes with nothing to capture drop out", () => {
  const rows = readinessRows(
    [
      hero("airi", { revisions: [revision("airi", "DRAFT")], drafts: [draft({ revisionId: "airi-DRAFT" })] }),
      hero("ata", {
        revisions: [revision("ata", "DRAFT"), revision("ata", "PUBLISHED")],
        drafts: [draft({ revisionId: "ata-DRAFT", observedStats: false, combatStats: { values: ["HP"] } })],
      }),
      hero("bijan", {
        revisions: [revision("bijan", "DRAFT")],
        drafts: [draft({ revisionId: "bijan-DRAFT", observedStats: false })],
      }),
      hero("aya", {
        revisions: [revision("aya", "DRAFT", "patch-s3")],
        drafts: [draft({ revisionId: "aya-DRAFT", skills: { skills: [skill("skill-1-2", "", "")] } })],
      }),
      hero("fennik", {}),
    ],
    { variants: [variant("patch-1030", "2026-10-30"), variant("patch-s3", "s3-2026-observed")] },
    "vi-VN",
  )
  const patches = ["2026-10-30"]
  assert.deepEqual(readinessCapturePatches(rows, patches), ["2026-10-30"])

  const sets = new Map([
    [
      "2026-10-30",
      new Map([
        ["airi", coverage()],
        ["ata", coverage({ heroCode: "ata", attributes: [{ fileName: "a.png", values: overviewOnly }] })],
        ["bijan", coverage({ heroCode: "bijan", attributes: [{ fileName: "b.png", values: overviewOnly }] })],
        ["aya", coverage({ heroCode: "aya", skills: [] })],
      ]),
    ],
  ])
  const gaps = readinessSourceGaps(rows, patches, sets, "vi-VN")
  assert.equal(gaps.has("fennik"), false, "a hero with nothing written has nothing to check")
  assert.equal(gaps.get("aya:standard")!.revisionPatch, "s3-2026-observed")
  assert.deepEqual(
    orderByCaptures(rows, gaps).map((row) => [row.code, gaps.get(row.rowKey)!.group]),
    [
      ["aya", "UNBLOCKS"],
      ["bijan", "UNBLOCKS"],
      ["ata", "MISSING_DATA"],
    ],
    "unblocking first, then by name; a published hero would follow one never published",
  )
  assert.deepEqual(sourceGapSummary(gaps), {
    heroes: 3,
    groups: [
      { group: "UNBLOCKS", label: "Chụp xong là đủ điều kiện xuất bản", count: 2 },
      { group: "MISSING_DATA", label: "Bổ sung dữ liệu còn thiếu", count: 1 },
    ],
  })
})
