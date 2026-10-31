import { useState, type ReactNode } from "react"
import type { Lane, TournamentContent } from "@aov/community-contracts"
import { cn } from "@aov/ui/lib/utils"
import { LANE_LABELS, STATUS_LABELS, TIER_LABELS, regionName } from "../model/labels"
import { initials, type IconRef, type TeamView } from "../model/game-view"
import type { SlotState } from "../model/timeline"
import { VIDEO_MARK } from "../model/vod"

const safeImage = (url?: string | null) => (!!url && /^(https?:\/\/|\/)/i.test(url) ? url : null)

/** Image with a monogram fallback; never shows a broken image icon. */
export function Monogram({
  url,
  label,
  text,
  size,
  className,
  portrait,
}: {
  url?: string | null
  label: string
  text: string
  size: number
  className?: string
  portrait?: boolean
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const [shown, setShown] = useState<string | null>(null)
  const src = safeImage(url)
  const usable = !!src && failed !== src
  return (
    <span
      className={cn("esp-logo", portrait && "esp-portrait", className)}
      data-empty={!usable || undefined}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.32) }}
      role="img"
      aria-label={label}
    >
      {/* Transparent logos must not show the monogram through them once loaded. */}
      {shown !== src && <span aria-hidden="true">{text}</span>}
      {usable && <img src={src} alt="" loading="lazy" onLoad={() => setShown(src)} onError={() => setFailed(src)} />}
    </span>
  )
}

export function TeamLogo({ team, size = 32, className }: { team?: TeamView; size?: number; className?: string }) {
  return (
    <Monogram
      url={team?.logoUrl}
      label={`Logo ${team?.name ?? "chưa xác định"}`}
      text={team ? team.shortName.slice(0, 3) : "?"}
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
  changed,
  index,
}: {
  item: SlotState
  iconUrl?: string | null
  size?: number
  changed?: boolean
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
      data-changed={changed || undefined}
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

export function TierBadge({ tier }: { tier?: TournamentContent["tier"] }) {
  if (!tier || tier === "UNKNOWN") return null
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded px-1.5 text-xs font-bold tracking-wide",
        tier === "S"
          ? "bg-[var(--esp-gold)] text-[var(--esp-ink)]"
          : tier === "A"
            ? "bg-[var(--esp-blue)] text-white"
            : "bg-muted text-foreground",
      )}
    >
      {TIER_LABELS[tier]}
    </span>
  )
}

export function StatusPill({ status, onDark }: { status?: TournamentContent["status"]; onDark?: boolean }) {
  const value = status ?? "UNKNOWN"
  const tone =
    value === "ONGOING"
      ? "text-[var(--esp-live)]"
      : value === "FINISHED"
        ? onDark
          ? "text-white/70"
          : "text-muted-foreground"
        : "text-[var(--esp-gold)]"
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", tone)}>
      <span
        className={cn("size-1.5 rounded-full bg-current", value === "ONGOING" && "esp-live-dot")}
        aria-hidden="true"
      />
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
          className="h-3 w-[18px] rounded-[2px] object-cover"
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

/** Each format has its own color so Bo1/Bo3/Bo5/Bo7 can be told apart at a glance. */
const BEST_OF_TONES: Record<number, string> = {
  1: "esp-bo-1",
  3: "esp-bo-3",
  5: "esp-bo-5",
  7: "esp-bo-7",
}
export function BestOfBadge({ bestOf, className }: { bestOf: number; className?: string }) {
  return (
    <span
      className={cn("esp-bo", BEST_OF_TONES[bestOf] ?? "esp-bo-1", className)}
      title={`Thể thức Bo${bestOf}: thắng ${Math.floor(bestOf / 2) + 1} ván trước`}
    >
      BO{bestOf}
    </span>
  )
}

/** "First to N" progress: one bar per game needed to take the series. */
export function WinPips({
  wins = 0,
  bestOf,
  align = "start",
  won,
}: {
  wins?: number
  bestOf: number
  align?: "start" | "end"
  won?: boolean
}) {
  const needed = Math.floor(bestOf / 2) + 1
  return (
    <span
      className={cn("inline-flex gap-0.5", align === "end" && "flex-row-reverse")}
      aria-label={`${wins}/${needed} ván cần thắng`}
    >
      {Array.from({ length: needed }, (_, index) => (
        <span key={index} className="esp-pip" data-on={index < wins || undefined} data-won={won || undefined} />
      ))}
    </span>
  )
}

/** Explicit result label in the game's own end-screen wording, so the result never relies on color alone. */
export function ResultTag({ won, className }: { won: boolean; className?: string }) {
  return (
    <span className={cn("esp-result", className)} data-won={won} title={won ? "Chiến thắng" : "Thất bại"}>
      {won ? "Victory" : "Defeat"}
    </span>
  )
}

export function ScorePill({ score, win, size = "md" }: { score?: number; win?: boolean; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "esp-num inline-grid place-items-center rounded-md font-bold",
        size === "lg" ? "h-12 min-w-12 px-2 text-3xl" : "h-7 min-w-7 px-1.5 text-sm",
        score === undefined ? "bg-muted text-muted-foreground" : win ? "esp-win-score" : "bg-muted text-foreground",
      )}
    >
      {score ?? "–"}
    </span>
  )
}

