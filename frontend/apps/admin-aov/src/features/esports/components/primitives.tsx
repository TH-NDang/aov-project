import { useState, type ReactNode } from "react"
import type { Lane, TournamentContent } from "@aov/community-contracts"
import { cn } from "@aov/ui/lib/utils"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { TierEmblem } from "@aov/ui/components/tier-emblem"
import { CalendarClock, CircleHelp, Flag, Megaphone, Radio } from "lucide-react"
import { STATUS_LABELS, TIER_LABELS, regionName } from "../model/labels"
import { initials, type IconRef, type TeamView } from "../model/game-view"
import type { SlotState } from "../model/timeline"
import { LANE_LABELS } from "@/lib/lanes"
import { useThemedLogo } from "@/lib/themed-logo"

const safeImage = (url?: string | null) => (!!url && /^(https?:\/\/|\/)/i.test(url) ? url : null)

/** Image with a monogram fallback; never shows a broken image icon. */
export function Monogram({
  url,
  darkUrl,
  label,
  text,
  size,
  className,
  portrait,
}: {
  url?: string | null
  /** A logo's version for dark backgrounds; the theme picks between the two (see useThemedLogo). */
  darkUrl?: string | null
  label: string
  text: string
  size: number
  className?: string
  portrait?: boolean
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const [shown, setShown] = useState<string | null>(null)
  const logo = useThemedLogo(url, darkUrl)
  const src = safeImage(logo.url)
  const usable = !!src && failed !== src
  return (
    <span
      className={cn("esp-logo", portrait && "esp-portrait", className)}
      data-empty={!usable || undefined}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.32) }}
      role="img"
      aria-label={label}
    >
      {/* Transparent logos must not show the monogram through them once loaded. */}
      {(!usable || shown !== src) && <span aria-hidden="true">{text}</span>}
      {usable && (
        <img
          src={src}
          alt=""
          loading="lazy"
          data-logo-plate={portrait ? undefined : logo.plate}
          onLoad={() => setShown(src)}
          onError={() => setFailed(src)}
        />
      )}
    </span>
  )
}

/** Letters of 12px that fit beside each other in the place of a logo. */
const lettersIn = (size: number) => (size < 20 ? 1 : size < 30 ? 2 : 3)

export function TeamLogo({ team, size = 32, className }: { team?: TeamView; size?: number; className?: string }) {
  return (
    <Monogram
      url={team?.logoUrl}
      darkUrl={team?.logoDarkUrl}
      label={`Logo ${team?.name ?? "chưa xác định"}`}
      text={team ? team.shortName.slice(0, lettersIn(size)) : "?"}
      size={size}
      className={cn("rounded-md", className)}
    />
  )
}

export function HeroIcon({
  hero,
  size = 36,
  className,
  title,
}: {
  hero?: IconRef | null
  size?: number
  className?: string
  title?: string
}) {
  return (
    <span title={title ?? hero?.name ?? "Chưa chọn"} className="inline-flex">
      <Monogram
        url={hero?.iconUrl}
        label={hero?.name ?? "Chưa chọn tướng"}
        text={hero ? initials(hero.name).slice(0, 2) : "?"}
        size={size}
        portrait
        className={cn("rounded-lg", className)}
      />
    </span>
  )
}

export function PlayerPhoto({ name, url, size = 28 }: { name: string; url?: string; size?: number }) {
  return (
    <Monogram
      url={url}
      label={`Ảnh ${name}`}
      text={initials(name).slice(0, 2)}
      size={size}
      portrait
      className="rounded-full"
    />
  )
}

export function ItemSlot({
  item,
  iconUrl,
  size = 30,
  index,
}: {
  item: SlotState
  iconUrl?: string | null
  size?: number
  index: number
}) {
  const state = item === undefined ? "unknown" : item === null ? "empty" : "filled"
  const label =
    state === "unknown" ? `Ô ${index + 1}: chưa quan sát` : state === "empty" ? `Ô ${index + 1}: trống` : item!.name
  const src = safeImage(iconUrl)
  return (
    <span
      className="esp-slot text-xs font-semibold text-muted-foreground"
      style={{ width: size, height: size }}
      data-state={state}
      title={label}
      aria-label={label}
      role="img"
    >
      {state === "filled" ? (
        src ? (
          <img src={src} alt="" loading="lazy" />
        ) : (
          <span className="px-0.5 text-center leading-tight text-foreground">{initials(item!.name).slice(0, 3)}</span>
        )
      ) : state === "unknown" ? (
        "?"
      ) : null}
    </span>
  )
}

/** A tournament's tier: its emblem, with its name beside it unless the place is `compact`. */
export function TierBadge({ tier, compact }: { tier?: TournamentContent["tier"]; compact?: boolean }) {
  if (!tier || tier === "UNKNOWN") return null
  return (
    <span className="inline-flex items-center gap-1.5">
      <TierEmblem tier={tier} label={TIER_LABELS[tier]} />
      {!compact && <span className="type-label">{TIER_LABELS[tier]}</span>}
    </span>
  )
}

/** One icon per status, so a list is read without its words. */
export const STATUS_ICONS = {
  ONGOING: Radio,
  UPCOMING: CalendarClock,
  ANNOUNCED: Megaphone,
  FINISHED: Flag,
  UNKNOWN: CircleHelp,
} satisfies Record<NonNullable<TournamentContent["status"]>, unknown>

export function StatusPill({ status, onDark }: { status?: TournamentContent["status"]; onDark?: boolean }) {
  const value = status ?? "UNKNOWN"
  const tone =
    value === "ONGOING"
      ? "text-[var(--esp-live)]"
      : value === "FINISHED"
        ? onDark
          ? "text-white/70"
          : "text-muted-foreground"
        : onDark
          ? "text-[var(--esp-gold)]"
          : "text-primary"
  const Icon = STATUS_ICONS[value]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", tone)}>
      <Icon className={cn("size-3.5 shrink-0", value === "ONGOING" && "esp-live-icon")} aria-hidden="true" />
      {STATUS_LABELS[value]}
    </span>
  )
}

const FLAGS = new Set(["VN", "TH", "TW", "ID", "CN"])
export function RegionFlag({ code, withName = true }: { code?: string; withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={regionName(code)}>
      {code && FLAGS.has(code) ? (
        <img
          src={`/images/flags/${code.toLowerCase()}.svg`}
          alt=""
          className="h-3 w-[18px] object-cover"
          loading="lazy"
        />
      ) : (
        <span className="rounded bg-muted px-1 text-xs font-semibold">{code || "?"}</span>
      )}
      {withName && <span>{regionName(code)}</span>}
    </span>
  )
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 id={id} className="tracking-tight type-section-title">
        {children}
      </h2>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

/** Lane glyph in the current text color. */
export function LaneIcon({ lane, size = 16, className }: { lane: Lane; size?: number; className?: string }) {
  return <HeroLaneIcon lane={lane} size={size} label={LANE_LABELS[lane].name} className={className} />
}
