import type { ReactNode } from "react"
import { ValueReveal } from "./value-reveal"
import { useDateFormat } from "../lib/time-zone"
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
  // Written dates follow this choice, so a change has to show at once.
  useDateFormat()

  const source = isValidTimeZone(sourceTimeZone) ? canonicalTimeZone(sourceTimeZone) : "UTC"
  const english = locale.startsWith("en")
  const shown = formatInZone(date, timeZone, DATE_TIME_FORMAT, locale)
  const original = formatInZone(date, source, DATE_TIME_FORMAT, locale)
  const sourceName = timeZoneLabel(source, date, locale)
  const originalTitle = english ? "Original time" : "Giờ gốc"

  return (
    <ValueReveal
      as="time"
      dateTime={value}
      className={className ? `local-time ${className}` : "local-time"}
      hiddenText={` (${originalTitle}: ${original}, ${sourceName})`}
      popupLabel={originalTitle}
      popup={
        <>
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
        </>
      }
    >
      {label ? label(timeZone) : formatInZone(date, timeZone, format, locale)}
    </ValueReveal>
  )
}
