import type { HeroMedia } from "../hero/hero-api"

export type WarehouseKind = "items" | "enchantments" | "arcana" | "spells"

export const WAREHOUSE_SECTIONS = [
  { kind: "items", name: "Trang bị" },
  { kind: "enchantments", name: "Phù hiệu" },
  { kind: "arcana", name: "Bảng ngọc" },
  { kind: "spells", name: "Phụ trợ" },
] as const

export interface WarehouseText {
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
  translations: WarehouseText[]
  tier?: number | null
  price?: number | null
  categoryCode?: string | null
  shopPositions?: { categoryCode: string; row: number | null; column: number | null; variant: string | null }[]
  recipeStatus?: "UNKNOWN" | "NONE" | "VERIFIED"
  components?: { itemId: string; quantity: number }[]
  stats?: WarehouseStat[]
  branchCode?: string
  position?: number | null
  color?: "RED" | "PURPLE" | "GREEN"
  cooldownSeconds?: number | null
  unlockLevel?: number | null
  availability?: "AVAILABLE" | "REMOVED" | "UNKNOWN"
  legacy?: boolean
  displayOrder?: number
  unlockType?: "ACCOUNT_CREATION" | "LEVEL" | "UNKNOWN"
  chargeRechargeSeconds?: number | null
  maxCharges?: number | null
  defaultStateKey?: string | null
  states?: { key: string; iconAssetId: string | null; translations: WarehouseText[] }[]
}

export interface WarehouseEntry {
  id: string
  code: string
  revision: {
    id: string
    state: string
    cause: string
    effectiveFromPatchVariantId: string | null
    publishedAt: string | null
  }
  content: WarehouseContent
  media?: Record<string, HeroMedia>
}

export interface WarehouseGroup {
  code: string
  displayOrder: number
  color: string | null
  translations: { locale: string; name: string; description?: string | null }[]
  icon?: HeroMedia | null
  background?: HeroMedia | null
}

export function warehouseText<T extends { locale: string }>(translations: T[], locale = "vi-VN"): T | undefined {
  return (
    translations.find((text) => text.locale === locale) ??
    translations.find((text) => text.locale === "vi-VN") ??
    translations[0]
  )
}

export function warehouseName(entry: WarehouseEntry) {
  return warehouseText(entry.content.translations)?.name || entry.code
}

export function warehouseImage(entry: WarehouseEntry, assetId = entry.content.iconAssetId) {
  return assetId ? entry.media?.[assetId]?.currentVersion?.url : undefined
}

export function matchesWarehouseSearch(entry: WarehouseEntry, query: string) {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()
  const haystack = normalize(`${warehouseName(entry)} ${entry.code}`)
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((term) => haystack.includes(term))
}

export function warehouseStatValue(stat: WarehouseStat, locale = "vi-VN") {
  const value = stat.value.toLocaleString(locale, { maximumFractionDigits: 3 })
  return `${stat.value > 0 ? "+" : ""}${value}${stat.unit === "PERCENT" || stat.unit === "%" ? "%" : stat.unit === "SECONDS" ? (locale.startsWith("en") ? " s" : " giây") : ""}`
}
