import { warehouseName, warehouseText } from "@aov/ui/lib/warehouse-content"
import type { WarehouseContents } from "@aov/ui/lib/warehouse-content"
import { formatGameNumber } from "@aov/ui/lib/game-number"
import { foldSearchText } from "@aov/ui/lib/search-text"
export type PublishedWarehouseRecord = {
  [K in WarehouseKind]: WarehouseEntry<WarehouseContents[K]> & { kind: K }
}[WarehouseKind]

import type { HeroMedia } from "./hero-api"

export type WarehouseKind = "items" | "enchantments" | "arcana" | "spells"

export const WAREHOUSE_SECTIONS = [
  { kind: "items", name: "Trang bị" },
  { kind: "enchantments", name: "Phù hiệu" },
  { kind: "arcana", name: "Bảng ngọc" },
  { kind: "spells", name: "Phụ trợ" },
] as const

export function warehouseKind(tab: string | null): WarehouseKind {
  return WAREHOUSE_SECTIONS.find((section) => section.kind === tab)?.kind ?? "items"
}

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

export interface WarehouseEntry<C extends WarehouseContent = WarehouseContent> {
  id: string
  code: string
  revision: {
    id: string
    state: string
    cause: string
    effectiveFromPatchVariantId: string | null
    publishedAt: string | null
  }
  content: C
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

export { warehouseText, warehouseName } from "@aov/ui/lib/warehouse-content"
export function warehouseImage(entry: WarehouseEntry, assetId = entry.content.iconAssetId) {
  return assetId ? entry.media?.[assetId]?.currentVersion?.url : undefined
}

export function matchesWarehouseSearch(entry: WarehouseEntry, query: string, locale = "vi-VN") {
  const text = warehouseText(entry.content.translations, locale)
  const haystack = foldSearchText(
    `${warehouseName(entry, locale)} ${entry.code} ${text?.summary ?? ""} ${text?.description ?? ""}`,
  )
  return foldSearchText(query)
    .trim()
    .split(/\s+/)
    .every((term) => haystack.includes(term))
}

export function warehouseStatValue(stat: WarehouseStat, locale = "vi-VN") {
  const value = formatGameNumber(stat.value, 3)
  return `${stat.value > 0 ? "+" : ""}${value}${stat.unit === "PERCENT" || stat.unit === "%" ? "%" : stat.unit === "SECONDS" ? (locale.startsWith("en") ? " s" : " giây") : ""}`
}

export function arcanaDetailDescription(text: WarehouseText | undefined, statRows: { label: string; value: string }[]) {
  const normalize = (line: string) =>
    line
      .trim()
      .toLowerCase()
      .replace(/(\d),(?=\d)/g, "$1.")
      .replace(/\s+/g, " ")
  const rows = new Set(statRows.map(({ label, value }) => normalize(`${label} ${value}`)))
  return [text?.description, text?.summary].find(
    (description) =>
      description?.trim() && description.split(/[;\n]/).some((line) => line.trim() && !rows.has(normalize(line))),
  )
}
