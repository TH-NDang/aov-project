/**
 * How an enchantment is used in a match, in words for readers and editors: passive, an active item the player triggers,
 * or an upgrade of the equipped talent; its cooldown, uses per match and the match time it can be used in.
 */
export type EnchantmentActivation = "PASSIVE" | "ACTIVE" | "TALENT_UPGRADE" | "UNKNOWN"

export const ENCHANTMENT_ACTIVATIONS: readonly EnchantmentActivation[] = [
  "PASSIVE",
  "ACTIVE",
  "TALENT_UPGRADE",
  "UNKNOWN",
]

/** The gameplay fields that say how an enchantment is used; older data leaves them out. */
export interface EnchantmentUse {
  activation?: EnchantmentActivation | null
  cooldownSeconds?: number | null
  cooldownMaxSeconds?: number | null
  maxUses?: number | null
  availableFromSeconds?: number | null
  availableUntilSeconds?: number | null
}

type Text = (vi: string, en: string) => string

const ACTIVATION_NAMES: Record<EnchantmentActivation, [string, string]> = {
  PASSIVE: ["Nội tại", "Passive"],
  ACTIVE: ["Kích hoạt", "Active"],
  TALENT_UPGRADE: ["Đổi phụ trợ", "Talent upgrade"],
  UNKNOWN: ["Chưa rõ", "Unknown"],
}

export function enchantmentActivationName(activation: EnchantmentActivation | null | undefined, text: Text) {
  return text(...ACTIVATION_NAMES[activation ?? "UNKNOWN"])
}

/** A number of seconds as the game writes it: a dot for decimals, never a locale's comma. */
const seconds = (value: number) => String(Number(value.toFixed(2)))

/** The cooldown in seconds, or a range of seconds when it grows with each use. */
export function enchantmentCooldownText(use: EnchantmentUse, text: Text) {
  const first = use.cooldownSeconds
  if (first == null) return null
  const last = use.cooldownMaxSeconds
  const span = last != null && last !== first ? `${seconds(first)}–${seconds(last)}` : seconds(first)
  return text(`${span} giây`, `${span} seconds`)
}

/** A moment of the match, counted from its start, as a minute or a minute and seconds. */
export function enchantmentMatchTimeText(value: number | null | undefined, text: Text) {
  if (value == null) return null
  const minutes = Math.floor(value / 60)
  const rest = value % 60
  const clock = rest ? `${minutes}:${String(rest).padStart(2, "0")}` : String(minutes)
  return text(`Phút ${clock}`, `Minute ${clock}`)
}

/** Uses per match in words; nothing when a match puts no limit on it. */
export function enchantmentUsesText(maxUses: number | null | undefined, text: Text) {
  if (maxUses == null) return null
  return maxUses === 1
    ? text("1 lần mỗi trận", "Once per match")
    : text(`Tối đa ${maxUses} lần mỗi trận`, `Up to ${maxUses} per match`)
}

/** The facts a reader sees about how an enchantment is used, in a fixed order; unknown ones are left out. */
export function enchantmentUseFacts(use: EnchantmentUse, text: Text) {
  const rows: { key: string; label: string; value: string }[] = []
  if (use.activation && use.activation !== "UNKNOWN")
    rows.push({
      key: "activation",
      label: text("Cách dùng", "Use"),
      value: enchantmentActivationName(use.activation, text),
    })
  const cooldown = enchantmentCooldownText(use, text)
  if (cooldown) rows.push({ key: "cooldown", label: text("Hồi chiêu", "Cooldown"), value: cooldown })
  const uses = enchantmentUsesText(use.maxUses, text)
  if (uses) rows.push({ key: "uses", label: text("Số lần dùng", "Uses"), value: uses })
  const from = enchantmentMatchTimeText(use.availableFromSeconds, text)
  if (from) rows.push({ key: "from", label: text("Có từ", "Available from"), value: from })
  const until = enchantmentMatchTimeText(use.availableUntilSeconds, text)
  if (until) rows.push({ key: "until", label: text("Dùng được đến", "Usable until"), value: until })
  return rows
}
