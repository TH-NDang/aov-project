import type { components } from "@/features/publishing/generated/hero-api"
import { LANE_LABELS } from "@/lib/lanes"
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
/** A hero's lanes, named like a player's lane in the one table of lane names. */
export const POSITIONS = {
  TOP: LANE_LABELS.TOP.name,
  MID: LANE_LABELS.MID.name,
  JUNGLE: LANE_LABELS.JUNGLE.name,
  DRAGON: LANE_LABELS.DRAGON.name,
  SUPPORT: LANE_LABELS.SUPPORT.name,
} as const
export type Position = keyof typeof POSITIONS
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
/**
 * The editor's own reading of a hero in one language (ADR-029). It is saved through its own endpoint, so profile edits
 * keep it; missing in content saved before it existed.
 */
export interface HeroNotes {
  strengths?: string | null
  weaknesses?: string | null
  counterTips?: string | null
}
export interface Profile {
  translations: (Translation & { title: string | null; summary: string | null; lore: string | null } & HeroNotes)[]
  roles: Role[]
  /** Missing in drafts saved in this browser before lanes became part of the profile. */
  positions?: Position[]
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
  values: {
    statKey: string
    baseValue: number | null
    /** The percent the game shows after the bar, as in "150 | 20%". Only the stats in `stat-reading.ts` have one. */
    percentValue?: number | null
    unit: string
  }[]
  sources: Source[]
}
/** The icon a skill shows in a named state, while its name, text and numbers stay those of the skill. */
export interface SkillStateIcon {
  assetId: string
  label: string
}
export interface Skill {
  skillKey: string
  kind: "PASSIVE" | "ACTIVE" | "OTHER"
  formKey: string | null
  displayOrder: number
  iconAssetId: string | null
  /** `summary` is the short plain text editors write beside the game's description; missing or null means none. */
  translations: (Translation & { description: string; summary?: string | null })[]
  effects: { effectType: string; metadata: Record<string, unknown> }[]
  /** Read as empty when missing; content saved before states existed has none. */
  stateIcons?: SkillStateIcon[]
}
export type TraitCode = import("@aov/ui/lib/hero-traits").HeroTraitCode
/** A yes/no trait an editor confirmed, the skills that give it and a one-line detail per language (ADR-029). */
export interface Trait {
  code: TraitCode
  skillKeys: string[]
  translations: { locale: string; detail: string }[]
}
export interface Skills {
  skills: Skill[]
  sources: Source[]
  /** Saved through its own endpoint, so skill edits keep it; missing in content saved before traits existed. */
  traits?: Trait[]
}
export interface Skin {
  skinKey: string
  displayOrder: number
  artAssetId: string | null
  headAssetId?: string | null
  portraitAssetId?: string | null
  images?: Partial<Record<MediaRole, ImageOption[]>>
  rarityCode: string | null
  translations: (Translation & { description: string | null; acquisitionNote: string | null })[]
}
export interface Skins {
  skins: Skin[]
  sources: Source[]
}
export type MediaRole = "HEAD" | "PORTRAIT" | "SPLASH"
export interface ImageOption {
  assetId: string
  label: string | null
}
export interface Bindings {
  bindings: Partial<Record<MediaRole, string>>
  images?: Partial<Record<MediaRole, ImageOption[]>>
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
type Schemas = components["schemas"]
export type Cause = Schemas["HeroComparisonRevision"]["cause"]
/** A hero revision as the API sends it; the contract keys its section ids by any string, they are keyed by section. */
export type Revision = Omit<Schemas["HeroComparisonRevision"], "sections"> & { sections: Record<Section, string> }
export interface Preview {
  revision: Revision
  content: Content
}
/** A row of the Admin hero catalog; `holderId`, `formKey` and `formIds` place it among forms (ADR-024). */
export type HeroRow = Omit<Schemas["HeroCatalogRow"], "revisions"> & { revisions: Revision[] }
export type HeroGameplayChange = Schemas["HeroCatalogGameplayChange"]
export type ChangeSource = HeroGameplayChange["sourceKind"]
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
  timeZone?: string
  available: boolean
}
export interface Asset {
  sources?: import("@aov/ui/lib/media-credit").MediaCredit[]
  id: string
  semanticType: string
  state: string
  version: number
  currentVersionId: string | null
  currentUrl: string | null
}
export interface AssetProvenance {
  ownerPageId?: string | null
  relatedPageId?: string | null
  referenceVersion?: number
  ownerName?: string | null
  contactUrl?: string | null
  id: string
  versionId: string | null
  type: string
  label: string
  /** Recorded without evidence of where the image came from; Admin words it instead of its label. */
  unverified?: boolean
  url: string | null
  observedAt: string | null
  note: string | null
}
export interface AssetDetail extends Asset {
  provenance: AssetProvenance[]
}
