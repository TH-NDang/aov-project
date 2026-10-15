export const SECTIONS = [
  ["PROFILE", "profile", "Thông tin"],
  ["OVERVIEW_RATINGS", "overview-ratings", "Đánh giá"],
  ["COMBAT_STATS", "combat-stats", "Chỉ số"],
  ["SKILLS", "skills", "Kỹ năng"],
  ["SKINS", "skins", "Trang phục"],
  ["MEDIA_BINDINGS", "media-bindings", "Ảnh tướng"],
] as const
export type Section = (typeof SECTIONS)[number][0]
export const ROLES = {
  TANK: "Đỡ đòn",
  WARRIOR: "Đấu sĩ",
  ASSASSIN: "Sát thủ",
  MAGE: "Pháp sư",
  MARKSMAN: "Xạ thủ",
  SUPPORT: "Trợ thủ",
} as const
export type Role = keyof typeof ROLES
export interface Source {
  label: string
  sourceUrl: string | null
  observedAt: string | null
  verificationState: "UNVERIFIED" | "VERIFIED"
  note: string | null
}
export interface Translation {
  locale: string
  name: string
}
export interface Profile {
  translations: (Translation & { title: string | null; summary: string | null; lore: string | null })[]
  roles: Role[]
  sources: Source[]
}
export interface Ratings {
  scaleCode: string
  survivability: number
  attackDamage: number
  skillEffects: number
  difficulty: number
  derived: boolean
  sources: Source[]
}
export interface Stats {
  values: { statKey: string; baseValue: number | null; growthPerLevel: number | null; unit: string }[]
  sources: Source[]
}
export interface Skill {
  skillKey: string
  kind: "PASSIVE" | "ACTIVE" | "OTHER"
  formKey: string | null
  displayOrder: number
  iconAssetId: string | null
  translations: (Translation & { description: string })[]
  effects: { effectType: string; metadata: Record<string, unknown> }[]
}
export interface Skills {
  skills: Skill[]
  sources: Source[]
}
export interface Skin {
  skinKey: string
  displayOrder: number
  artAssetId: string | null
  rarityCode: string | null
  translations: (Translation & { description: string | null; acquisitionNote: string | null })[]
}
export interface Skins {
  skins: Skin[]
  sources: Source[]
}
export type MediaRole = "HEAD" | "PORTRAIT" | "SPLASH"
export interface Bindings {
  bindings: Partial<Record<MediaRole, string>>
  sources: Source[]
}
export interface Content {
  PROFILE: Profile | null
  OVERVIEW_RATINGS: Ratings | null
  COMBAT_STATS: Stats | null
  SKILLS: Skills | null
  SKINS: Skins | null
  MEDIA_BINDINGS: Bindings | null
}
export type Cause =
  "GAME_PATCH" | "CONTENT_CORRECTION" | "TRANSLATION" | "IMPORT_CORRECTION" | "VISUAL_UPDATE" | "OTHER"
export interface Revision {
  id: string
  heroId: string
  rulesetId: string
  revisionNo: number
  state: "DRAFT" | "PUBLISHED" | "DISCARDED"
  version: number
  cause: Cause
  sections: Record<Section, string>
  publishedAt: string | null
  sourceRevisionId: string | null
  effectiveFromPatchVariantId: string | null
}
export interface Preview {
  revision: Revision
  content: Content
}
export interface HeroRow {
  id: string
  code: string
  revisions: Revision[]
}
export interface PageSlice<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
}
export interface Ruleset {
  id: string
  code: string
  description: string
}
export interface Region {
  id: string
  code: string
  displayName: string
  available: boolean
}
export interface Asset {
  id: string
  semanticType: string
  state: string
  version: number
  currentVersionId: string | null
  currentUrl: string | null
}

export function publishIssues(content: Content): string[] {
  const issues: string[] = []
  if (!content.PROFILE?.roles.length || !content.PROFILE.translations.length)
    issues.push("Điền thông tin và vai trò tướng.")
  const ratings = content.OVERVIEW_RATINGS
  if (
    !ratings?.scaleCode ||
    [ratings.survivability, ratings.attackDamage, ratings.skillEffects, ratings.difficulty].some(
      (value) => !Number.isFinite(value) || value < 0 || value > 10,
    )
  )
    issues.push("Bổ sung đánh giá có căn cứ.")
  if (!content.COMBAT_STATS?.values.length) issues.push("Bổ sung chỉ số đã kiểm tra.")
  if (
    !content.SKILLS?.skills.length ||
    content.SKILLS.skills.some(
      (s) => !s.translations.length || s.translations.some((t) => !t.description.trim() || !t.name.trim()),
    )
  )
    issues.push("Bổ sung tên và mô tả đầy đủ cho các kỹ năng.")
  if (!content.SKINS) issues.push("Lưu danh sách trang phục.")
  if (["HEAD", "PORTRAIT", "SPLASH"].some((role) => !content.MEDIA_BINDINGS?.bindings[role as MediaRole]))
    issues.push("Chọn đủ ảnh Head, Portrait và Splash.")
  return issues
}
