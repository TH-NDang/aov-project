import { CatalogViewMode } from "./catalog-view-mode"
import { Fragment, useEffect, useRef, useState } from "react"
import { CalendarDays, Check, ChevronDown, RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import type { CatalogFilter } from "./catalog-context"
import { dateLabel, type PublicationOverview, type Variant } from "./publication-overview"

export interface TimelineCount {
  changes: number
  baseline: number
}

interface TimelineProps {
  data: PublicationOverview
  value: CatalogFilter
  onChange: (value: CatalogFilter) => void
  counts?: Map<string, TimelineCount>
  loading?: boolean
  showCounts?: boolean
}

interface SeasonGroup {
  id: string
  name: string
  current: boolean
  variants: Variant[]
}

/**
 * One-line patch scope shared by catalog pages: patches sit on a rail grouped by season, the patch markets play now has
 * a green dot, and a count shows what changed. On phones the rail collapses into a scope button.
 */
export function CatalogTimeline(props: TimelineProps) {
  const { value, onChange } = props
  const groups = seasonGroups(props)
  const filtered = !!(value.seasonId || value.variantId)
  return (
    <section
      aria-label="Dòng thời gian thay đổi"
      className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border bg-card px-2 py-1.5"
    >
      <CalendarDays className="ml-1 hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
      <TimelineRail {...props} groups={groups} />
      <ScopeButton {...props} groups={groups} />
      {filtered && (
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <CatalogViewMode />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => onChange({ seasonId: "", variantId: "" })}
          >
            <RotateCcw className="size-3.5" />
            Bỏ lọc
          </Button>
        </div>
      )}
      {!groups.length && <p className="px-2 text-sm text-muted-foreground">Chưa có patch trong phạm vi này.</p>}
    </section>
  )
}

function seasonGroups({ data, counts, loading = false, showCounts = true }: TimelineProps): SeasonGroup[] {
  const visible = data.variants.filter(
    (v) =>
      !showCounts ||
      loading ||
      !counts ||
      v.dataReviewState !== "COMPLETE" ||
      (counts.get(v.id)?.changes ?? 0) > 0 ||
      (counts.get(v.id)?.baseline ?? 0) > 0,
  )
  const seasons = [...data.seasons].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
  const groups: SeasonGroup[] = seasons.map((season) => ({
    id: season.id,
    name: season.displayName,
    current: data.markets.some((m) => m.currentSeasonId === season.id),
    variants: [],
  }))
  const unscoped: SeasonGroup = { id: "", name: "Chưa gắn mùa", current: false, variants: [] }
  for (const variant of visible)
    (groups.find((group) => group.id === variant.seasonId) ?? unscoped).variants.push(variant)
  for (const group of [...groups, unscoped])
    group.variants.sort((a, b) => a.rulesetId.localeCompare(b.rulesetId) || a.rulesetOrdinal - b.rulesetOrdinal)
  return [unscoped, ...groups].filter((group) => group.variants.length)
}

function isCurrent(data: PublicationOverview, variant: Variant) {
  return data.releases.some((r) => r.variantId === variant.id && data.markets.some((m) => m.currentReleaseId === r.id))
}

function countText({ counts, loading = false, showCounts = true }: TimelineProps, variant: Variant) {
  if (!showCounts) return ""
  if (loading) return "Đang tải…"
  const count = counts?.get(variant.id)
  if (!count) return "Chưa tải thống kê"
  const parts = [count.changes > 0 ? `${count.changes} mục thay đổi` : "Chưa ghi nhận thay đổi"]
  if (count.baseline > 0) parts.push(`${count.baseline} mục dữ liệu nền`)
  return parts.join(" · ")
}

function releaseText(data: PublicationOverview, variant: Variant) {
  const dates = data.releases
    .filter((r) => r.variantId === variant.id && r.status !== "CANCELLED")
    .map((r) => r.effectiveOn ?? r.effectiveAt)
    .filter((date): date is string => !!date)
    .sort()
  if (!dates.length) return "Chưa có lịch thị trường"
  return `Áp dụng ${dateLabel(dates[0], "vi-VN")}${new Set(dates).size > 1 ? " · theo thị trường" : ""}`
}

function CountBadge({ props, variant }: { props: TimelineProps; variant: Variant }) {
  const count = props.counts?.get(variant.id)
  if (props.showCounts === false) return null
  if (!count || (!count.changes && !count.baseline)) return null
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-xs leading-4 tabular-nums",
        count.changes ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}
      aria-hidden
    >
      {count.changes || count.baseline}
    </span>
  )
}

