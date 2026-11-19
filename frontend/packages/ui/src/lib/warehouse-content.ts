import { DEFAULT_LOCALE, pickTranslation } from "@aov/ui/lib/translation-fallback"

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
export type CatalogBadgeKind =
  | "DATA_BASELINE"
  | "ADDED"
  | "UPDATED"
  | "REMOVED"
  | "BUFF"
  | "NERF"
  | "BALANCE"
  | "REWORK"
  | "FIX"
  | "UNCHANGED"
  | "INHERITED"

export interface WarehouseEntry<C extends WarehouseContent = WarehouseContent> {
  id: string
  code: string
  revision: { state: string; effectiveFromPatchVariantId: string | null }
  content: C
  changeKinds?: CatalogBadgeKind[]
  missingFields?: string[]
}

export interface WarehouseMetadata {
  code: string
  displayOrder: number
  iconAssetId: string | null
  backgroundAssetId: string | null
  color: string | null
  translations: { locale: string; name: string; description?: string | null; suitability?: string | null }[]
}
/** The translation in the reader's language, falling back as `pickTranslation` does. */
export function warehouseText<T extends { locale: string }>(
  translations: readonly T[],
  locale = DEFAULT_LOCALE,
): T | undefined {
  return pickTranslation(translations, locale)
}
export function warehouseName(
  entry: Pick<WarehouseEntry, "code"> & { content: Pick<WarehouseContent, "translations"> },
  locale = "vi-VN",
) {
  return warehouseText(entry.content.translations, locale)?.name || entry.code
}
