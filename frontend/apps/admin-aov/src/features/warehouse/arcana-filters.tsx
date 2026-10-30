import { useId } from "react"
import { Gem, LayoutGrid, RotateCcw, SlidersHorizontal } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { cn } from "@aov/ui/lib/utils"

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

const optionClass = "h-7 min-w-0 gap-1.5 px-2.5 text-xs has-[>svg]:px-2.5"
const activeClass = "bg-background text-foreground shadow-xs ring-1 ring-border/60 hover:bg-background"
const groupClass = "grid grid-cols-4 gap-1 rounded-lg bg-muted/60 p-1"
const labelClass = "text-[11px] font-medium text-muted-foreground"

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
  const statId = useId()
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-3" role="group" aria-label="Bộ lọc ngọc">
      <div className="min-w-0 space-y-1.5">
        <div className={labelClass}>Màu ngọc</div>
        <div className={groupClass} role="group" aria-label="Màu ngọc">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(optionClass, !color ? activeClass : "text-muted-foreground")}
            aria-pressed={!color}
            onClick={() => onColorChange(null)}
          >
            <LayoutGrid aria-hidden className="size-3.5" />
            Tất cả
          </Button>
          {colors.map(({ value, label, icon, active }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(optionClass, color === value ? cn("ring-1", active) : "text-muted-foreground")}
              aria-pressed={color === value}
              onClick={() => onColorChange(value)}
            >
              <Gem aria-hidden className={cn("size-3.5", icon)} />
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="min-w-0 space-y-1.5">
        <div className={labelClass}>Bậc ngọc</div>
        <div className={groupClass} role="group" aria-label="Bậc ngọc">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(optionClass, !tier ? activeClass : "text-muted-foreground")}
            aria-pressed={!tier}
            onClick={() => onTierChange(null)}
          >
            Tất cả
          </Button>
          {[3, 2, 1].map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(optionClass, tier === String(value) ? activeClass : "text-muted-foreground")}
              aria-label={`Bậc ${["I", "II", "III"][value - 1]}`}
              aria-pressed={tier === String(value)}
              onClick={() => onTierChange(String(value))}
            >
              {["I", "II", "III"][value - 1]}
            </Button>
          ))}
        </div>
      </div>
      <div className="w-full min-w-0 space-y-1.5 sm:w-52">
        <label className={labelClass} htmlFor={statId}>
          Chỉ số
        </label>
        <Select
          value={stat || "all"}
          disabled={statDisabled}
          onValueChange={(value) => onStatChange(value === "all" ? null : value)}
        >
          <SelectTrigger
            id={statId}
            aria-label="Lọc chỉ số ngọc"
            className={cn("w-full gap-2 rounded-lg text-xs shadow-none", stat && "border-primary/40 bg-primary/5")}
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
      </div>
      {(color || tier || stat) && (
        <Button type="button" variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={onReset}>
          <RotateCcw aria-hidden className="size-3.5" />
          Xóa bộ lọc
        </Button>
      )}
    </div>
  )
}
