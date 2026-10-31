import { Gem, LayoutGrid, RotateCcw, SlidersHorizontal } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { cn } from "@aov/ui/lib/utils"
import { FilterTab, FilterTabs } from "@/components/filter-tabs"

const colors = [
  {
    value: "RED",
    label: "Đỏ",
    icon: "fill-rose-500/15 text-rose-500",
    active: "bg-rose-500/10 text-rose-700 ring-rose-500/25 hover:bg-rose-500/15 dark:text-rose-300",
  },
  {
    value: "PURPLE",
    label: "Tím",
    icon: "fill-violet-500/15 text-violet-500",
    active: "bg-violet-500/10 text-violet-700 ring-violet-500/25 hover:bg-violet-500/15 dark:text-violet-300",
  },
  {
    value: "GREEN",
    label: "Xanh",
    icon: "fill-emerald-500/15 text-emerald-500",
    active: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 hover:bg-emerald-500/15 dark:text-emerald-300",
  },
] as const

export function ArcanaFilters({
  color,
  tier,
  stat,
  statOptions,
  statDisabled = false,
  onColorChange,
  onTierChange,
  onStatChange,
  onReset,
}: {
  color: string
  tier: string
  stat: string
  statOptions: { value: string; label: string }[]
  statDisabled?: boolean
  onColorChange: (value: string | null) => void
  onTierChange: (value: string | null) => void
  onStatChange: (value: string | null) => void
  onReset: () => void
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Bộ lọc ngọc">
      <FilterTabs label="Màu ngọc">
        <FilterTab active={!color} onClick={() => onColorChange(null)}>
          <LayoutGrid aria-hidden />
          Tất cả màu
        </FilterTab>
        {colors.map(({ value, label, icon, active }) => (
          <FilterTab
            key={value}
            active={color === value}
            className={cn(color === value && cn("ring-1", active))}
            onClick={() => onColorChange(value)}
          >
            <Gem aria-hidden className={icon} />
            {label}
          </FilterTab>
        ))}
      </FilterTabs>
      <FilterTabs label="Bậc ngọc">
        <FilterTab active={!tier} onClick={() => onTierChange(null)}>
          Mọi bậc
        </FilterTab>
        {[3, 2, 1].map((value) => (
          <FilterTab
            key={value}
            active={tier === String(value)}
            aria-label={`Bậc ${["I", "II", "III"][value - 1]}`}
            onClick={() => onTierChange(String(value))}
          >
            {["I", "II", "III"][value - 1]}
          </FilterTab>
        ))}
      </FilterTabs>
      <Select
        value={stat || "all"}
        disabled={statDisabled}
        onValueChange={(value) => onStatChange(value === "all" ? null : value)}
      >
        <SelectTrigger
          aria-label="Lọc chỉ số ngọc"
          className={cn(
            "h-10! w-full gap-2 rounded-xl text-sm shadow-none sm:w-52",
            stat && "border-primary/40 bg-primary/5",
          )}
        >
          <SlidersHorizontal aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">
            <SelectValue placeholder="Tất cả chỉ số" />
          </span>
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="rounded-lg">
          <SelectItem value="all" className="text-xs">
            Tất cả chỉ số
          </SelectItem>
          {statOptions.map(({ value, label }) => (
            <SelectItem key={value} value={value} className="text-xs">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(color || tier || stat) && (
        <Button type="button" variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={onReset}>
          <RotateCcw aria-hidden className="size-3.5" />
          Xóa bộ lọc
        </Button>
      )}
    </div>
  )
}
