import { ArrowUpRight, Globe } from "lucide-react"
import { Button } from "@aov/ui/components/button"
const flags = new Set(["VN", "US", "GB", "TH", "TW", "CN", "ID", "JP", "KR"])
export function MarketBadge({
  code,
  name,
  detail,
  onOpen,
}: {
  code: string
  name: string
  detail?: string
  onOpen?: () => void
}) {
  return (
    <span className="group inline-flex items-center gap-2" title={[name, detail].filter(Boolean).join(" · ")}>
      <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
        {flags.has(code) ? (
          <img src={`/images/flags/${code.toLowerCase()}.svg`} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
        ) : (
          <Globe className="size-3.5" />
        )}{" "}
        {code}
      </span>
      {onOpen && <span className="text-sm">{name}</span>}
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
