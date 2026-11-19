import type { WarehouseMetadata } from "./warehouse-types"
import type { WarehouseContent, WarehouseStat, SpellContent } from "@aov/ui/lib/warehouse-content"

export type SecondaryKind = "arcana" | "spells" | "enchantments"

export interface SecondaryContent extends WarehouseContent {
  color?: "RED" | "PURPLE" | "GREEN"
  tier?: number
  stats?: WarehouseStat[]
  branchCode?: string
  position?: number | null
  cooldownSeconds?: number | null
  unlockType?: "ACCOUNT_CREATION" | "LEVEL" | "UNKNOWN"
  unlockLevel?: number | null
  chargeRechargeSeconds?: number | null
  maxCharges?: number | null
  defaultStateKey?: string | null
  referenceImages?: { assetId: string; notes: string | null }[]
  availability?: "AVAILABLE" | "REMOVED" | "UNKNOWN"
  legacy?: boolean
  displayOrder?: number
  states?: SpellContent["states"]
}

export type SecondaryBranch = WarehouseMetadata

export const secondaryNames: Record<SecondaryKind, string> = {
  arcana: "ngọc",
  spells: "phụ trợ",
  enchantments: "phù hiệu",
}

export const semanticTypes: Record<SecondaryKind, string> = {
  arcana: "ARCANA_ICON",
  spells: "SPELL_ICON",
  enchantments: "ENCHANTMENT_ICON",
}

export function newSecondaryContent(kind: SecondaryKind, locale: string, branchCode = ""): SecondaryContent {
  const shared = {
    iconAssetId: null,
    notes: null,
    translations: [{ locale, name: "", summary: null, description: null }],
  }
  if (kind === "arcana") return { ...shared, color: "RED", tier: 3, stats: [] }
  if (kind === "enchantments") return { ...shared, branchCode, tier: 1, position: 0 }
  return {
    ...shared,
    cooldownSeconds: null,
    unlockType: "UNKNOWN",
    unlockLevel: null,
    chargeRechargeSeconds: null,
    maxCharges: null,
    defaultStateKey: null,
    referenceImages: [],
    availability: "UNKNOWN",
    legacy: false,
    displayOrder: 0,
    states: [],
  }
}
