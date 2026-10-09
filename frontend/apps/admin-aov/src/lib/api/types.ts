/**
 * Domain types for the admin app. They mirror the working data set in `resources/Lien-Quan-v3/data`
 * until the wiki-service admin API publishes its OpenAPI contract.
 */

/** Every mutable record carries an optimistic concurrency version (spec 01, section 9.1). */
export interface Versioned {
  version: number
}

export type SkillSwitchMode = "none" | "skill-variant" | "hero-form"

export interface SkillVariant {
  index: number
  icon: string | null
  sourceUrl: string | null
  video: { src: string; poster?: string } | null
}

export interface Skill {
  /** 0 = passive, 1+ = active skills. */
  slot: number
  name: string
  description: string | null
  variants: SkillVariant[]
  switchMode: SkillSwitchMode
}

export interface HeroForm {
  id: string
  name: string
  variantBySlot: Record<string, number>
}

export interface Skin {
  id: string
  sourceSkinId: string
  name: string
  fullName: string
  isDefault: boolean
  badgeId: string | null
  head: string | null
  cover: string | null
  portrait: string | null
  portraitAlternates: string[]
  portraitFileName?: string
  createdAt?: string
}

export interface Hero extends Versioned {
  id: string
  name: string
  head: string | null
  cover: string | null
  listHead: string | null
  forms: HeroForm[]
  skills: Skill[]
  skins: Skin[]
  sources: { portraits?: string; skills?: string }
  portrait: string | null
  portraitAlternates: string[]
  formLabelNote?: string
}

export interface SkinBadge {
  id: string
  icon: string
}

export type PortraitKind = "hero" | "skin"

/** One exported portrait file. Ownership is derived from hero data, not from these fields. */
export interface PortraitSource {
  file: string
  figmaName: string
  hero: string
  kind: PortraitKind
  skinId: string | null
  isPrimary: boolean
  frameOrder: number
  method: string
  matchTitle: string | null
  /** [score 0..1, sourceSkinId, title] */
  suggestions: [number, string, string][]
  width: number
  height: number
  bytes: number
  sha256: string
  assetId: string
  editedAt?: string
}

export type PortraitRole = "primary" | "alternate"

export interface PortraitOwner {
  heroId: string
  /** `null` when the image belongs to the hero itself (default skin). */
  skinId: string | null
  role: PortraitRole
}

export interface ItemCategory {
  index: number
  id: string
  name: string
}

export interface ShopPosition {
  group: string
  row: number | null
  column: number | null
  variant: string | null
}

export type RecipeStatus = "none" | "unverified" | "verified"

export interface RecipeComponent {
  itemId: string
  quantity: number
}

export interface Item {
  id: string
  name: string
  image: string
  category: string
  tier: 1 | 2 | 3
  price: number
  summary: string
  description: string
  shopPositions: ShopPosition[]
  recipe: { status: RecipeStatus; components: RecipeComponent[] }
}

export interface ItemCatalog extends Versioned {
  collectedOn: string
  categories: ItemCategory[]
  items: Item[]
}

export type ItemIssueCode = "level_difference" | "missing_position" | "duplicate_position" | "shared_support_position"

export interface ItemIssue {
  id: string
  code: ItemIssueCode
  itemIds: string[]
  message: string
  excelLevel?: number
  garenaLevel?: number
  excelCell?: string
  position?: { group: string; row: number; column: number }
}

export interface ImageFileMeta {
  file: string
  sourceUrl?: string
  width?: number
  height?: number
  sha256?: string
  derived?: boolean
  note?: string
}

export interface EnchantmentGroup {
  id: string
  name: string
  order: number
  description: string
  background: ImageFileMeta
  icon: ImageFileMeta
}

export interface EnchantmentPosition {
  group: string
  row: number
  column: number
}

export interface Enchantment extends Versioned {
  id: string
  name: string
  groupId: string
  tier: 1 | 2 | 3
  tierLabel: "I" | "II" | "III"
  summary: string
  description: string
  position: EnchantmentPosition
  websitePosition: EnchantmentPosition | null
  image: ImageFileMeta
  source: { sheet: string; row: number; raw: Record<string, string> }
}

export interface ArcanaStatus {
  status: string
  note: string
  count: number
}

export interface AuditEntry {
  id: string
  at: string
  action: string
  entityType: "hero" | "skin" | "portrait" | "item" | "enchantment" | "data"
  entityId: string
  label: string
}

export interface WikiSnapshot {
  heroes: Hero[]
  badges: SkinBadge[]
  portraits: PortraitSource[]
  items: ItemCatalog
  itemIssues: ItemIssue[]
  enchantmentGroups: EnchantmentGroup[]
  enchantments: Enchantment[]
  arcana: ArcanaStatus
}