function TimelineRail(props: TimelineProps & { groups: SeasonGroup[] }) {
  const { data, value, onChange, groups } = props
  const rail = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; scroll: number; pointer: number } | null>(null)
  const suppressClick = useRef(false)
  useEffect(() => {
    const active = rail.current?.querySelector<HTMLElement>('[data-patch][aria-pressed="true"]')
    if (active && rail.current) {
      const offset = active.offsetLeft - rail.current.offsetLeft
      if (
        offset < rail.current.scrollLeft ||
        offset + active.offsetWidth > rail.current.scrollLeft + rail.current.clientWidth
      )
        rail.current.scrollLeft = Math.max(0, offset - rail.current.clientWidth / 2 + active.offsetWidth / 2)
    }
  }, [value.variantId])
  const all = !value.seasonId && !value.variantId
  return (
    <div
      ref={rail}
      role="group"
      aria-label="Chọn patch"
      className="hidden min-w-0 flex-1 touch-pan-x items-center gap-1 overflow-x-auto overscroll-x-contain py-0.5 select-none [scrollbar-width:none] sm:flex"
      onPointerDown={(event) => {
        suppressClick.current = false
        if (event.pointerType !== "mouse" || event.button !== 0) return
        drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, pointer: event.pointerId }
      }}
      onPointerMove={(event) => {
        const state = drag.current
        if (!state || state.pointer !== event.pointerId || !event.buttons) return
        if (Math.abs(event.clientX - state.x) > 6) {
          suppressClick.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.scrollLeft = state.scroll - (event.clientX - state.x)
          event.preventDefault()
        }
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId)
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
        suppressClick.current = false
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault()
          event.stopPropagation()
          suppressClick.current = false
        }
      }}
    >
      <button
        type="button"
        aria-pressed={all}
        onClick={() => onChange({ seasonId: "", variantId: "" })}
        className={cn(
          "h-7 shrink-0 rounded-full border px-2.5 text-xs transition-colors",
          all ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-accent/50",
        )}
      >
        Tất cả
      </button>
      {groups.map((group, index) => (
        <Fragment key={group.id || "unscoped"}>
          {index > 0 && <span className="h-px w-3 shrink-0 bg-border" aria-hidden />}
          <button
            type="button"
            aria-label={`Lọc mùa ${group.name}`}
            aria-pressed={!!group.id && value.seasonId === group.id && !value.variantId}
            disabled={!group.id}
            onClick={() => onChange({ seasonId: group.id, variantId: "" })}
            className={cn(
              "h-7 shrink-0 rounded-md px-1.5 text-xs whitespace-nowrap text-muted-foreground transition-colors enabled:hover:text-foreground",
              value.seasonId === group.id &&
                !value.variantId &&
                "font-medium text-foreground underline underline-offset-4",
            )}
          >
            {group.name}
          </button>
          {group.variants.map((variant) => {
            const pressed = value.variantId === variant.id
            const current = isCurrent(data, variant)
            const counts = countText(props, variant)
            return (
              <button
                key={variant.id}
                type="button"
                data-patch
                aria-pressed={pressed}
                aria-label={`Lọc patch ${variant.patchCode}`}
                title={[
                  `${group.name} · ${variant.patchCode}${variant.status === "DRAFT" ? " · Nháp" : ""}`,
                  current ? "Đang áp dụng" : releaseText(data, variant),
                  counts,
                ]
                  .filter(Boolean)
                  .join("\n")}
                onClick={() => onChange({ seasonId: variant.seasonId ?? "", variantId: variant.id })}
                className={cn(
                  "inline-flex h-7 max-w-44 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  pressed
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "bg-background hover:bg-accent/50",
                  variant.status === "DRAFT" && "border-dashed",
                )}
              >
                {current && <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />}
                <span className="truncate">{variant.patchCode}</span>
                <CountBadge props={props} variant={variant} />
                <span className="sr-only">
                  {current ? " · Đang áp dụng" : ""}
                  {counts ? ` · ${counts}` : ""}
                </span>
              </button>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}

/** Phones show the current scope as one button; the full list opens in a popover. */
function ScopeButton(props: TimelineProps & { groups: SeasonGroup[] }) {
  const { data, value, onChange, groups } = props
  const [open, setOpen] = useState(false)
  const variant = data.variants.find((item) => item.id === value.variantId)
  const season = data.seasons.find((item) => item.id === (variant?.seasonId ?? value.seasonId))
  const label = variant
    ? `${season?.displayName ?? "Chưa gắn mùa"} › ${variant.patchCode}`
    : (season?.displayName ?? "Tất cả patch")
  const choose = (next: CatalogFilter) => {
    onChange(next)
    setOpen(false)
  }
  const row = (pressed: boolean) =>
    cn(
      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
      pressed ? "bg-primary/10 text-primary" : "hover:bg-accent/50",
    )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 min-w-0 flex-1 justify-between sm:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[60dvh] w-72 overflow-y-auto p-1.5">
        <button
          type="button"
          className={row(!value.seasonId && !value.variantId)}
          onClick={() => choose({ seasonId: "", variantId: "" })}
        >
          Tất cả patch
        </button>
        {[...groups].reverse().map((group) => (
          <div key={group.id || "unscoped"} className="mt-1.5">
            <button
              type="button"
              disabled={!group.id}
              className="w-full px-2 py-1 text-left text-xs text-muted-foreground"
              onClick={() => choose({ seasonId: group.id, variantId: "" })}
            >
              {group.name}
              {group.current ? " · đang áp dụng" : ""}
            </button>
            {[...group.variants].reverse().map((item) => {
              const pressed = value.variantId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={row(pressed)}
                  onClick={() => choose({ seasonId: item.seasonId ?? "", variantId: item.id })}
                >
                  {isCurrent(data, item) ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Đang áp dụng" />
                  ) : (
                    <span className="size-1.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.patchCode}</span>
                  <CountBadge props={props} variant={item} />
                  {pressed && <Check className="size-4 shrink-0" />}
                </button>
              )
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