// Same shapes as the wiki's lane glyphs (apps/aov-wiki/public/icons/hero); `currentColor` lets callers tint them.
const LANE_SHAPES: Record<Lane, ReactNode> = {
  TOP: (
    <>
      <path d="M5 5h35l-8 8H13v19l-8 8Z" />
      <circle cx="27" cy="25" r="7" />
      <path d="M43 15v28H15" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  JUNGLE: (
    <>
      <rect x="5" y="5" width="38" height="38" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M13 11h18L11 31V13a2 2 0 0 1 2-2Zm22 26H17l20-20v18a2 2 0 0 1-2 2Z" />
    </>
  ),
  MID: (
    <>
      <path d="M5 35 35 5h8v8L13 43H5Z" />
      <path d="M5 25V5h20m-2 38h20V23" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  DRAGON: (
    <>
      <path d="M43 8v35H8l8-8h19V16Z" />
      <circle cx="21" cy="23" r="7" />
      <path d="M33 5H5v28" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  SUPPORT: (
    <>
      <path d="m2 3 15 14 1 8-10-6-4-7Zm44 0L31 17l-1 8 10-6 4-7ZM3 18l15 9 1 7-10-5-4-5Zm42 0-15 9-1 7 10-5 4-5ZM8 31l12 5 4 10-11-7Zm32 0-12 5-4 10 11-7Z" />
      <path d="m24 13 6 12-6 8-6-8Z" />
    </>
  ),
}

/** Lane glyph in the current text colour, e.g. `className="text-[var(--side)]"` for the team colour. */
export function LaneIcon({ lane, size = 16, className }: { lane: Lane; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label={LANE_LABELS[lane].name}
      className={cn("inline-block shrink-0", className)}
    >
      <title>{LANE_LABELS[lane].name}</title>
      {LANE_SHAPES[lane]}
    </svg>
  )
}

/** Play triangle in text presentation, shared with the models. */
export { VIDEO_MARK }

/** The red video mark used beside broadcast positions. */
export function VideoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("text-red-500", className)}>
      {VIDEO_MARK}
    </span>
  )
}

const TIME_TAGS = {
  game: { label: "Giờ trong trận (đồng hồ game)", mark: "⏱" },
  video: { label: "Vị trí trên video YouTube", mark: VIDEO_MARK },
} as const

/**
 * A clock that says which clock it is: ⏱ is the in-game timer shown on the game HUD, ▶ is the position in the
 * broadcast video. Every time shown next to a moment uses one of these so the two are never confused.
 */
export function TimeTag({
  kind,
  seconds,
  className,
}: {
  kind: keyof typeof TIME_TAGS
  seconds: number | null | undefined
  className?: string
}) {
  const total = Math.max(0, Math.floor(seconds ?? 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const text = `${hours ? `${hours}:${String(minutes).padStart(2, "0")}` : minutes}:${String(total % 60).padStart(2, "0")}`
  return (
    <span
      className={cn("esp-num inline-flex items-center gap-0.5 whitespace-nowrap", className)}
      data-time={kind}
      title={TIME_TAGS[kind].label}
      aria-label={`${TIME_TAGS[kind].label} ${seconds == null ? "chưa rõ" : text}`}
    >
      <span aria-hidden="true" className={kind === "video" ? "text-[0.8em] text-red-500" : "text-[0.85em]"}>
        {TIME_TAGS[kind].mark}
      </span>
      {seconds == null ? "--:--" : text}
    </span>
  )
}
