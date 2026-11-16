import { useEffect, useId, useRef, useState } from "react"
import type { ProfileLink } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { SocialPlatformIcon } from "@aov/ui/components/social-platform-icon"
import { useIsMobile } from "@aov/ui/hooks/use-mobile"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"

export function ProfileSocials({ links }: { links: ProfileLink[] }) {
  const { text } = useStreamLocale()
  const [active, setActive] = useState<number | null>(null)
  if (!links.length) return null

  return (
    <nav className="pf-socials" aria-label={text("Mạng xã hội và website", "Social media and website")}>
      {links.map((link, i) => (
        <SocialChannel
          key={`${link.url}-${i}`}
          link={link}
          open={active === i}
          onOpenChange={(open) => setActive((current) => (open ? i : current === i ? null : current))}
        />
      ))}
    </nav>
  )
}

function SocialChannel({
  link,
  open,
  onOpenChange,
}: {
  link: ProfileLink
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { text } = useStreamLocale()
  const titleId = useId()
  const mobile = useIsMobile()
  const panel = useRef<HTMLDivElement>(null)
  const destination = useRef<HTMLAnchorElement>(null)
  const pinned = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancelClose = () => clearTimeout(closeTimer.current)
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  useEffect(() => {
    if (!open) {
      clearTimeout(closeTimer.current)
    }
  }, [open])

  function leave() {
    if (mobile) return
    cancelClose()
    closeTimer.current = setTimeout(() => {
      if (!pinned.current && !panel.current?.contains(document.activeElement)) onOpenChange(false)
    }, 180)
  }

  let host = link.url
  try {
    host = new URL(link.url).hostname
  } catch {
    // Keep the supplied address visible when a legacy link has no absolute URL.
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={text(
            `Xem kênh ${link.label}${link.official ? " — Kênh chính thức" : ""}`,
            `View the ${link.label} channel${link.official ? " — Official channel" : ""}`,
          )}
          onPointerEnter={(event) => {
            if (mobile || event.pointerType !== "mouse") return
            cancelClose()
            if (!open) {
              pinned.current = false
              onOpenChange(true)
            }
          }}
          onPointerLeave={leave}
          onClick={(event) => {
            cancelClose()
            if (open && !pinned.current) {
              event.preventDefault()
              destination.current?.focus({ preventScroll: true })
            }
            pinned.current = true
          }}
        >
          <SocialPlatformIcon url={link.url} />
          {link.official && (
            <OfficialBadge className="pf-social-official" label={text("Kênh chính thức", "Official channel")} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={panel}
        className="pf-social-popover"
        drawerTitle={text("Mạng xã hội và website", "Social media and website")}
        side="top"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        aria-labelledby={titleId}
        onPointerEnter={cancelClose}
        onPointerLeave={leave}
        onFocusCapture={cancelClose}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) leave()
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (pinned.current) destination.current?.focus({ preventScroll: true })
        }}
        onCloseAutoFocus={(event) => {
          if (!pinned.current) event.preventDefault()
          pinned.current = false
        }}
      >
        <div className="pf-social-popover-heading">
          <SocialPlatformIcon url={link.url} size={22} />
          <strong id={titleId}>{link.label}</strong>
          <button
            type="button"
            className="hub-icon-button"
            aria-label={text("Đóng thông tin kênh", "Close channel details")}
            onClick={() => onOpenChange(false)}
          >
            <StreamIcon name="close" size={14} />
          </button>
        </div>
        <p className="pf-social-host">{host}</p>
        {link.official && (
          <p className="pf-social-status">
            <OfficialBadge label={text("Chính thức", "Official")} /> {text("Kênh chính thức", "Official channel")}
          </p>
        )}
        <a
          ref={destination}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="cp-button cp-primary pf-social-open"
        >
          {text("Mở liên kết", "Open link")}
          <StreamIcon name="external" size={14} />
        </a>
      </PopoverContent>
    </Popover>
  )
}
