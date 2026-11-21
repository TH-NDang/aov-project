import {
  Droplet,
  Droplets,
  Footprints,
  Heart,
  Hourglass,
  Shield,
  ShieldHalf,
  ShieldOff,
  Sparkles,
  Sword,
  Wand,
  Zap,
  type LucideIcon,
} from "lucide-react"

/**
 * The item stats as one set of line icons, keyed by the reader-facing stat group of `ITEM_STAT_FILTERS`. Filters, item
 * cards and rows draw a stat with the same icon, so a stat looks the same wherever an item lists it.
 */
const ITEM_STAT_ICONS: Record<string, LucideIcon> = {
  physical: Sword,
  magic: Wand,
  "attack-speed": Zap,
  crit: Sparkles,
  lifesteal: Droplets,
  pierce: ShieldOff,
  cooldown: Hourglass,
  health: Heart,
  armor: Shield,
  "magic-defense": ShieldHalf,
  movement: Footprints,
  mana: Droplet,
}

/** Each stat group's colour, from the status tokens, so a stat is told apart by colour as well as by shape. */
const ITEM_STAT_TONES: Record<string, string> = {
  physical: "var(--aov-warning)",
  magic: "var(--aov-stream-lavender)",
  "attack-speed": "var(--aov-wiki-warning)",
  crit: "var(--aov-danger)",
  lifesteal: "var(--aov-live)",
  pierce: "var(--aov-accent)",
  cooldown: "var(--aov-info)",
  health: "var(--aov-success)",
  armor: "var(--aov-wiki-gold-bright)",
  "magic-defense": "color-mix(in srgb, var(--aov-info) 55%, var(--aov-stream-lavender))",
  movement: "var(--aov-wiki-success)",
  mana: "var(--aov-wiki-info)",
}

export function itemStatTone(group: string | undefined) {
  return group ? ITEM_STAT_TONES[group] : undefined
}

/** A stat's icon in its colour; `plain` leaves it in the colour of the text around it. */
export function ItemStatIcon({
  group,
  size = 16,
  plain = false,
  className,
}: {
  /** The stat group's key in `ITEM_STAT_FILTERS`. */
  group: string | undefined
  size?: number
  plain?: boolean
  className?: string
}) {
  const Icon = group ? ITEM_STAT_ICONS[group] : undefined
  if (!Icon) return <span className={className} style={{ width: size, flex: "none" }} aria-hidden="true" />
  const tone = plain ? undefined : itemStatTone(group)
  return (
    <Icon
      size={size}
      strokeWidth={2}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={tone ? { color: tone } : undefined}
    />
  )
}

/** A stat's icon on a soft disc of its colour, for lists of stats to choose from. */
export function ItemStatBadge({ group, size = 28 }: { group: string; size?: number }) {
  const tone = itemStatTone(group) ?? "var(--aov-accent)"
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${tone} 30%, transparent), transparent 75%), color-mix(in srgb, ${tone} 14%, var(--aov-surface))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 40%, transparent)`,
      }}
    >
      <ItemStatIcon group={group} size={Math.round(size * 0.56)} />
    </span>
  )
}
