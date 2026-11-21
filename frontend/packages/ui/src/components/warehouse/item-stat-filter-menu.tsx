import { SlidersHorizontal, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { ITEM_STAT_FILTERS } from "@aov/ui/lib/item-description"
import { cn } from "@aov/ui/lib/utils"
import { ItemStatBadge } from "./item-stat-icons"
import { useWarehouseText } from "./warehouse-view"

/**
 * The item stat filter as one button: it opens every stat with how many items it would leave, so a catalog keeps its
 * toolbar to one line. Several stats chosen together mean an item must give all of them.
 */
export function ItemStatFilterMenu({
  value,
  counts,
  onChange,
}: {
  value: readonly string[]
  /** How many items would match with this stat on. Stats that match nothing are dimmed unless already on. */
  counts: Readonly<Record<string, number>>
  onChange: (value: string[]) => void
}) {
  const t = useWarehouseText()
  const options = ITEM_STAT_FILTERS.filter((filter) => counts[filter.key] || value.includes(filter.key))
  if (!options.length) return null
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-colors hover:bg-muted",
          value.length ? "border-primary/60 text-foreground" : "text-muted-foreground",
        )}
      >
        <SlidersHorizontal className="size-4" />
        {t("Chỉ số", "Stats")}
        {value.length > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {value.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2rem))] space-y-3 p-3">
        <div className="space-y-0.5">
          <p className="type-label">{t("Lọc theo chỉ số", "Filter by stat")}</p>
          <p className="type-meta">
            {t("Chỉ giữ món có đủ các chỉ số đã chọn.", "Keeps items that have every stat chosen.")}
          </p>
        </div>
        <div role="group" aria-label={t("Chỉ số", "Stats")} className="grid grid-cols-2 gap-1.5">
          {options.map((filter) => {
            const active = value.includes(filter.key)
            const count = counts[filter.key] ?? 0
            return (
              <button
                key={filter.key}
                type="button"
                aria-pressed={active}
                disabled={!active && !count}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-2 text-left text-sm transition-colors disabled:cursor-default disabled:opacity-40",
                  active ? "border-primary bg-primary/10" : "border-transparent bg-muted/50 hover:bg-muted",
                )}
                onClick={() => onChange(active ? value.filter((key) => key !== filter.key) : [...value, filter.key])}
              >
                <ItemStatBadge group={filter.key} size={26} />
                <span className="min-w-0 flex-1 truncate">{t(filter.vi, filter.en)}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
              </button>
            )
          })}
        </div>
        {value.length > 0 && (
          <button type="button" className="text-sm font-medium text-primary" onClick={() => onChange([])}>
            {t("Xóa lọc chỉ số", "Clear stat filters")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** The stats being filtered on, each a chip that takes it off. */
export function ItemChosenStats({
  value,
  onChange,
  className,
}: {
  value: readonly string[]
  onChange: (value: string[]) => void
  className?: string
}) {
  const t = useWarehouseText()
  const chosen = ITEM_STAT_FILTERS.filter((filter) => value.includes(filter.key))
  if (!chosen.length) return null
  return (
    <div
      role="group"
      aria-label={t("Chỉ số đang lọc", "Stats filtered on")}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {chosen.map((filter) => (
        <button
          key={filter.key}
          type="button"
          aria-label={t(`Bỏ lọc ${filter.vi}`, `Remove ${filter.en}`)}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-1 pr-2.5 pl-1 text-sm"
          onClick={() => onChange(value.filter((key) => key !== filter.key))}
        >
          <ItemStatBadge group={filter.key} size={22} />
          {t(filter.vi, filter.en)}
          <X className="size-3.5 text-muted-foreground" />
        </button>
      ))}
      {chosen.length > 1 && (
        <button type="button" className="px-1.5 text-sm text-primary" onClick={() => onChange([])}>
          {t("Xóa tất cả", "Clear all")}
        </button>
      )}
    </div>
  )
}
