import { useEffect, useRef, type ReactNode } from "react"
import { WikiImageCredit } from "../../components/wiki-image-credit"
import { ruleBlocks, type ModeImage, type RuleSection } from "./auto-chess-model"
import type { ModeAvailability, ModeDuration } from "./mode-api"

export const GROUP_LABEL = { PVP: "PVP", ENTERTAINMENT: "Chế độ giải trí" } as const

const AVAILABILITY: Record<ModeAvailability["status"], { label: string; tone: string }> = {
  ALWAYS_OPEN: { label: "Đang mở", tone: "open" },
  LIMITED: { label: "Mở có thời hạn", tone: "limited" },
  SPECIAL: { label: "Mở đặc biệt", tone: "limited" },
  CLOSED: { label: "Tạm đóng", tone: "closed" },
  LOCKED: { label: "Chưa mở khóa", tone: "closed" },
  UNKNOWN: { label: "Chưa rõ lịch mở", tone: "unknown" },
}

export function availabilityLabel(availability?: ModeAvailability | null) {
  if (!availability) return null
  return availability.gameLabel || AVAILABILITY[availability.status]?.label || null
}

export function AvailabilityBadge({ availability }: { availability?: ModeAvailability | null }) {
  if (!availability) return null
  const known = AVAILABILITY[availability.status] ?? AVAILABILITY.UNKNOWN
  return (
    <span className="mode-badge" data-tone={known.tone} title={known.label}>
      {availability.gameLabel || known.label}
    </span>
  )
}

export function durationText(duration?: ModeDuration | null) {
  if (!duration?.minMinutes && !duration?.maxMinutes) return null
  if (duration.minMinutes && duration.maxMinutes && duration.minMinutes !== duration.maxMinutes)
    return `${duration.minMinutes}–${duration.maxMinutes} phút`
  return `${duration.minMinutes ?? duration.maxMinutes} phút`
}

export function formatDay(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split("-")
  return year && month && day ? `${day}/${month}/${year}` : value
}

/** Mode art with the image credit, or the mode's initials when no art is published yet. */
export function ModeArt({
  image,
  name,
  eager,
  children,
  className,
  showCredit = true,
}: {
  image?: ModeImage | null
  name: string
  eager?: boolean
  /** Off inside links, where an interactive credit cannot be nested. */
  showCredit?: boolean
  children?: ReactNode
  className: string
}) {
  return (
    <div className={className} data-empty={!image || undefined}>
      {image ? (
        <img
          src={image.url}
          alt={`Ảnh chế độ ${name}`}
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
          {initials(name)}
        </span>
      )}
      {children}
      {showCredit && image && image.credits.length > 0 && (
        <WikiImageCredit
          sources={image.credits}
          contactHref={`/contact?assetId=${encodeURIComponent(image.assetId)}&versionId=${encodeURIComponent(image.versionId)}`}
        />
      )}
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase())
    .join("")
}

export function RuleList({ rules }: { rules: RuleSection[] }) {
  const groups = new Map<string, RuleSection[]>()
  for (const rule of rules) {
    const key = rule.group ?? ""
    groups.set(key, [...(groups.get(key) ?? []), rule])
  }
  return (
    <div className="mode-rules">
      {[...groups.entries()].map(([group, entries]) => (
        <section key={group} className="mode-rule">
          {group && <h3>{group}</h3>}
          {entries.map((rule, index) => (
            <div key={`${rule.title}-${index}`} className="mode-rule">
              <h4 className="mode-section-title">{rule.title}</h4>
              {ruleBlocks(rule.body).map((block, at) =>
                block.kind === "text" ? (
                  <p key={at}>{block.text}</p>
                ) : (
                  <ul key={at}>
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** A native modal dialog; full screen on phones through CSS. */
export function ModeDialog({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])
  return (
    <dialog
      ref={dialog}
      className="mode-dialog"
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <button type="button" className="mode-chip mode-dialog-close" onClick={onClose}>
        Đóng
      </button>
      {open && children}
    </dialog>
  )
}
