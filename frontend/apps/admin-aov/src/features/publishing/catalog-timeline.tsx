import { CatalogViewMode } from "./catalog-view-mode"
import { useSearchParams } from "react-router"
import { targetVariants } from "./catalog-data"
import { useEffect, useRef, useState } from "react"
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
  seasonView?: "latest" | "each-patch"
  heroCatalog?: boolean
  currentFilter?: CatalogFilter
}

interface SeasonGroup {
  id: string
  name: string
  current: boolean
  variants: Variant[]
}

/** Keep the time scope separate from the display mode, with a compact picker on phones. */
export function CatalogTimeline(props: TimelineProps) {
  const { value, onChange } = props
  const groups = seasonGroups(props)
  const filtered = !!(value.seasonId || value.variantId)
  if (props.heroCatalog)
    return (
      <section
        aria-label="Dòng thời gian thay đổi"
        className="min-w-0 space-y-2 rounded-lg border border-border/70 bg-card p-2"
      >
        <div className="min-w-0">
          {groups.length ? (
            <>
              <TimelineRail {...props} groups={groups} />
              <ScopeButton {...props} groups={groups} />
            </>
          ) : (
            <p className="type-meta px-2">Chưa có patch.</p>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          {props.currentFilter?.variantId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="type-label h-7 shrink-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              aria-label="Patch hiện tại"
              title="Về patch hiện tại"
              onClick={() => onChange(props.currentFilter!)}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Hiện tại
            </Button>
          )}
          {filtered && <CatalogViewMode defaultAll allLabel="Tất cả tướng" compact />}
        </div>
        <div className="sr-only">
          <ScopeSummary {...props} />
        </div>
      </section>
    )
  return (
    <section aria-label="Dòng thời gian thay đổi" className="min-w-0 space-y-3 rounded-xl border bg-card p-3">
      <div className="flex min-h-9 items-center gap-2 sm:min-h-7">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="type-label">Mùa và patch</span>
        {filtered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-9 gap-1.5 px-2 sm:h-7"
            onClick={() => onChange(props.currentFilter ?? { seasonId: "", variantId: "" })}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {props.heroCatalog ? "Patch hiện tại" : "Bỏ lọc"}
          </Button>
        )}
      </div>
      {groups.length ? (
        <>
          <TimelineRail {...props} groups={groups} />
          <ScopeButton {...props} groups={groups} />
        </>
      ) : (
        <p className="type-meta">Chưa có patch trong phạm vi này.</p>
      )}
      <div className="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <ScopeSummary {...props} />
        {filtered && (
          <CatalogViewMode defaultAll={props.heroCatalog} allLabel={props.heroCatalog ? "Tất cả tướng" : undefined} />
        )}
      </div>
    </section>
  )
}

function ScopeSummary({ data, value, seasonView = "latest", heroCatalog }: TimelineProps) {
  const [params] = useSearchParams()
  const showAll = params.get("show") === "all" || (heroCatalog && params.get("show") !== "changes")
  const variant = data.variants.find((item) => item.id === value.variantId)
  const season = data.seasons.find((item) => item.id === (variant?.seasonId ?? value.seasonId))
  let description = "Danh sách chung · Chọn mùa hoặc patch để xem lịch sử."
  if (variant) {
    const label = [season?.displayName, variant.patchCode, variant.status === "DRAFT" ? "Nháp" : null]
      .filter(Boolean)
      .join(" · ")
    description = heroCatalog
      ? `${label} · ${showAll ? "Tất cả tướng" : "Chỉ tướng có thay đổi"}`
      : `${showAll ? "Dữ liệu đến patch" : "Thay đổi tại patch"} ${label}`
  } else if (season) {
    if (!showAll) description = `Thay đổi trong mùa ${season.displayName} · Gồm các patch trong mùa.`
    else if (seasonView === "each-patch") description = `Dữ liệu tại từng patch trong mùa ${season.displayName}.`
    else {
      const targets = targetVariants(data, value)
        .map((item) => `${item.patchCode}${item.status === "DRAFT" ? " (nháp)" : ""}`)
        .join(", ")
      description = targets
        ? `${season.displayName} · Dữ liệu đến patch cuối của mùa: ${targets}`
        : `${season.displayName} · Chưa có patch để xác định mốc dữ liệu.`
    }
  }
  return (
    <p role="status" className="type-meta min-w-0 flex-1 break-words sm:basis-64">
      {description}
    </p>
  )
}

