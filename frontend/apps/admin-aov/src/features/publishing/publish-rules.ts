import { observedAttributes } from "./combat-attributes"
import type { Content, MediaRole, Revision, Section } from "./types"

/**
 * What decides whether a draft may be published, for the header button and the overview of all heroes alike. The
 * server validates again when publishing and has the final say.
 */
export type PublishBlockerKey = "PATCH" | Section
export interface PublishBlocker {
  key: PublishBlockerKey
  message: string
}

/** Only what the rules read, so a list of every hero can load it without whole revisions. */
export interface PublishContent {
  PROFILE: { roles: readonly unknown[]; translations: readonly unknown[] } | null
  OVERVIEW_RATINGS: {
    scaleCode: string | null
    survivability: number | null
    attackDamage: number | null
    skillEffects: number | null
    difficulty: number | null
  } | null
  COMBAT_STATS: { values: readonly unknown[] } | null
  SKILLS: { skills: readonly { translations: readonly { name: string; description: string }[] }[] } | null
  SKINS: object | null
  MEDIA_BINDINGS: { bindings: Partial<Record<MediaRole, unknown>> } | null
}

type PublicationRevision = Pick<Revision, "cause" | "rulesetId" | "effectiveFromPatchVariantId">
type PublicationPatch = { rulesetId: string; patchCode: string; status: string }

export function publicationPatchIssue(
  revision: PublicationRevision,
  patch: PublicationPatch | undefined,
  loading: boolean,
): string | null {
  if (!revision.effectiveFromPatchVariantId)
    return revision.cause === "DATA_BASELINE" || revision.cause === "GAME_PATCH"
      ? "Chọn patch áp dụng cho bản nháp trước khi xuất bản tướng."
      : null
  if (!patch) return loading ? "Đang kiểm tra trạng thái patch…" : "Chưa xác minh được patch của bản nháp."
  if (patch.rulesetId !== revision.rulesetId) return "Patch của bản nháp thuộc bộ quy tắc khác."
  return patch.status === "PUBLISHED" ? null : `Hãy xuất bản patch ${patch.patchCode} trước khi xuất bản tướng.`
}

/**
 * A hero that holds forms publishes only what its forms share (ADR-024): its names and title, its skins and the three
 * card images. Roles, ratings, stats and skills belong to the forms, so they are not asked of it.
 */
function holderBlockers(content: PublishContent): PublishBlocker[] {
  const blockers: PublishBlocker[] = []
  if (!content.PROFILE?.translations.length) blockers.push({ key: "PROFILE", message: "Điền tên và danh hiệu tướng." })
  if (!content.SKINS) blockers.push({ key: "SKINS", message: "Lưu danh sách trang phục." })
  if ((["HEAD", "PORTRAIT", "SPLASH"] as const).some((role) => !content.MEDIA_BINDINGS?.bindings[role]))
    blockers.push({ key: "MEDIA_BINDINGS", message: "Chọn đủ ảnh Head, Portrait và Splash." })
  return blockers
}

export function contentBlockers(
  content: PublishContent,
  hasObservedStats = false,
  holdsForms = false,
): PublishBlocker[] {
  if (holdsForms) return holderBlockers(content)
  const blockers: PublishBlocker[] = []
  if (!content.PROFILE?.roles.length || !content.PROFILE.translations.length)
    blockers.push({ key: "PROFILE", message: "Điền thông tin và vai trò tướng." })
  const ratings = content.OVERVIEW_RATINGS
  if (
    !ratings?.scaleCode ||
    [ratings.survivability, ratings.attackDamage, ratings.skillEffects, ratings.difficulty].some(
      (value) => value === null || !Number.isFinite(value) || value < 0 || value > 10,
    )
  )
    blockers.push({ key: "OVERVIEW_RATINGS", message: "Bổ sung đánh giá có căn cứ." })
  if (!content.COMBAT_STATS || (!content.COMBAT_STATS.values.length && !hasObservedStats))
    blockers.push({
      key: "COMBAT_STATS",
      message: "Cần có chỉ số riêng của tướng hoặc thuộc tính ghi nhận từ ảnh của patch này.",
    })
  if (
    !content.SKILLS?.skills.length ||
    content.SKILLS.skills.some(
      (s) => !s.translations.length || s.translations.some((t) => !t.description.trim() || !t.name.trim()),
    )
  )
    blockers.push({ key: "SKILLS", message: "Bổ sung tên và mô tả đầy đủ cho các kỹ năng." })
  if (!content.SKINS) blockers.push({ key: "SKINS", message: "Lưu danh sách trang phục." })
  if ((["HEAD", "PORTRAIT", "SPLASH"] as const).some((role) => !content.MEDIA_BINDINGS?.bindings[role]))
    blockers.push({ key: "MEDIA_BINDINGS", message: "Chọn đủ ảnh Head, Portrait và Splash." })
  return blockers
}

/** Everything standing in the way of publishing a draft, its patch first. */
export function publishBlockers({
  revision,
  content,
  patch,
  patchLoading,
  observedStats,
  holdsForms = false,
}: {
  revision: PublicationRevision
  content: PublishContent
  patch: PublicationPatch | undefined
  patchLoading: boolean
  observedStats: boolean
  /** The hero holds forms, so only what the forms share is asked of it. */
  holdsForms?: boolean
}): PublishBlocker[] {
  const patchIssue = publicationPatchIssue(revision, patch, patchLoading)
  return [
    ...(patchIssue ? [{ key: "PATCH" as const, message: patchIssue }] : []),
    ...contentBlockers(content, observedStats, holdsForms),
  ]
}

/** Whether screenshots of the draft's own patch stand in for hero stats that were never entered. */
export function usesObservedStats(content: Content, patch: Pick<PublicationPatch, "patchCode"> | undefined) {
  return !content.COMBAT_STATS?.values.length && !!patch && !!observedAttributes(content.SKILLS, patch.patchCode)
}

/** Where to publish a draft's patch, when that is what the draft is waiting for. */
export function publicationPatchLink(
  revision: Pick<Revision, "rulesetId">,
  patch: (PublicationPatch & { id: string; seasonId?: string | null }) | undefined,
) {
  if (patch?.status !== "DRAFT" || patch.rulesetId !== revision.rulesetId) return undefined
  return { to: `/game-configuration?season=${patch.seasonId ?? ""}&patch=${patch.id}`, code: patch.patchCode }
}
