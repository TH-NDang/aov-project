import type { ArcanaAllocation, EnchantmentAllocation, ObservationStatus, Reference } from "@aov/community-contracts"

export type ArcanaColor = "RED" | "PURPLE" | "GREEN"

/** The parts of a player that are recorded one by one. */
export type LoadoutPart = "spell" | "enchantments" | "arcana" | "equipment"

export const ARCANA_COLORS: { code: ArcanaColor; label: string }[] = [
  { code: "RED", label: "Đỏ" },
  { code: "PURPLE", label: "Tím" },
  { code: "GREEN", label: "Xanh" },
]

/** A page holds ten stones of each colour. */
export const STONES_PER_COLOR = 10

/** Players' pages are made of tier III stones alone, so recording offers no other tier. */
export const ARCANA_PAGE_TIER = 3

export const TIER_NUMERALS = ["I", "II", "III"] as const

/** The tier of the emblem a broadcast shows beside a player, the main one of the set. */
export const MAIN_EMBLEM_TIER = 3

export const isArcanaColor = (color?: string | null): color is ArcanaColor =>
  color === "RED" || color === "PURPLE" || color === "GREEN"

const BRANCH_LABELS: Record<string, string> = {
  "thap-quang-minh": "Tháp Quang Minh",
  "vuc-hon-mang": "Vực Hỗn Mang",
  "rung-nguyen-sinh": "Rừng Nguyên Sinh",
  "thanh-khoi-nguyen": "Thành Khởi Nguyên",
}

/** Name of an enchantment branch; a branch this list does not know yet reads as its code. */
export const branchLabel = (code?: string | null) => (code ? (BRANCH_LABELS[code] ?? code) : "Chưa rõ nhánh")

/** Branches in the order the game lists them, followed by any the catalogue adds later. */
export function enchantmentBranches(enchantments: Reference[]) {
  const known = Object.keys(BRANCH_LABELS)
  const present = [...new Set(enchantments.flatMap((entry) => (entry.branchCode ? [entry.branchCode] : [])))]
  return [...known.filter((code) => present.includes(code)), ...present.filter((code) => !known.includes(code))]
}

/**
 * What a stone gives, which is what a broadcast prints next to it. Catalogue names start with the colour and the
 * tier in Roman numerals, then the stats separated by slashes. Colour and tier are told by the column, and the names
 * are typed in mixed capitals, so every stat is written the same way here.
 */
export function arcanaLabel(name?: string | null) {
  const text = (name ?? "").normalize("NFC").trim()
  const stats = text.replace(/^(đỏ|tím|xanh)\s+i{1,3}\s+/iu, "")
  if (!stats) return text || "Chưa rõ loại ngọc"
  return stats
    .split("/")
    .map((stat) => stat.trim().toLocaleLowerCase("vi"))
    .filter(Boolean)
    .map((stat) => stat.charAt(0).toLocaleUpperCase("vi") + stat.slice(1))
    .join("/")
}

export const stonesOf = (entries: ArcanaAllocation[], color: ArcanaColor) =>
  entries.filter((entry) => entry.color === color).reduce((total, entry) => total + entry.count, 0)

/**
 * The status the entries themselves justify. Nothing recorded keeps what the editor said about the source: unknown,
 * or explicitly not shown. Anything recorded is partial until the page is whole, so "known" never has to be claimed.
 */
function statusFor(recorded: boolean, whole: boolean, current: ObservationStatus): ObservationStatus {
  if (!recorded) return current === "NOT_SHOWN" ? "NOT_SHOWN" : "UNKNOWN"
  return whole ? "KNOWN" : "PARTIAL"
}

export const arcanaStatus = (entries: ArcanaAllocation[], current: ObservationStatus) =>
  statusFor(
    entries.length > 0,
    ARCANA_COLORS.every((color) => stonesOf(entries, color.code) === STONES_PER_COLOR),
    current,
  )

/** True when one more kind of stone cannot join the colour: it is full and already split between several kinds. */
export const arcanaColorLocked = (entries: ArcanaAllocation[], color: ArcanaColor) =>
  stonesOf(entries, color) >= STONES_PER_COLOR && entries.filter((entry) => entry.color === color).length > 1

/**
 * One click on a stone. It takes every slot of its colour that is still free, which is the whole colour on a fresh
 * page; a stone already on the page is topped up the same way. A colour filled by one kind swaps to the clicked kind,
 * so a wrong click is corrected by clicking the right stone; a colour deliberately split between kinds is left alone
 * until one of them is stepped down.
 */
