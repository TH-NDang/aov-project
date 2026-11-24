import { useId, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { AllEntityKindsIcon, entityKindIcons } from "@aov/ui/components/entity-kind-icons"
import { entityKindLabels, type EntityKind } from "@aov/ui/lib/entity-rich-text"
import { formatNumber } from "@/lib/text"

export type CatalogKind = EntityKind | "all"

/** How many kinds a narrow catalog shows before the rest are asked for. */
const COMPACT = 4

/** The kinds of the catalog, each with how many entries it holds; a kind still being counted has no number. */
export function CatalogKindFilter({
  kinds,
  counts,
  value,
  onChange,
}: {
  kinds: readonly EntityKind[]
  counts: ReadonlyMap<CatalogKind, number | undefined>
  value: CatalogKind
  onChange: (kind: CatalogKind) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const options: CatalogKind[] = ["all", ...kinds]
  const compact = new Set(options.slice(0, COMPACT))
  if (!compact.has(value)) {
    compact.delete(options[COMPACT - 1]!)
    compact.add(value)
  }
  return (
    <div className="space-y-2 border-t pt-3">
      <div
        id={id}
        role="group"
        aria-label="Lọc loại tham chiếu"
        className="grid max-w-full grid-cols-2 items-center gap-1.5 @xl/catalog:flex @xl/catalog:flex-wrap"
      >
        {options.map((key) => {
          const Icon = key === "all" ? AllEntityKindsIcon : entityKindIcons[key]
          const label = key === "all" ? "Tất cả" : entityKindLabels[key]
          const count = counts.get(key)
          return (
            <Button
              key={key}
              size="sm"
              variant="ghost"
              className={`h-8 min-w-0 justify-start gap-1.5 rounded-lg border px-2 text-xs @xl/catalog:px-2.5 ${!expanded && !compact.has(key) ? "hidden @xl/catalog:inline-flex" : ""} ${value === key ? "border-foreground/15 bg-background font-semibold text-foreground shadow-xs" : "border-transparent text-foreground/75 hover:bg-background/70"}`}
              aria-label={label}
              title={label}
              aria-pressed={value === key}
              onClick={() => onChange(key)}
            >
              <Icon aria-hidden className="size-3.5" />
              <span className="min-w-0 truncate">{label}</span>
              {count !== undefined && (
                <span aria-hidden className="ml-auto text-xs text-muted-foreground tabular-nums @xl/catalog:ml-0.5">
                  {formatNumber(count)}
                </span>
              )}
            </Button>
          )
        })}
      </div>
      {options.length > COMPACT && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-full gap-1.5 text-xs text-muted-foreground @xl/catalog:hidden"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? <ChevronUp aria-hidden className="size-3.5" /> : <ChevronDown aria-hidden className="size-3.5" />}
          {expanded ? "Thu gọn" : `Xem thêm ${options.length - COMPACT} nhóm`}
        </Button>
      )}
    </div>
  )
}
