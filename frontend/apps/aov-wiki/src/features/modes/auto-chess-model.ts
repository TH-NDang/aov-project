/** Shapes and pure rules of the auto-chess guide, shared by the Wiki pages and their tests. */

export interface ModeCredit {
  type: string
  label: string
  url?: string | null
  ownerName?: string | null
  contactUrl?: string | null
  observedAt?: string | null
}

export interface ModeImage {
  assetId: string
  versionId: string
  url: string
  width: number
  height: number
  credits: ModeCredit[]
  focalPoint?: { x: number; y: number } | null
}

export interface RuleSection {
  group?: string | null
  title: string
  body?: string | null
}

export interface TraitTier {
  count: number
  effect: string
}

export interface Trait {
  code: string
  kind: "FACTION" | "CLASS"
  name: string
  description?: string | null
  iconAssetId?: string | null
  tiers: TraitTier[]
  note?: string | null
}

export interface Unit {
  code: string
  name: string
  cost: number
  traitCodes: string[]
  portraitAssetId?: string | null
  heroCode?: string | null
  skill?: {
    name?: string | null
    description?: string | null
    iconAssetId?: string | null
    valueLabel?: string | null
    values: string[]
  } | null
  stats?: { health: number[]; physicalAttack: number[]; armor: number[]; magicResistance: number[] } | null
  complete: boolean
  note?: string | null
}

export interface ItemGroup {
  code: string
  name: string
  slotCount?: number | null
}

export interface Item {
  code: string
  name: string
  effect?: string | null
  groupCode?: string | null
  slot?: number | null
  iconAssetId?: string | null
}

export interface Blessing {
  code: string
  tier: "NORMAL" | "EPIC" | "LEGENDARY"
  name: string
  description?: string | null
  iconAssetId?: string | null
}

export interface Quest {
  code: string
  task: string
  reward?: string | null
}

export interface LineupUnit {
  unitCode: string
  carry: boolean
  row?: "FRONT" | "MIDDLE" | "BACK" | null
  itemCodes: string[]
}

export interface Lineup {
  id: string
  code: string
  name: string
  tier?: "S" | "A" | "B" | "C" | null
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null
  summary?: string | null
  units: LineupUnit[]
  emblems: string[]
  blessingCodes: string[]
  notes?: string | null
}

export interface GuideContent {
  edition?: string | null
  observedOn?: string | null
  summary?: string | null
  rules: RuleSection[]
  traits: Trait[]
  units: Unit[]
  itemGroups: ItemGroup[]
  items: Item[]
  blessings: Blessing[]
  quests: Quest[]
  lineups: Lineup[]
  sources: { label: string; url?: string | null; observedOn?: string | null }[]
}

export const MAX_LINEUP_UNITS = 10
export const MAX_EMBLEMS = 3

export const TRAIT_KIND_LABEL: Record<Trait["kind"], string> = { FACTION: "Phe", CLASS: "Nghề" }
export const BLESSING_TIER_LABEL: Record<Blessing["tier"], string> = {
  NORMAL: "Thường",
  EPIC: "Huyền thoại / Sử thi",
  LEGENDARY: "Truyền thuyết",
}
export const ROW_LABEL: Record<NonNullable<LineupUnit["row"]>, string> = {
  FRONT: "Hàng đầu",
  MIDDLE: "Hàng giữa",
  BACK: "Hàng sau",
}
export const DIFFICULTY_LABEL: Record<NonNullable<Lineup["difficulty"]>, string> = {
  EASY: "Dễ",
  MEDIUM: "Vừa",
  HARD: "Khó",
}

export interface TraitCount {
  trait: Trait
  count: number
  /** Index of the reached tier, or -1 before the first threshold. */
  reachedTier: number
  /** Units still needed for the next threshold, or null when the top tier is reached. */
  missing: number | null
}

/**
 * Counts each distinct unit once, adds one per emblem and picks the highest threshold reached. Active traits come
 * first, then the closest to their next threshold.
 */
