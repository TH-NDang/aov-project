/**
 * An enchantment set as the game builds it (ADR-026): five slots, the first three the primary branch's tiers I, II and
 * III, the last two from other branches. Two secondary enchantments of one branch are its tiers I and II; of two
 * branches, both are tier I. The helpers keep a set valid while a player changes one part of it.
 */
export interface SetEnchantment {
  id: string
  branchCode: string
  tier: number
  position: number | null
}

export type EnchantmentSet = (string | null)[]

export const SET_SLOTS = 5
export const PRIMARY_SLOTS = [1, 2, 3] as const
export const SECONDARY_SLOTS = [4, 5] as const

export const emptySet = (): EnchantmentSet => Array.from({ length: SET_SLOTS }, () => null)

/** A tier's enchantments in the game's order: by position, unknown positions last. */
export function tierOf(enchantments: readonly SetEnchantment[], branchCode: string, tier: number) {
  return enchantments
    .filter((entry) => entry.branchCode === branchCode && entry.tier === tier)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || a.id.localeCompare(b.id))
}

const find = (enchantments: readonly SetEnchantment[], id: string | null | undefined) =>
  id ? enchantments.find((entry) => entry.id === id) : undefined

export function slotEnchantment(set: EnchantmentSet, slot: number, enchantments: readonly SetEnchantment[]) {
  return find(enchantments, set[slot - 1])
}

export function primaryBranch(set: EnchantmentSet, enchantments: readonly SetEnchantment[]) {
  return slotEnchantment(set, 1, enchantments)?.branchCode ?? null
}

/** The tier a secondary slot takes: the second is tier II when it shares the first one's branch. */
export function secondaryTier(
  set: EnchantmentSet,
  slot: 4 | 5,
  branchCode: string,
  enchantments: readonly SetEnchantment[],
) {
  if (slot === 4) return 1
  return slotEnchantment(set, 4, enchantments)?.branchCode === branchCode ? 2 : 1
}

/** What a slot may hold now: the primary branch's tier, or a secondary branch's allowed tier. */
export function slotChoices(
  set: EnchantmentSet,
  slot: number,
  enchantments: readonly SetEnchantment[],
  branchCode = slot <= 3 ? primaryBranch(set, enchantments) : slotEnchantment(set, slot, enchantments)?.branchCode,
) {
  if (!branchCode) return []
  const tier = slot <= 3 ? slot : secondaryTier(set, slot as 4 | 5, branchCode, enchantments)
  return tierOf(enchantments, branchCode, tier)
}

/** Fills the secondary slots with the first choices that keep the set valid, keeping what still fits. */
function settleSecondary(set: EnchantmentSet, enchantments: readonly SetEnchantment[], branches: readonly string[]) {
  const next = [...set]
  const primary = primaryBranch(next, enchantments)
  const others = branches.filter((code) => code !== primary)
  for (const slot of SECONDARY_SLOTS) {
    const current = slotEnchantment(next, slot, enchantments)
    const branch = current && current.branchCode !== primary ? current.branchCode : others[0]
    if (!branch) {
      next[slot - 1] = null
      continue
    }
    const choices = slotChoices(next, slot, enchantments, branch)
    next[slot - 1] = choices.some((entry) => entry.id === current?.id) ? current!.id : (choices[0]?.id ?? null)
  }
  return next
}

/** A whole set for a primary branch: its first enchantment of each tier, then the first valid secondaries. */
export function startSet(branchCode: string, enchantments: readonly SetEnchantment[], branches: readonly string[]) {
  const set = emptySet()
  for (const slot of PRIMARY_SLOTS) set[slot - 1] = tierOf(enchantments, branchCode, slot)[0]?.id ?? null
  return settleSecondary(set, enchantments, branches)
}

/** Another primary branch: its tiers take slots 1 to 3, and a secondary of that branch moves elsewhere. */
export function choosePrimaryBranch(
  set: EnchantmentSet,
  branchCode: string,
  enchantments: readonly SetEnchantment[],
  branches: readonly string[],
) {
  const next = [...set]
  for (const slot of PRIMARY_SLOTS) next[slot - 1] = tierOf(enchantments, branchCode, slot)[0]?.id ?? null
  for (const slot of SECONDARY_SLOTS)
    if (slotEnchantment(next, slot, enchantments)?.branchCode === branchCode) next[slot - 1] = null
  return settleSecondary(
    next,
    enchantments,
    branches.filter((code) => code !== branchCode),
  )
}

/** Another branch for a secondary slot: its first allowed enchantment, and the other secondary kept valid. */
export function chooseSecondaryBranch(
  set: EnchantmentSet,
  slot: 4 | 5,
  branchCode: string,
  enchantments: readonly SetEnchantment[],
) {
  const next = [...set]
  next[slot - 1] = slotChoices(next, slot, enchantments, branchCode)[0]?.id ?? null
  const other = slot === 4 ? 5 : 4
  const otherEntry = slotEnchantment(next, other, enchantments)
  if (otherEntry) {
    const allowed = slotChoices(next, other, enchantments, otherEntry.branchCode)
    if (!allowed.some((entry) => entry.id === otherEntry.id)) next[other - 1] = allowed[0]?.id ?? null
  }
  return next
}

/** One enchantment for a slot, as long as the slot may hold it. */
export function chooseEnchantment(
  set: EnchantmentSet,
  slot: number,
  id: string,
  enchantments: readonly SetEnchantment[],
) {
  const entry = find(enchantments, id)
  if (!entry || !slotChoices(set, slot, enchantments, entry.branchCode).some((choice) => choice.id === id)) return set
  const next = [...set]
  next[slot - 1] = id
  return next
}

/** The branches a secondary slot may take: any but the primary one. */
export function secondaryBranches(
  set: EnchantmentSet,
  enchantments: readonly SetEnchantment[],
  branches: readonly string[],
) {
  const primary = primaryBranch(set, enchantments)
  return branches.filter((code) => code !== primary)
}
