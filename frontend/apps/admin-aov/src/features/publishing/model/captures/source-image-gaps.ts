import type { HeroSourceCoverage, SkillSource } from "../../../../../server/patch-capture-manifest.ts"
import { combatAttributeKeys, observedStat } from "../assessment/combat-attributes"
import type { components } from "../../generated/hero-api"
import { statLabel } from "../patch-changes/patch-change-model"
import type { ReadinessRow } from "../publish-readiness"
import type { PublishBlocker, PublishBlockerKey } from "../publish-rules"

type Draft = components["schemas"]["HeroPublishDraft"]

export type { HeroSourceCoverage }
export type SourceGapArea = "OVERVIEW" | "STATS" | "SKILL"
/**
 * NO_IMAGE: nothing was captured. NOT_SHOWN: images exist but show another screen. PARTLY_HIDDEN: part of the numbers is
 * covered. CUT_OFF: the description runs past the last page. NO_TABLE: no level table was seen, which may need scrolling.
 */
export type SourceGapReason = "NO_IMAGE" | "NOT_SHOWN" | "PARTLY_HIDDEN" | "CUT_OFF" | "NO_TABLE"
/**
 * UNBLOCKS: the data a publish check asks for can only come from this capture. MISSING_DATA: the revision lacks what the
 * capture would show, though no check stops it. UNCHECKED: the data is there but nothing shows whether it is right.
 */
export type SourceGapWeight = "UNBLOCKS" | "MISSING_DATA" | "UNCHECKED" | "MINOR"

export interface SourceGap {
  key: string
  area: SourceGapArea
  skillKey?: string
  title: string
  reason: SourceGapReason
  weight: SourceGapWeight
  /** The publish check this capture answers. */
  fixes?: PublishBlockerKey
  /** What is wrong with the images there are. */
  problem: string
  /** Where to go in the game and what to capture. */
  capture: string
  /** What the capture lets an editor check. */
  checks: string
  /** What the revision has or lacks for this item. */
  data: string
  /** Images that fall short, by file name. */
  files: string[]
}

/**
 * UNBLOCKS: the captures answer every publish check still failing. PARTLY_UNBLOCKS: they answer some, others remain.
 * COMPLETE: nothing left to capture.
 */
export type SourceGapGroup = Exclude<SourceGapWeight, "UNBLOCKS"> | "UNBLOCKS" | "PARTLY_UNBLOCKS" | "COMPLETE"

export interface HeroSourceGaps {
  /** The capture set the hero was checked against. */
  patchCode: string
  /** The revision's own patch, when it has no capture set and a newer set stood in. */
  revisionPatch?: string
  gaps: SourceGap[]
  group: SourceGapGroup
}

export const sourceGapWeightLabels: Record<SourceGapWeight, string> = {
  UNBLOCKS: "Gỡ chặn xuất bản",
  MISSING_DATA: "Thiếu dữ liệu",
  UNCHECKED: "Chưa đối chiếu được",
  MINOR: "Nên xem lại",
}

const weights: SourceGapWeight[] = ["UNBLOCKS", "MISSING_DATA", "UNCHECKED", "MINOR"]
const groups: SourceGapGroup[] = ["UNBLOCKS", "PARTLY_UNBLOCKS", "MISSING_DATA", "UNCHECKED", "MINOR", "COMPLETE"]

const SKILL_KEY = /^skill-(\d+)-(\d+)$/
const STATS_SCREEN =
  "Trang tướng → Chi tiết (góc dưới trái) → Thuộc tính; chụp khi bảng Thuộc tính cơ bản và tấn công đã hiện đủ."
const OVERVIEW_SCREEN = "Mở trang tướng, chụp màn hình có Sở trường và bốn thanh đánh giá."

const label = (key: string) => (key === "ATTACK_RANGE_TYPE" ? "Tầm đánh" : statLabel(key))

