export type WarehouseKind = "items" | "enchantments" | "arcana" | "spells"
export interface WarehouseTranslation {
  locale: string
  name: string
  summary?: string | null
  description?: string | null
  statLabels?: Record<string, string>
  variantLabels?: Record<string, string>
  effects?: { key: string; name: string; description: string; type?: string | null }[]
}
export interface WarehouseStat {
  key: string
  value: number
  unit: string | null
}
export interface WarehouseContent {
  iconAssetId: string | null
  translations: WarehouseTranslation[]
  notes: string | null
}
export interface ItemContent extends WarehouseContent {
  tier: number | null
  price: number | null
  categoryCode: string | null
  shopPositions: { categoryCode: string; row: number | null; column: number | null; variant: string | null }[]
  recipeStatus: "UNKNOWN" | "NONE" | "VERIFIED"
  components: { itemId: string; quantity: number }[]
  stats: WarehouseStat[]
}
export interface EnchantmentContent extends WarehouseContent {
  branchCode: string
  tier: number
  position: number | null
}
export interface ArcanaContent extends WarehouseContent {
  color: "RED" | "PURPLE" | "GREEN"
  tier: number
  stats: WarehouseStat[]
}
export interface SpellContent extends WarehouseContent {
  cooldownSeconds: number | null
  unlockLevel: number | null
  availability: "AVAILABLE" | "REMOVED" | "UNKNOWN"
  legacy: boolean
  displayOrder: number
  unlockType?: "ACCOUNT_CREATION" | "LEVEL" | "UNKNOWN"
  chargeRechargeSeconds?: number | null
  maxCharges?: number | null
  defaultStateKey?: string | null
  referenceImages?: { assetId: string; notes: string | null }[]
  states: { key: string; iconAssetId: string | null; translations: WarehouseTranslation[] }[]
}
export interface WarehouseContents {
  items: ItemContent
  enchantments: EnchantmentContent
  arcana: ArcanaContent
  spells: SpellContent
}
export interface WarehouseRevision {
  id: string
  ownerId: string
  code: string
  rulesetId: string
  revisionNo: number
  state: "DRAFT" | "PUBLISHED" | "DISCARDED"
  version: number
  publicationSequence: number | null
  publishedAt: string | null
  cause: "DATA_BASELINE" | "GAME_PATCH" | "CONTENT_CORRECTION" | "TRANSLATION_UPDATE"
  effectiveFromPatchVariantId: string | null
  sourceRevisionId: string | null
  createdAt: string
  updatedAt: string
  archived?: boolean
}
export interface WarehouseEntry<C extends WarehouseContent = WarehouseContent> {
  id: string
  code: string
  revision: WarehouseRevision
  content: C
  issues?: string[]
  changeKinds?: import("./catalog-changes").CatalogBadgeKind[]
  missingFields?: string[]
}

export type WarehouseBaselineMode = "initial" | "inherited"

export function warehouseBaselineMode(
  revision: Pick<WarehouseRevision, "cause" | "effectiveFromPatchVariantId" | "sourceRevisionId">,
  missingFields: string[] = [],
): WarehouseBaselineMode | undefined {
  if (revision.cause === "DATA_BASELINE" && !revision.sourceRevisionId) return "initial"
  if (
    !revision.effectiveFromPatchVariantId &&
    revision.sourceRevisionId &&
    ["CONTENT_CORRECTION", "TRANSLATION_UPDATE"].includes(revision.cause) &&
    !missingFields.includes("effectiveFromPatchVariantId")
  )
    return "inherited"
  return undefined
}

export interface WarehouseMetadata {
  code: string
  version: number
  displayOrder: number
  iconAssetId: string | null
  backgroundAssetId: string | null
  color: string | null
  translations: { locale: string; name: string; description?: string | null; suitability?: string | null }[]
}
export function warehouseText<T extends { locale: string }>(translations: T[], locale: string): T | undefined {
  return (
    translations.find((text) => text.locale === locale) ??
    translations.find((text) => text.locale === "vi-VN") ??
    translations[0]
  )
}
export function warehouseName(entry: WarehouseEntry, locale: string) {
  return warehouseText(entry.content.translations, locale)?.name || entry.code
}

export interface SpellRemoval {
  id: string
  revisionId: string
  rulesetId: string
  patchVariantId: string
  sourceUrl: string
  notes: string | null
  recordedAt: string
}
