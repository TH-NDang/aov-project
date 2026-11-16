import { useEffect, useRef, useState, type ReactNode } from "react"
import { PopoverPortalContainer } from "@aov/ui/components/popover"
import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImageCredit } from "../../components/wiki-image-credit"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { ruleBlocks, type ModeImage, type RuleSection } from "./auto-chess-model"
import type { ModeAvailability, ModeDuration } from "./mode-api"

/** The game's two groups of modes, in Vietnamese and in English. */
export const GROUP_NAMES = {
  PVP: ["PVP", "PVP"],
  ENTERTAINMENT: ["Chế độ giải trí", "Casual modes"],
} as const

/** A mode that can be played now reads green; one that cannot, or whose schedule is not recorded, stays muted. */
const AVAILABILITY: Record<
  ModeAvailability["status"],
  { label: string; english: string; tone: "open" | "closed" | "unknown" }
> = {
  ALWAYS_OPEN: { label: "Đang mở", english: "Open", tone: "open" },
  LIMITED: { label: "Mở có thời hạn", english: "Limited-time", tone: "open" },
  SPECIAL: { label: "Mở đặc biệt", english: "Special opening", tone: "open" },
  CLOSED: { label: "Tạm đóng", english: "Temporarily closed", tone: "closed" },
  LOCKED: { label: "Chưa mở khóa", english: "Locked", tone: "closed" },
  UNKNOWN: { label: "Chưa rõ lịch mở", english: "Schedule unknown", tone: "unknown" },
}

const toneOf = (availability: ModeAvailability) => (AVAILABILITY[availability.status] ?? AVAILABILITY.UNKNOWN).tone

export function isOpen(availability?: ModeAvailability | null) {
  return !!availability && toneOf(availability) === "open"
}

/** Closed or locked in the game. An unrecorded schedule is not a closed mode. */
export function isClosed(availability?: ModeAvailability | null) {
  return !!availability && toneOf(availability) === "closed"
}

/** Whether the game's schedule for the mode has been recorded at all. */
export function hasSchedule(availability?: ModeAvailability | null) {
  return !!availability && toneOf(availability) !== "unknown"
}

/**
 * Whether the mode is open, as a dot and the game's own wording. `quiet` leaves out an unrecorded schedule, which
 * only adds noise to a list.
 */
export function AvailabilityState({
  availability,
  quiet,
}: {
  availability?: ModeAvailability | null
  quiet?: boolean
}) {
  const { locale } = useWikiContext()
  if (!availability) return null
  const known = AVAILABILITY[availability.status] ?? AVAILABILITY.UNKNOWN
  if (quiet && known.tone === "unknown") return null
  const label = wikiText(locale, known.label, known.english)
  return (
    <span className="mode-state" data-tone={known.tone} title={availability.gameLabel ? label : undefined}>
      {availability.gameLabel || label}
    </span>
  )
}

export function durationText(duration?: ModeDuration | null, locale = "vi-VN") {
  if (!duration?.minMinutes && !duration?.maxMinutes) return null
  const minutes =
    duration.minMinutes && duration.maxMinutes && duration.minMinutes !== duration.maxMinutes
      ? `${duration.minMinutes}–${duration.maxMinutes}`
      : `${duration.minMinutes ?? duration.maxMinutes}`
  return wikiText(locale, `${minutes} phút`, `${minutes} min`)
}

/**
 * Mode art with the image credit, or the section's emblem on a quiet tone while no art is published yet. Inside a
 * card that already names the mode the picture is decoration, so it carries no text of its own and no credit: an
 * interactive credit cannot be nested in a link.
 */
