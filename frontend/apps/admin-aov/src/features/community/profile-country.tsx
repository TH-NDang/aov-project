import { Globe } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { countryReferenceFlag } from "@aov/ui/lib/country-references"
import { findProfileCountry } from "./profile-country-options"

export function ProfileCountry({ country }: { country?: string | null }) {
  const parts = [
    ...new Set(
      (country || "")
        .split(/[/,;]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ]
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {(parts.length ? parts : [""]).map((part) => {
        const match = findProfileCountry(part)
        const label = match?.name || part || "Chưa có quốc gia / khu vực"
        const flag = match ? countryReferenceFlag(match.code) : undefined
        return (
          <Tooltip key={part}>
            <TooltipTrigger asChild>
              <span
                role="img"
                aria-label={`Quốc gia / khu vực: ${label}`}
                tabIndex={0}
                className="inline-flex h-6 min-w-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {flag ? (
                  <img src={flag} alt="" className="h-4 w-6 rounded-sm object-cover ring-1 ring-foreground/10" />
                ) : (
                  <Globe className="size-4 text-muted-foreground" />
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </span>
  )
}
