import { ArrowUpRight, Globe } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { countryReferenceFlag } from "@aov/ui/lib/country-references"
export function MarketFlag({ code }: { code: string }) {
  const flag = countryReferenceFlag(code.trim().toUpperCase())
  return flag ? (
    <img
      src={flag}
      alt=""
      className="h-3.5 w-5 shrink-0 rounded-sm object-cover"
    />
  ) : (
    <Globe aria-hidden className="size-3.5 shrink-0" />
  )
}
export function MarketBadge({
  code,
  name,
  detail,
  onOpen,
  showName = false,
}: {
  code: string
  name: string
  detail?: string
  onOpen?: () => void
  showName?: boolean
}) {
  const displayCode = code.trim().toUpperCase()
  return (
    <span className="group inline-flex items-center gap-2" title={[name, detail].filter(Boolean).join(" · ")}>
      <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
        <MarketFlag code={displayCode} />
        {displayCode}
      </span>
      {(onOpen || showName) && <span className="text-sm">{name}</span>}
      {onOpen && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Mở ${name}`}
          onClick={onOpen}
          className="size-7 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <ArrowUpRight className="size-4" />
        </Button>
      )}
    </span>
  )
}