export function traitCounts(
  guide: Pick<GuideContent, "traits" | "units">,
  unitCodes: string[],
  emblems: string[] = [],
) {
  const units = new Map(guide.units.map((unit) => [unit.code, unit]))
  const counts = new Map<string, number>()
  for (const code of new Set(unitCodes)) {
    for (const trait of units.get(code)?.traitCodes ?? []) counts.set(trait, (counts.get(trait) ?? 0) + 1)
  }
  for (const trait of emblems) counts.set(trait, (counts.get(trait) ?? 0) + 1)

  const result: TraitCount[] = []
  for (const trait of guide.traits) {
    const count = counts.get(trait.code) ?? 0
    if (!count) continue
    let reachedTier = -1
    trait.tiers.forEach((tier, index) => {
      if (tier.count <= count) reachedTier = index
    })
    const next = trait.tiers[reachedTier + 1]
    result.push({ trait, count, reachedTier, missing: next ? next.count - count : null })
  }
  return result.sort(
    (a, b) =>
      Number(b.reachedTier >= 0) - Number(a.reachedTier >= 0) ||
      b.reachedTier - a.reachedTier ||
      (a.missing ?? 99) - (b.missing ?? 99) ||
      a.trait.name.localeCompare(b.trait.name, "vi"),
  )
}

/** Total gold of one copy of each unit, and the count of units by cost. */
export function costSummary(guide: Pick<GuideContent, "units">, unitCodes: string[]) {
  const units = new Map(guide.units.map((unit) => [unit.code, unit]))
  const byCost = new Map<number, number>()
  let total = 0
  for (const code of new Set(unitCodes)) {
    const unit = units.get(code)
    if (!unit) continue
    total += unit.cost
    byCost.set(unit.cost, (byCost.get(unit.cost) ?? 0) + 1)
  }
  return { total, byCost: [...byCost.entries()].sort((a, b) => a[0] - b[0]) }
}

/** Units sharing a trait with the lineup that would raise one of its traits to the next threshold. */
export function suggestUnits(
  guide: Pick<GuideContent, "traits" | "units">,
  unitCodes: string[],
  emblems: string[] = [],
) {
  const chosen = new Set(unitCodes)
  const counts = traitCounts(guide, unitCodes, emblems)
  const close = new Map(counts.filter((c) => c.missing !== null).map((c) => [c.trait.code, c.missing!]))
  return guide.units
    .filter((unit) => !chosen.has(unit.code) && unit.traitCodes.some((trait) => close.has(trait)))
    .map((unit) => ({
      unit,
      gains: unit.traitCodes.filter((trait) => close.get(trait) === 1),
      shared: unit.traitCodes.filter((trait) => close.has(trait)),
    }))
    .sort((a, b) => b.gains.length - a.gains.length || b.shared.length - a.shared.length || a.unit.cost - b.unit.cost)
}

const CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A builder lineup as a short query string: `u=violet*,florentino&e=dau-si` (an asterisk marks a carry). */
export function encodeLineup(units: { unitCode: string; carry: boolean }[], emblems: string[]) {
  const params = new URLSearchParams()
  if (units.length) params.set("u", units.map((unit) => unit.unitCode + (unit.carry ? "*" : "")).join(","))
  if (emblems.length) params.set("e", emblems.join(","))
  return params.toString()
}

/** Reads a shared lineup, keeping only known codes, each unit once and the size limits. */
export function decodeLineup(search: string, guide?: Pick<GuideContent, "traits" | "units">) {
  const params = new URLSearchParams(search)
  const knownUnits = guide ? new Set(guide.units.map((unit) => unit.code)) : null
  const knownTraits = guide ? new Set(guide.traits.map((trait) => trait.code)) : null
  const seen = new Set<string>()
  const units: { unitCode: string; carry: boolean }[] = []
  for (const part of (params.get("u") ?? "").split(",")) {
    const carry = part.endsWith("*")
    const unitCode = carry ? part.slice(0, -1) : part
    if (!CODE.test(unitCode) || seen.has(unitCode) || (knownUnits && !knownUnits.has(unitCode))) continue
    seen.add(unitCode)
    units.push({ unitCode, carry })
    if (units.length === MAX_LINEUP_UNITS) break
  }
  const emblems = (params.get("e") ?? "")
    .split(",")
    .filter((code) => CODE.test(code) && (!knownTraits || knownTraits.has(code)))
    .slice(0, MAX_EMBLEMS)
  return { units, emblems }
}

/** Splits a rule body into paragraphs and bullet lists ("- " lines). */
export function ruleBlocks(body: string | null | undefined) {
  const blocks: ({ kind: "text"; text: string } | { kind: "list"; items: string[] })[] = []
  for (const line of (body ?? "").split("\n")) {
    const text = line.trim()
    if (!text) continue
    if (text.startsWith("- ")) {
      const last = blocks.at(-1)
      if (last?.kind === "list") last.items.push(text.slice(2))
      else blocks.push({ kind: "list", items: [text.slice(2)] })
    } else blocks.push({ kind: "text", text })
  }
  return blocks
}

/** Folds Vietnamese text for search, so an unaccented query finds the accented name. */
export function foldText(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()
}
