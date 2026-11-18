import { CatalogViewMode } from "./catalog-view-mode"
import { useSearchParams } from "react-router"
import { useEffect, useRef, useState } from "react"
import { Bookmark, Database, Settings2, RotateCcw } from "lucide-react"
import { PatchTimelineRail } from "@aov/ui/components/patch-timeline-rail"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@aov/ui/lib/utils"
import type { CatalogFilter } from "./catalog-context"
import { type PublicationOverview, type Variant } from "../../api/publication-overview"
import { dateLabel } from "@/lib/schedule-date"

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
  allLabel?: string
  currentFilter?: CatalogFilter
}

interface SeasonGroup {
  id: string
  name: string
  current: boolean
  variants: Variant[]
}

/** The same horizontal timeline is available at every viewport width. */
export function CatalogTimeline(props: TimelineProps) {
  const { value, onChange } = props
  const [params, setParams] = useSearchParams()
  const showEmpty = params.get("emptyPatches") === "show"
  const canHideEmpty = !!props.allLabel && props.showCounts !== false
  const hideEmpty = canHideEmpty && !showEmpty && !props.loading
  const groups = seasonGroups(props, hideEmpty)
  const filtered = !!(value.seasonId || value.variantId)
  function toggleEmpty(checked: boolean) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (checked) next.set("emptyPatches", "show")
        else {
          next.delete("emptyPatches")
          if (props.currentFilter?.variantId && pinnedSelection(props, value.variantId)) {
            next.set("patch", props.currentFilter.variantId)
            if (props.currentFilter.seasonId) next.set("season", props.currentFilter.seasonId)
            else next.delete("season")
            next.delete("scope")
            next.delete("group")
          }
        }
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }
  return (
    <section aria-label="Dòng thời gian thay đổi" className="min-w-0 space-y-1">
      {groups.length ? (
        <div className="flex min-w-0 items-center gap-1 rounded-lg bg-muted/40 px-1 py-0.5 sm:py-1">
          <div className="min-w-0 flex-1">
            <TimelineRail {...props} groups={groups} />
          </div>
          {(props.currentFilter?.variantId || canHideEmpty) && (
            <div className="shrink-0 border-l pl-1">
              <TimelineOptions
                onReset={props.currentFilter?.variantId ? () => onChange(props.currentFilter!) : undefined}
                showEmpty={showEmpty}
                allLabel={filtered ? props.allLabel : undefined}
                changesOnly={params.get("show") === "changes" && !!props.allLabel}
                onToggle={canHideEmpty ? toggleEmpty : undefined}
              />
            </div>
          )}
        </div>
      ) : (
        <p className="type-meta px-2">Chưa có mùa hoặc patch.</p>
      )}
      <ScopeSummary {...props} />
    </section>
  )
}

function TimelineOptions({
  onReset,
  showEmpty,
  onToggle,
  allLabel,
  changesOnly,
}: {
  onReset?: () => void
  allLabel?: string
  changesOnly: boolean
  showEmpty: boolean
  onToggle?: (checked: boolean) => void
}) {
  const desktop = useMediaQuery("(min-width: 640px)")
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hovering = useRef(false)
  const cancel = () => clearTimeout(timer.current)
  useEffect(() => () => clearTimeout(timer.current), [desktop])
  const hover = (inside: boolean, pointer: string) => {
    if (!desktop || pointer !== "mouse") return
    cancel()
    if (inside && !open) {
      timer.current = setTimeout(() => {
        hovering.current = true
        setOpen(true)
      }, 150)
    } else if (!inside && hovering.current) {
      timer.current = setTimeout(() => setOpen(false), 240)
    }
  }

  const trigger = (
    <Button
      type="button"
      size={desktop ? "sm" : "icon-sm"}
      variant="ghost"
      className={cn("type-label data-[state=open]:bg-accent", changesOnly && "bg-accent text-accent-foreground")}
      aria-label="Tùy chọn dòng thời gian"
      title="Tùy chọn dòng thời gian"
      onPointerEnter={(e) => hover(true, e.pointerType)}
      onPointerLeave={(e) => hover(false, e.pointerType)}
      onClick={(event) => {
        if (desktop && open && hovering.current) {
          event.preventDefault()
          cancel()
          hovering.current = false
        }
      }}
    >
      <Settings2 className="size-4" aria-hidden />
      <span className="hidden sm:inline">Tùy chọn</span>
    </Button>
  )
  const controls = (
    <>
      {allLabel && (
        <div className="space-y-2 px-1 pb-2">
          <p className="type-label px-1 text-muted-foreground">Nội dung hiển thị</p>
          <CatalogViewMode defaultAll allLabel={allLabel} />
        </div>
      )}
      {onToggle && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm hover:bg-accent sm:min-h-9">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={showEmpty}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Hiện cả patch không có thay đổi
        </label>
      )}
      {onReset && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-full justify-start sm:h-8"
          onClick={() => {
            cancel()
            onReset()
            setOpen(false)
          }}
        >
          <RotateCcw aria-hidden /> Về patch hiện tại
        </Button>
      )}
    </>
  )
  if (!desktop)
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="max-h-[85dvh] gap-2 overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>Tùy chọn dòng thời gian</SheetTitle>
          </SheetHeader>
          <div className="px-3">{controls}</div>
        </SheetContent>
      </Sheet>
    )
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        cancel()
        if (next) hovering.current = false
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        aria-label="Tùy chọn dòng thời gian"
        className="w-80 max-w-[calc(100vw-2rem)] gap-1 p-2"
        onPointerEnter={cancel}
        onPointerLeave={(e) => hover(false, e.pointerType)}
        onKeyDownCapture={() => {
          hovering.current = false
          cancel()
        }}
        onOpenAutoFocus={(event) => {
          if (hovering.current) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          if (hovering.current) event.preventDefault()
          hovering.current = false
        }}
      >
        {controls}
      </PopoverContent>
    </Popover>
  )
}

