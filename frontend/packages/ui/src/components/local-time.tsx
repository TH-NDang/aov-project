import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import {
  DATE_TIME_FORMAT,
  canonicalTimeZone,
  formatCalendarDate,
  formatInZone,
  isCalendarDate,
  isValidTimeZone,
  shownTimeZoneLabel,
  timeZoneLabel,
  toInstant,
  useUserTimeZone,
  type TimeValue,
} from "../lib/time-zone"

const OPEN_DELAY = 120
const CLOSE_DELAY = 160

type LocalTimeProps = {
  value: TimeValue | null | undefined
  /** IANA zone the item really happens in, such as a tournament's. Items without one show UTC as the original. */
  sourceTimeZone?: string | null
  /** How the moment reads in the page; the default is the time and the full date. */
  format?: Intl.DateTimeFormatOptions
  /** Replaces the formatted text, for labels like "5 minutes ago". Receives the zone the page is showing. */
  label?: (timeZone: string) => ReactNode
  locale?: string
  /** Shown when there is no valid value. */
  fallback?: ReactNode
  className?: string
}

/**
 * A moment shown in the user's chosen zone, with dashes underneath. Hovering, tapping or focusing it reveals the
 * original time of the item with the zone's name. Rows are often links, so using it never activates the row.
 * Calendar dates have no time to convert, so they render as written with no dashes and no popup.
 */
export function LocalTime({
  value,
  fallback = null,
  className,
  format,
  label,
  locale = "vi-VN",
  ...rest
}: LocalTimeProps) {
  if (isCalendarDate(value))
    return (
      <time dateTime={value} className={className}>
        {label ? label("UTC") : formatCalendarDate(value, format, locale)}
      </time>
    )
  const date = toInstant(value)
  if (!date) return <>{fallback}</>
  return (
    <ConvertedTime
      value={typeof value === "string" ? value : date.toISOString()}
      date={date}
      className={className}
      format={format}
      label={label}
      locale={locale}
      {...rest}
    />
  )
}

function ConvertedTime({
  value,
  date,
  sourceTimeZone,
  format = DATE_TIME_FORMAT,
  label,
  locale,
  className,
}: Omit<LocalTimeProps, "value" | "fallback"> & { value: string; date: Date; locale: string }) {
  const timeZone = useUserTimeZone()
  const [open, setOpen] = useState(false)
  const pinned = useRef(false)
  const pressing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const anchor = useRef<HTMLTimeElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const source = isValidTimeZone(sourceTimeZone) ? canonicalTimeZone(sourceTimeZone) : "UTC"
  const english = locale.startsWith("en")
  const shown = formatInZone(date, timeZone, DATE_TIME_FORMAT, locale)
  const original = formatInZone(date, source, DATE_TIME_FORMAT, locale)
  const sourceName = timeZoneLabel(source, date, locale)
  const originalTitle = english ? "Original time" : "Giờ gốc"

  const later = (next: boolean, delay: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(next), delay)
  }
  const close = () => {
    clearTimeout(timer.current)
    pinned.current = false
    setOpen(false)
  }
  /** A first press keeps open what hovering started; the next one closes it. */
  const press = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    clearTimeout(timer.current)
    if (pinned.current) close()
    else {
      pinned.current = true
      setOpen(true)
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else close()
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <time
          ref={anchor}
          dateTime={value}
          className={className ? `local-time ${className}` : "local-time"}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onPointerDown={() => {
            pressing.current = true
          }}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") later(true, OPEN_DELAY)
          }}
          onPointerLeave={(event) => {
            pressing.current = false
            if (event.pointerType === "mouse" && !pinned.current) later(false, CLOSE_DELAY)
          }}
          onFocus={() => {
            if (!pressing.current) setOpen(true)
          }}
          onBlur={(event) => {
            pressing.current = false
            // Pressing the popup, to select its text for example, moves focus there and must not close it.
            if (!popup.current?.contains(event.relatedTarget)) close()
          }}
          onClick={(event) => {
            pressing.current = false
            press(event)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") press(event)
          }}
        >
          {label ? label(timeZone) : formatInZone(date, timeZone, format, locale)}
          <span className="local-time-hidden">{` (${originalTitle}: ${original}, ${sourceName})`}</span>
        </time>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={popup}
          className="local-time-popup"
          side="top"
          sideOffset={6}
          collisionPadding={12}
          hideWhenDetached
          aria-label={originalTitle}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchor.current?.contains(event.target as Node)) event.preventDefault()
          }}
          onPointerEnter={() => clearTimeout(timer.current)}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse" && !pinned.current) later(false, CLOSE_DELAY)
          }}
          // React events bubble through the portal, so a click here would still reach a surrounding link.
          onClick={(event) => event.stopPropagation()}
        >
          <div className="local-time-popup-row">
            <span>{`${originalTitle} · ${sourceName}`}</span>
            <strong>{original}</strong>
          </div>
          {shown !== original && (
            <div className="local-time-popup-row">
              <span>{`${english ? "Your time" : "Giờ của bạn"} · ${shownTimeZoneLabel(date, locale)}`}</span>
              <strong>{shown}</strong>
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