export function ModeArt({
  image,
  name,
  eager,
  children,
  className,
  inCard,
}: {
  image?: ModeImage | null
  name: string
  eager?: boolean
  inCard?: boolean
  children?: ReactNode
  className: string
}) {
  const { locale } = useWikiContext()
  return (
    <span className={`mode-art ${className}`} data-empty={!image || undefined}>
      {image ? (
        <img
          src={image.url}
          alt={inCard ? "" : wikiText(locale, `Ảnh chế độ ${name}`, `${name} mode artwork`)}
          width={image.width}
          height={image.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={
            image.focalPoint
              ? { objectPosition: `${image.focalPoint.x * 100}% ${image.focalPoint.y * 100}%` }
              : undefined
          }
        />
      ) : (
        <span className="mode-art-fallback" aria-hidden="true">
          <WikiIcon name="mode" size={40} />
        </span>
      )}
      {children}
      {!inCard && image && image.credits.length > 0 && (
        <WikiImageCredit
          sources={image.credits}
          contactHref={`/contact?assetId=${encodeURIComponent(image.assetId)}&versionId=${encodeURIComponent(image.versionId)}`}
        />
      )}
    </span>
  )
}

/**
 * A section's heading: its name in the accent color with an optional icon and count, one muted line under it, and at
 * most one action on the right.
 */
export function ModeHeading({
  id,
  title,
  count,
  note,
  icon,
  action,
}: {
  id?: string
  title: string
  count?: number
  note?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="mode-heading" data-action={action ? "" : undefined}>
      <h2 id={id}>
        {icon && <span className="mode-heading-icon">{icon}</span>}
        {title}
        {count !== undefined && <small>{count}</small>}
      </h2>
      {action && <div className="mode-heading-action">{action}</div>}
      {note && <p>{note}</p>}
    </header>
  )
}

function RuleBody({ body }: { body?: string | null }) {
  return ruleBlocks(body).map((block, at) =>
    block.kind === "text" ? (
      <p key={at}>{block.text}</p>
    ) : (
      <ul key={at}>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ),
  )
}

/**
 * Rules grouped the way the game groups them. With `collapsible`, each group folds so a phone reader sees the outline
 * first; the first group stays open.
 */
export function RuleList({ rules, collapsible }: { rules: RuleSection[]; collapsible?: boolean }) {
  const groups = new Map<string, RuleSection[]>()
  for (const rule of rules) {
    const key = rule.group ?? ""
    groups.set(key, [...(groups.get(key) ?? []), rule])
  }
  return (
    <div className="mode-rules">
      {[...groups.entries()].map(([group, entries], index) => {
        // A rule sits under its group's h3; where the group folds behind a summary, or there is none, it is the h3.
        const Title = group && !collapsible ? "h4" : "h3"
        const items = entries.map((rule, at) => (
          <div key={`${rule.title}-${at}`} className="mode-rule">
            <Title>{rule.title}</Title>
            <RuleBody body={rule.body} />
          </div>
        ))
        if (!group) return <div key={index}>{items}</div>
        return collapsible ? (
          <details key={group} className="mode-rule-group" open={index === 0}>
            <summary>{group}</summary>
            {items}
          </details>
        ) : (
          <section key={group} className="mode-rule-group">
            <h3>{group}</h3>
            {items}
          </section>
        )
      })}
    </div>
  )
}

/**
 * Detail opened over the guide as a drawer: it slides in from the right on wide screens and rises from the bottom on
 * phones, where dragging its bar down closes it. The page behind stays where the reader left it.
 */
export function ModeDialog({
  open,
  onClose,
  label,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Names the open entry for assistive technology. */
  label: string
  /** The drawer's heading, the kind of entry; the entry names itself below it. */
  title?: string
  children: ReactNode
}) {
  const { t } = useWikiContext()
  const dialog = useRef<HTMLDialogElement>(null)
  // Term cards inside the drawer mount in it: the modal drawer is in the top layer and would cover them otherwise.
  const [host, setHost] = useState<HTMLDialogElement | null>(null)
  const drag = useRef<{ start: number; delta: number } | null>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])
  const settle = (delta: number) => {
    const element = dialog.current
    if (!element) return
    element.style.transform = delta > 0 ? `translateY(${delta}px)` : ""
  }
  return (
    <dialog
      ref={(element) => {
        dialog.current = element
        setHost(element)
      }}
      className="mode-dialog"
      aria-label={label}
      onClose={() => {
        settle(0)
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <header
        className="mode-dialog-head"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return
          drag.current = { start: event.clientY, delta: 0 }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          drag.current.delta = Math.max(0, event.clientY - drag.current.start)
          settle(drag.current.delta)
        }}
        onPointerUp={() => {
          const moved = drag.current?.delta ?? 0
          drag.current = null
          if (moved > 90) onClose()
          else settle(0)
        }}
        onPointerCancel={() => {
          drag.current = null
          settle(0)
        }}
      >
        <span className="mode-dialog-grip" aria-hidden="true" />
        <h2 className="mode-dialog-title">{title ?? label}</h2>
        <button type="button" className="mode-dialog-close" aria-label={t("close")} onClick={onClose}>
          <WikiIcon name="close" size={20} />
        </button>
      </header>
      <PopoverPortalContainer.Provider value={host}>
        <div className="mode-dialog-body">{open && children}</div>
      </PopoverPortalContainer.Provider>
    </dialog>
  )
}

/**
 * The page's main action as a floating "+". It names itself on wide screens; on phones it is a round button that
 * tucks into the right edge while the page scrolls, so it never covers what is being read, and slides back out once
 * scrolling stops. The state is written on the element so scrolling never re-renders React.
 */
export function ModeFab({ label, to, onClick }: { label: string; to?: string; onClick?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let timer = 0
    const onScroll = () => {
      const element = wrap.current
      if (!element) return
      element.dataset.scrolling = "true"
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        element.dataset.scrolling = "false"
      }, 320)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.clearTimeout(timer)
    }
  }, [])
  const body = (
    <>
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="mode-fab-label">{label}</span>
    </>
  )
  return (
    <div ref={wrap} className="mode-fab-wrap" data-scrolling="false">
      {to ? (
        <Link className="mode-fab" to={to} aria-label={label} title={label}>
          {body}
        </Link>
      ) : (
        <button type="button" className="mode-fab" aria-label={label} title={label} onClick={onClick}>
          {body}
        </button>
      )}
    </div>
  )
}