function pinnedSelection({ value, counts, currentFilter, allLabel }: TimelineProps, id: string) {
  return !!allLabel && id === value.variantId && id !== currentFilter?.variantId && counts?.get(id)?.changes === 0
}

function ScopeSummary({ data, value, allLabel }: TimelineProps) {
  const [params] = useSearchParams()
  const variant = data.variants.find((item) => item.id === value.variantId)
  const season = data.seasons.find((item) => item.id === (variant?.seasonId ?? value.seasonId))
  return (
    <p role="status" className="sr-only">
      {[
        season?.displayName,
        variant?.patchCode,
        variant?.status === "DRAFT" ? "Nháp" : null,
        (season || variant) && allLabel ? (params.get("show") === "changes" ? "Chỉ thay đổi" : allLabel) : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>
  )
}

function seasonGroups(props: TimelineProps, hideEmpty: boolean): SeasonGroup[] {
  const { data } = props
  const seasons = [...data.seasons].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
  const groups: SeasonGroup[] = seasons.map((season) => ({
    id: season.id,
    name: season.displayName,
    current: data.markets.some((m) => m.currentSeasonId === season.id),
    variants: [],
  }))
  const unscoped: SeasonGroup = { id: "", name: "Chưa gắn mùa", current: false, variants: [] }
  for (const variant of data.variants) {
    if (
      hideEmpty &&
      variant.id !== props.value.variantId &&
      variant.id !== props.currentFilter?.variantId &&
      props.counts?.get(variant.id)?.changes === 0
    )
      continue
    const group = groups.find((group) => group.id === variant.seasonId) ?? unscoped
    group.variants.push(variant)
  }
  for (const group of [...groups, unscoped])
    group.variants.sort((a, b) => a.rulesetId.localeCompare(b.rulesetId) || a.rulesetOrdinal - b.rulesetOrdinal)
  return unscoped.variants.length ? [unscoped, ...groups] : groups
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
  if (count.baseline > 0) parts.push(`${count.baseline} mục nhập dữ liệu`)
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
  if (!count.changes) return <Database className="size-3 text-muted-foreground" aria-hidden />
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-xs leading-4 tabular-nums",
        count.changes ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}
      aria-hidden
    >
      {count.changes}
    </span>
  )
}

function TimelineRail(props: TimelineProps & { groups: SeasonGroup[] }) {
  const { data, value, onChange, groups } = props
  return (
    <PatchTimelineRail selection={value.variantId || value.seasonId} label="Chọn patch">
      {groups.map((group) => (
        <div key={group.id || "unscoped"} className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            data-season
            aria-label={`Lọc mùa ${group.name}`}
            title={group.current ? `${group.name} · Đang áp dụng` : group.name}
            aria-pressed={!!group.id && value.seasonId === group.id && !value.variantId}
            disabled={!group.id}
            onClick={() => onChange({ seasonId: group.id, variantId: "" })}
            className={cn(
              "type-label h-8 shrink-0 rounded-md px-1.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-7 sm:px-2",
              "bg-muted text-muted-foreground enabled:hover:bg-accent",
              value.seasonId === group.id &&
                !value.variantId &&
                "bg-accent text-accent-foreground ring-1 ring-inset ring-primary/50",
            )}
          >
            {group.name}
          </button>
          <div className="flex items-center gap-1 sm:gap-1.5">
            {group.variants.map((variant) => {
              if (
                props.allLabel &&
                value.seasonId &&
                group.id &&
                value.seasonId !== group.id &&
                variant.id !== props.currentFilter?.variantId
              )
                return null
              const pressed = value.variantId === variant.id
              const pinned = pinnedSelection(props, variant.id)
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
                    pinned ? "Đang xem · Giữ trên thanh khi chưa có thay đổi" : null,
                    counts,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                  onClick={() => onChange({ seasonId: variant.seasonId ?? "", variantId: variant.id })}
                  className={cn(
                    "inline-flex max-w-52 shrink-0 cursor-pointer items-center gap-1 border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-1.5",
                    "h-8 rounded-md px-1.5 sm:h-7 sm:px-2",
                    pressed ? "border-primary bg-background font-medium text-primary" : "bg-background hover:bg-accent",
                    variant.status === "DRAFT" && "border-dashed",
                    pinned && "border-dashed border-(--aov-info)/60 bg-(--aov-info-soft) text-(--aov-info)",
                  )}
                >
                  {current && <span className="size-1.5 shrink-0 rounded-full bg-(--aov-success)" aria-hidden />}
                  {pinned && <Bookmark className="size-3" aria-label="Mốc đã chọn" />}
                  <span className="truncate">{variant.patchCode}</span>
                  {variant.status === "DRAFT" && <span className="type-meta text-(--aov-warning)">Nháp</span>}
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
    </PatchTimelineRail>
  )
}
