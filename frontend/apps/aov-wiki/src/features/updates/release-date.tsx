import type { ReactNode } from "react"
import { LocalTime } from "@aov/ui/components/local-time"
import { useWikiContext } from "../../context/wiki-context"
import { releaseDateValue } from "./updates-api"

const DAY: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }

/** A patch's day as the market set it. Only the fallback timestamp is a moment, whose origin is the market's zone. */
export function ReleaseDate({
  regionalDate,
  effectiveAt,
  fallback,
  className,
}: {
  regionalDate?: string | null
  effectiveAt?: string | null
  fallback?: ReactNode
  className?: string
}) {
  const { locale, region, regions } = useWikiContext()
  return (
    <LocalTime
      value={releaseDateValue(regionalDate, effectiveAt)}
      sourceTimeZone={regions.find((market) => market.code === region)?.timeZone}
      format={DAY}
      locale={locale}
      fallback={fallback}
      className={className}
    />
  )
}