export function pickArcana(entries: ArcanaAllocation[], stone: Reference): ArcanaAllocation[] {
  const color = stone.color
  if (!isArcanaColor(color)) return entries
  const free = STONES_PER_COLOR - stonesOf(entries, color)
  const chosen = entries.findIndex((entry) => entry.selection.id === stone.id)
  if (chosen >= 0) return free > 0 ? stepArcana(entries, chosen, free) : entries
  const pick = (count: number): ArcanaAllocation => ({
    selection: { id: stone.id, name: stone.name },
    color,
    count,
  })
  if (free > 0) return [...entries, pick(free)]
  if (arcanaColorLocked(entries, color)) return entries
  return entries.map((entry) => (entry.color === color ? pick(STONES_PER_COLOR) : entry))
}

/** One step on a chosen stone, for pages that split a colour; a stone stepped down to nothing leaves the page. */
export function stepArcana(entries: ArcanaAllocation[], index: number, delta: number): ArcanaAllocation[] {
  const entry = entries[index]
  if (!entry) return entries
  const room = isArcanaColor(entry.color)
    ? STONES_PER_COLOR - (stonesOf(entries, entry.color) - entry.count)
    : STONES_PER_COLOR
  const count = Math.min(room, Math.max(0, entry.count + delta))
  return count === 0
    ? entries.filter((_, position) => position !== index)
    : entries.map((current, position) => (position === index ? { ...current, count } : current))
}

const primaryOf = (entries: EnchantmentAllocation[]) => entries.filter((entry) => entry.primary)
const secondaryOf = (entries: EnchantmentAllocation[]) => entries.filter((entry) => !entry.primary)

/** Branch the main picks belong to, if any is recorded. */
export const mainBranch = (entries: EnchantmentAllocation[]) => primaryOf(entries)[0]?.branchCode ?? null

export const enchantmentStatus = (entries: EnchantmentAllocation[], current: ObservationStatus) =>
  statusFor(entries.length > 0, primaryOf(entries).length === 3 && secondaryOf(entries).length === 2, current)

/** Two secondary picks go together when they are tiers I and II of one branch, or tier I of two branches. */
const secondaryPair = (a: EnchantmentAllocation, b: EnchantmentAllocation) =>
  a.branchCode === b.branchCode ? a.tier !== b.tier : a.tier === 1 && b.tier === 1

/**
 * One click on an enchantment, in the main tree or among the secondary picks. Clicking a chosen one removes it.
 * Otherwise it is added and whatever the game would not allow beside it gives way: main picks share one branch and
 * hold one enchantment per tier, and secondary picks sit outside the main branch in one of the two allowed pairs.
 */
export function pickEnchantment(
  entries: EnchantmentAllocation[],
  enchantment: Reference,
  primary: boolean,
): EnchantmentAllocation[] {
  if (entries.some((entry) => entry.selection.id === enchantment.id && entry.primary === primary))
    return entries.filter((entry) => entry.selection.id !== enchantment.id)
  const pick: EnchantmentAllocation = {
    selection: { id: enchantment.id, name: enchantment.name },
    primary,
    tier: enchantment.tier ?? 1,
    branchCode: enchantment.branchCode ?? undefined,
  }
  const others = entries.filter((entry) => entry.selection.id !== enchantment.id)
  if (primary) {
    const main = primaryOf(others).filter((entry) => entry.branchCode === pick.branchCode && entry.tier !== pick.tier)
    const side = secondaryOf(others).filter((entry) => entry.branchCode !== pick.branchCode)
    return [...[...main, pick].sort((a, b) => a.tier - b.tier), ...side]
  }
  if (pick.tier > 2 || (pick.branchCode && pick.branchCode === mainBranch(others))) return entries
  const partner = secondaryOf(others)
    .reverse()
    .find((entry) => secondaryPair(entry, pick))
  return [...primaryOf(others), ...(partner ? [partner] : []), pick]
}

/** What a click on a main enchantment throws away beyond the pick of its own tier, whose place it takes. */
export function lostEnchantments(entries: EnchantmentAllocation[], enchantment: Reference): EnchantmentAllocation[] {
  if (entries.some((entry) => entry.primary && entry.selection.id === enchantment.id)) return []
  const kept = pickEnchantment(entries, enchantment, true)
  return entries.filter(
    (entry) =>
      !kept.includes(entry) &&
      entry.selection.id !== enchantment.id &&
      !(entry.primary && entry.tier === enchantment.tier),
  )
}