function seasonGroups({
  data,
  value,
  counts,
  loading = false,
  showCounts = true,
  heroCatalog,
}: TimelineProps): SeasonGroup[] {
  const visible = data.variants.filter(
    (v) =>
      heroCatalog ||
      v.id === value.variantId ||
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
    const active = rail.current?.querySelector<HTMLElement>(
      '[data-patch][aria-pressed="true"], [data-season][aria-pressed="true"]',
    )
    if (active && rail.current) {
      const offset =
        active.getBoundingClientRect().left - rail.current.getBoundingClientRect().left + rail.current.scrollLeft
      if (
        offset < rail.current.scrollLeft ||
        offset + active.offsetWidth > rail.current.scrollLeft + rail.current.clientWidth
      )
        rail.current.scrollLeft = Math.max(0, offset - rail.current.clientWidth / 2 + active.offsetWidth / 2)
    }
  }, [value.seasonId, value.variantId])
  return (
    <div
      ref={rail}
      role="group"
      aria-label="Chọn patch"
      className={cn(
        "hidden min-w-0 cursor-grab touch-pan-x gap-3 overflow-x-auto overscroll-x-contain pb-1 select-none active:cursor-grabbing [scrollbar-width:thin] sm:flex",
        props.heroCatalog ? "items-center" : "items-stretch",
      )}
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
      {groups.map((group) => (
        <div
          key={group.id || "unscoped"}
          className={cn(
            "flex shrink-0 gap-2 border-r border-border/60 pr-3 last:border-r-0 last:pr-0",
            props.heroCatalog ? "items-center" : "flex-col items-start",
          )}
        >
          <button
            type="button"
            data-season
            aria-label={`Lọc mùa ${group.name}`}
            aria-pressed={!!group.id && value.seasonId === group.id && !value.variantId}
            disabled={!group.id}
            onClick={() => onChange({ seasonId: group.id, variantId: "" })}
            className={cn(
              "type-label h-7 shrink-0 rounded-md px-2 whitespace-nowrap transition-colors enabled:hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              props.heroCatalog && "text-muted-foreground",
              value.seasonId === group.id && !value.variantId && "bg-primary/10 text-primary",
            )}
          >
            {group.name}
          </button>
          <div className="flex items-center gap-1.5">
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
                    "inline-flex max-w-52 shrink-0 cursor-pointer items-center gap-1.5 border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    props.heroCatalog ? "h-7 rounded-md px-2" : "h-8 rounded-full px-3",
                    pressed
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "bg-background hover:bg-accent/50",
                    variant.status === "DRAFT" && "border-dashed",
                  )}
                >
                  {current && <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />}
                  <span className="truncate">{variant.patchCode}</span>
                  {props.heroCatalog && variant.status === "DRAFT" && (
                    <span className="type-meta text-amber-700 dark:text-amber-300">Nháp</span>
                  )}
                  <CountBadge props={props} variant={variant} />
                  <span className="sr-only">
                    {current ? " · Đang áp dụng" : ""}
                    {counts ? ` · ${counts}` : ""}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Phones show the selected patch with the full list in a popover. */
function ScopeButton(props: TimelineProps & { groups: SeasonGroup[] }) {
  const { data, value, onChange, groups, heroCatalog } = props
  const [open, setOpen] = useState(false)
  const variant = data.variants.find((item) => item.id === value.variantId)
  const season = data.seasons.find((item) => item.id === (variant?.seasonId ?? value.seasonId))
  const label = variant
    ? `${season?.displayName ?? "Chưa gắn mùa"} › ${variant.patchCode}`
    : (season?.displayName ?? "Chọn mùa hoặc patch")
  const choose = (next: CatalogFilter) => {
    onChange(next)
    setOpen(false)
  }
  const row = (pressed: boolean) =>
    cn(
      "flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring",
      pressed ? "bg-primary/10 text-primary" : "hover:bg-accent/50",
    )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={heroCatalog ? "ghost" : "outline"}
          size="sm"
          aria-label="Chọn mùa hoặc patch"
          className={
            heroCatalog
              ? "h-8 w-full min-w-0 justify-between gap-2 px-2 text-left sm:hidden"
              : "h-11 w-full min-w-0 justify-between sm:hidden"
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", heroCatalog && "type-label")}>{label}</span>
            {heroCatalog && variant?.status === "DRAFT" && (
              <span className="type-meta shrink-0 rounded bg-amber-500/10 px-1.5 text-amber-700 dark:text-amber-300">
                Nháp
              </span>
            )}
            {heroCatalog && variant && isCurrent(data, variant) && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                title="Đang áp dụng"
                aria-label="Đang áp dụng"
              />
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[60dvh] w-[max(18rem,var(--radix-popover-trigger-width))] max-w-[calc(100vw-2rem)] overflow-y-auto p-1.5"
      >
        {[...groups].reverse().map((group) => (
          <div key={group.id || "unscoped"} className="mt-1.5">
            <button
              type="button"
              disabled={!group.id}
              aria-pressed={!!group.id && value.seasonId === group.id && !value.variantId}
              className={cn(
                "type-label flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left enabled:hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring",
                value.seasonId === group.id && !value.variantId && "bg-primary/10 text-primary",
              )}
              onClick={() => choose({ seasonId: group.id, variantId: "" })}
            >
              <span>
                {group.name}
                {group.current ? " · đang áp dụng" : ""}
              </span>
              {!!group.id && value.seasonId === group.id && !value.variantId && (
                <Check className="size-4 shrink-0" aria-hidden />
              )}
            </button>
            {[...group.variants].reverse().map((item) => {
              const pressed = value.variantId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={row(pressed)}
                  aria-label={`Lọc patch ${item.patchCode}`}
                  aria-pressed={pressed}
                  onClick={() => choose({ seasonId: item.seasonId ?? "", variantId: item.id })}
                >
                  {isCurrent(data, item) ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Đang áp dụng" />
                  ) : (
                    <span className="size-1.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.patchCode}</span>
                  {heroCatalog && item.status === "DRAFT" && <span className="type-meta">Nháp</span>}
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
