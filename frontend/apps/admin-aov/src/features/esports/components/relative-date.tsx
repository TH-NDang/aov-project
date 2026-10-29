import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { cn } from "@aov/ui/lib/utils"
import { exactDate, formatTime, relativeDay } from "../model/labels"

/**
 * A date written the way people say it (yesterday, in 3 days), with the full date and time on hover. It brings its
 * own tooltip provider so pages outside the admin shell can use it too.
 */
export function RelativeDate({
  value,
  withTime = false,
  dayOnly = false,
  fallback = "",
  className,
}: {
  value?: string | null
  /** Appends the time of day after the relative day. */
  withTime?: boolean
  /** Leaves the time out of the tooltip, for labels that stand for a whole day. */
  dayOnly?: boolean
  fallback?: string
  className?: string
}) {
  const label = relativeDay(value)
  if (!label) return fallback ? <span className={className}>{fallback}</span> : null
  const exact = exactDate(value, !dayOnly)
  const time = withTime ? formatTime(value) : ""
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <time
            dateTime={value ?? undefined}
            aria-label={`${label}${time ? ` ${time}` : ""} (${exact})`}
            className={cn("cursor-help underline decoration-dotted decoration-1 underline-offset-2", className)}
          >
            {label}
            {time && ` · ${time}`}
          </time>
        </TooltipTrigger>
        <TooltipContent className="first-letter:uppercase">{exact}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