/** Names a few stats and counts the rest, so a long list stays one line. */
export function statList(keys: readonly string[], limit = 4) {
  const names = keys.map(label)
  if (names.length <= limit)
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} và ${names.at(-1)}` : names.join("")
  return `${names.slice(0, limit).join(", ")} và ${names.length - limit} chỉ số khác`
}

const sentence = (text: string) => text.charAt(0).toLocaleUpperCase("vi") + text.slice(1)

/** The capture set to check a revision against: its own patch, else the newest set so the next capture still counts. */
export function captureSetFor(patchCode: string | undefined, patches: readonly string[]) {
  if (patchCode && patches.includes(patchCode)) return { patchCode }
  const newest = patches.at(-1)
  return newest ? { patchCode: newest, revisionPatch: patchCode } : null
}

type DraftSkill = NonNullable<Draft["skills"]>["skills"][number]
type SkillReason = Exclude<SourceGapReason, "PARTLY_HIDDEN">

function skillName(skill: DraftSkill, locale: string) {
  const text =
    skill.translations.find((item) => item.locale === locale) ??
    skill.translations.find((item) => item.locale === "vi-VN") ??
    skill.translations[0]
  return text?.name.trim() || null
}

export interface SourceGapInput {
  coverage: HeroSourceCoverage | undefined
  /** The draft's facts; absent for a hero that only has published revisions. */
  draft?: Draft
  blockers: readonly PublishBlocker[]
  locale?: string
}

function statsGap({ coverage, draft, blockers }: SourceGapInput): SourceGap | null {
  const images = coverage?.attributes ?? []
  const recorded = images.flatMap((image) => (image.values ? [image.values] : []))
  // A set that never recorded how an image was read cannot say what is missing from it.
  if (images.length && !recorded.length) return null
  // A hero whose screen has no resource row (Charlotte) is read as such: nothing there is hidden.
  const shown = (key: string, values: Record<string, unknown>) =>
    !!observedStat(key, values) || (key === "MAX_RESOURCE" && values.noResource === true)
  const hidden = combatAttributeKeys.filter((key) => !recorded.some((values) => shown(key, values)))
  if (!hidden.length) return null

  const reason: SourceGapReason = !images.length
    ? "NO_IMAGE"
    : hidden.length === combatAttributeKeys.length
      ? "NOT_SHOWN"
      : "PARTLY_HIDDEN"
  const entered = draft?.combatStats?.values ?? []
  const missing = hidden.filter((key) => !entered.includes(key))
  const unchecked = hidden.filter((key) => entered.includes(key))
  const blocked = blockers.some((blocker) => blocker.key === "COMBAT_STATS")
  const weight: SourceGapWeight = blocked ? "UNBLOCKS" : draft && missing.length ? "MISSING_DATA" : "UNCHECKED"
  const data = !draft
    ? "Bản đã xuất bản chưa có ảnh để đối chiếu các chỉ số này."
    : blocked
      ? "Bản nháp chưa có chỉ số nào."
      : [
          missing.length && `Bản nháp chưa có ${statList(missing)}.`,
          unchecked.length && `${sentence(statList(unchecked))} đã nhập nhưng chưa đối chiếu được.`,
        ]
          .filter(Boolean)
          .join(" ")
  return {
    key: "stats",
    area: "STATS",
    title: "Chỉ số",
    reason,
    weight,
    fixes: blocked ? "COMBAT_STATS" : undefined,
    problem:
      reason === "NO_IMAGE"
        ? "Chưa có ảnh bảng Thuộc tính."
        : reason === "NOT_SHOWN"
          ? "Ảnh mang tên thuộc tính chỉ chụp trang tướng, chưa mở bảng Thuộc tính."
          : `Ảnh Thuộc tính bị che, không đọc được ${statList(hidden)}.`,
    capture: STATS_SCREEN,
    checks: `Đối chiếu ${statList(hidden)}.`,
    data,
    files: images.map((image) => image.fileName),
  }
}

function overviewGap({ coverage, draft, blockers }: SourceGapInput): SourceGap | null {
  // The attributes screen shows the same ratings and specialty as the hero page.
  if (coverage && (coverage.overview.length || coverage.attributes.length)) return null
  const blocked = blockers.some((blocker) => blocker.key === "OVERVIEW_RATINGS")
  const weight: SourceGapWeight = blocked ? "UNBLOCKS" : draft && !draft.overviewRatings ? "MISSING_DATA" : "UNCHECKED"
  return {
    key: "overview",
    area: "OVERVIEW",
    title: "Trang tướng",
    reason: "NO_IMAGE",
    weight,
    fixes: blocked ? "OVERVIEW_RATINGS" : undefined,
    problem: "Chưa có ảnh trang tướng.",
    capture: OVERVIEW_SCREEN,
    checks: "Đối chiếu sở trường và đánh giá Sinh mệnh, Sát thương, Hiệu ứng kỹ năng, Độ khó.",
    data:
      weight === "UNBLOCKS" || weight === "MISSING_DATA"
        ? "Bản nháp chưa có đủ đánh giá."
        : "Đánh giá đã nhập chưa đối chiếu được.",
    files: [],
  }
}

interface SkillItem {
  skillKey: string
  name: string | null
  source?: SkillSource
  inDraft: boolean
  empty: boolean
}

function skillGap(item: SkillItem, label: string, input: SourceGapInput): SourceGap | null {
  const { source, inDraft, empty } = item
  const slot = Number(SKILL_KEY.exec(item.skillKey)?.[1] ?? Number.NaN)
  // Only an image the set could not name is unmatched; a drafted skill keeps its own key whatever it looks like.
  const known = inDraft || !Number.isNaN(slot)
  const reason: SkillReason | null =
    !source || (!source.shown.length && !source.withheld.length)
      ? "NO_IMAGE"
      : !source.shown.length
        ? "NOT_SHOWN"
        : source.cut
          ? "CUT_OFF"
          : source.table === false && slot > 0 && !empty
            ? "NO_TABLE"
            : null
  // With an image in hand the rest is typing, not capturing.
  if (!reason || ((reason === "CUT_OFF" || reason === "NO_TABLE") && !inDraft && input.draft)) return null

  const blocked = empty && input.blockers.some((blocker) => blocker.key === "SKILLS")
  const weight: SourceGapWeight = !known
    ? "MINOR"
    : blocked
      ? "UNBLOCKS"
      : reason === "NO_TABLE"
        ? "MINOR"
        : input.draft && (!inDraft || empty || reason === "CUT_OFF")
          ? "MISSING_DATA"
          : "UNCHECKED"
  // A placeholder name that only repeats the slot label adds nothing.
  const named = item.name && !label.startsWith(item.name) ? item.name : null
  const title = known ? (named ? `${label} · ${named}` : label) : "Ảnh chưa rõ kỹ năng"
  const screen = `Mở trang tướng, chạm biểu tượng ${label} → Chi tiết; chụp tên, toàn văn mô tả và bảng cấp, cuộn nếu dài.`
  const problem = {
    NO_IMAGE: "Chưa có ảnh Chi tiết của kỹ năng này.",
    NOT_SHOWN: `${source?.withheld.length ?? 0} ảnh mang tên kỹ năng này nhưng không chụp khung kỹ năng.`,
    CUT_OFF: "Mô tả bị cắt ở cuối ảnh.",
    NO_TABLE: "Ảnh chưa có bảng cấp chiêu; có thể bảng nằm ở phần phải cuộn.",
  }[reason]
  const capture = !known
    ? `Ảnh ${source?.withheld.join(", ")} chưa xác định là kỹ năng nào; chụp lại kèm biểu tượng hoặc dạng đang chọn.`
    : (source?.request ??
      (reason === "CUT_OFF"
        ? `Mở ${label} → Chi tiết, cuộn tiếp và chụp phần mô tả còn lại.`
        : reason === "NO_TABLE"
          ? `Mở ${label} → Chi tiết, cuộn xuống cuối khung; có bảng cấp thì chụp.`
          : screen))
  const checks = {
    NO_IMAGE: "Đối chiếu tên, mô tả, hồi chiêu và bảng cấp.",
    NOT_SHOWN: "Đối chiếu tên, mô tả, hồi chiêu và bảng cấp.",
    CUT_OFF: "Đối chiếu phần cuối mô tả.",
    NO_TABLE: "Đối chiếu chỉ số theo cấp chiêu.",
  }[reason]
  const data = !known
    ? "Chưa biết ảnh này thuộc kỹ năng nào trong bản nháp."
    : !input.draft
      ? "Bản đã xuất bản chưa có ảnh để đối chiếu kỹ năng này."
      : !inDraft
        ? "Bản nháp chưa có kỹ năng này."
        : empty
          ? "Bản nháp chưa có tên hoặc mô tả."
          : reason === "CUT_OFF"
            ? "Mô tả đã nhập dừng ở chỗ ảnh bị cắt."
            : reason === "NO_TABLE"
              ? "Chỉ số theo cấp chưa đối chiếu được."
              : "Nội dung đã nhập chưa đối chiếu được."
  return {
    key: `skill:${item.skillKey}`,
    area: "SKILL",
    skillKey: item.skillKey,
    title,
    reason,
    weight,
    fixes: blocked ? "SKILLS" : undefined,
    problem,
    capture,
    checks,
    data,
    files: source ? [...source.withheld, ...(reason === "NOT_SHOWN" ? [] : source.shown)] : [],
  }
}

function skillGaps(input: SourceGapInput): SourceGap[] {
  const { coverage, draft, locale = "vi-VN" } = input
  const sources = new Map((coverage?.skills ?? []).map((source) => [source.skillKey, source]))
  const drafted = draft?.skills?.skills ?? []
  const items: SkillItem[] = drafted.map((skill) => ({
    skillKey: skill.skillKey,
    name: skillName(skill, locale) ?? sources.get(skill.skillKey)?.name ?? null,
    source: sources.get(skill.skillKey),
    inDraft: true,
    empty:
      !skill.translations.length || skill.translations.some((text) => !text.name.trim() || !text.description.trim()),
  }))
  const listed = new Set(items.map((item) => item.skillKey))
  for (const source of sources.values())
    if (!listed.has(source.skillKey))
      items.push({ skillKey: source.skillKey, name: source.name, source, inDraft: false, empty: false })
  // Neither a draft nor a capture names the skills, so they are asked for as a whole.
  if (!draft && !coverage)
    return [
      {
        key: "skills",
        area: "SKILL",
        title: "Kỹ năng",
        reason: "NO_IMAGE",
        weight: "UNCHECKED",
        problem: "Chưa có ảnh kỹ năng nào của tướng này.",
        capture: "Mở trang tướng, chạm từng biểu tượng kỹ năng → Chi tiết; chụp tên, toàn văn mô tả và bảng cấp.",
        checks: "Đối chiếu tên, mô tả, hồi chiêu và bảng cấp.",
        data: "Bản đã xuất bản chưa có ảnh để đối chiếu kỹ năng.",
        files: [],
      },
    ]

  const slots = items.map((item) => SKILL_KEY.exec(item.skillKey)?.[1])
  return items
    .map((item) => {
      const [, slot, variant] = SKILL_KEY.exec(item.skillKey) ?? []
      const base = slot === undefined ? item.skillKey : slot === "0" ? "Nội tại" : `Chiêu ${slot}`
      const shared = slot !== undefined && slots.filter((other) => other === slot).length > 1
      return skillGap(item, shared ? `${base} · ${variant}` : base, input)
    })
    .filter((gap): gap is SourceGap => !!gap)
}

/** Everything left to capture for one hero, strongest first. */
export function sourceGaps(input: SourceGapInput): SourceGap[] {
  const gaps = [statsGap(input), overviewGap(input), ...skillGaps(input)].filter((gap): gap is SourceGap => !!gap)
  return gaps.sort((a, b) => weights.indexOf(a.weight) - weights.indexOf(b.weight))
}

/** How useful a hero's captures are: those that would let it be published first. */
export function sourceGapGroup(gaps: readonly SourceGap[], blockers: readonly PublishBlocker[]): SourceGapGroup {
  if (!gaps.length) return "COMPLETE"
  const fixed = new Set(gaps.flatMap((gap) => (gap.fixes ? [gap.fixes] : [])))
  if (fixed.size) return blockers.every((blocker) => fixed.has(blocker.key)) ? "UNBLOCKS" : "PARTLY_UNBLOCKS"
  return weights.find((weight) => gaps.some((gap) => gap.weight === weight)) as SourceGapGroup
}

export const sourceGapGroupLabels: Record<SourceGapGroup, string> = {
  UNBLOCKS: "Chụp xong là đủ điều kiện xuất bản",
  PARTLY_UNBLOCKS: "Gỡ được một phần chặn xuất bản",
  MISSING_DATA: "Bổ sung dữ liệu còn thiếu",
  UNCHECKED: "Đối chiếu dữ liệu đã nhập",
  MINOR: "Nên xem lại",
  COMPLETE: "Đủ ảnh để đối chiếu",
}

export interface RankedHero {
  name: string
  published: boolean
  sources: HeroSourceGaps
}

/** Most useful first: captures that unblock publishing, then heroes never published, then those needing fewer captures. */
export function compareSourceGaps(a: RankedHero, b: RankedHero) {
  const needed = (hero: RankedHero) => hero.sources.gaps.filter((gap) => gap.weight !== "MINOR").length
  return (
    groups.indexOf(a.sources.group) - groups.indexOf(b.sources.group) ||
    Number(a.published) - Number(b.published) ||
    needed(a) - needed(b) ||
    a.name.localeCompare(b.name, "vi")
  )
}

/** The rows' capture sets: each revision's own patch when it has one, else the newest set. */
export function readinessCapturePatches(rows: readonly ReadinessRow[], patches: readonly string[]) {
  const codes = rows.flatMap((row) => {
    const set = captureSetFor(rowPatch(row), patches)
    return set ? [set.patchCode] : []
  })
  return [...new Set(codes)].sort()
}

const rowPatch = (row: ReadinessRow) => (row.draft ? row.draftPatch : row.publishedPatch)?.patchCode

/** What each row still needs captured; rows whose capture set has not loaded yet are left out. */
export function readinessSourceGaps(
  rows: readonly ReadinessRow[],
  patches: readonly string[],
  coverage: ReadonlyMap<string, ReadonlyMap<string, HeroSourceCoverage>>,
  locale: string,
): Map<string, HeroSourceGaps> {
  const result = new Map<string, HeroSourceGaps>()
  for (const row of rows) {
    // A hero with nothing written yet has nothing to check.
    if (!row.draft && !row.published) continue
    const set = captureSetFor(rowPatch(row), patches)
    const heroes = set && coverage.get(set.patchCode)
    if (!set || !heroes) continue
    const blockers = row.blockers
    const gaps = sourceGaps({ coverage: heroes.get(row.code), draft: row.facts, blockers, locale })
    result.set(row.rowKey, { ...set, gaps, group: sourceGapGroup(gaps, blockers) })
  }
  return result
}

/** Heroes with something left to capture, the captures that help most first. */
export function orderByCaptures(rows: readonly ReadinessRow[], gaps: ReadonlyMap<string, HeroSourceGaps>) {
  return rows
    .flatMap((row) => {
      const sources = gaps.get(row.rowKey)
      return sources && sources.group !== "COMPLETE"
        ? [{ row, name: row.name, published: !!row.published, sources }]
        : []
    })
    .sort(compareSourceGaps)
    .map(({ row }) => row)
}

/** How many heroes fall in each group, most useful first; complete heroes are not counted. */
export function sourceGapSummary(gaps: ReadonlyMap<string, HeroSourceGaps>) {
  const counts = groups
    .filter((group) => group !== "COMPLETE")
    .map((group) => ({ group, label: sourceGapGroupLabels[group], count: 0 }))
  for (const sources of gaps.values()) {
    const entry = counts.find((item) => item.group === sources.group)
    if (entry) entry.count++
  }
  return {
    heroes: counts.reduce((sum, item) => sum + item.count, 0),
    groups: counts.filter((item) => item.count > 0),
  }
}
