import { useSession } from "@/app/auth/auth-gate"
import { useIsWide } from "@/hooks/use-media-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { SeasonSetup } from "./season-setup"
import { SharedPatchSetup } from "./shared-version-setup"
import { CatalogViewMode } from "./catalog-view-mode"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, CalendarDays, GripHorizontal, Plus, RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import type { CatalogFilter } from "./catalog-context"
import { dateLabel, type PublicationOverview } from "./publication-overview"

export interface TimelineCount {
  changes: number
  baseline: number
}
export function CatalogTimeline({
  data,
  value,
  onChange,
  counts,
  loading = false,
  showCounts = true,
}: {
  data: PublicationOverview
  value: CatalogFilter
  onChange: (value: CatalogFilter) => void
  counts?: Map<string, TimelineCount>
  loading?: boolean
  showCounts?: boolean
}) {
  const [setup, setSetup] = useState<"season" | "patch" | null>(null)
  const wide = useIsWide()
  const canWrite = useSession().actor?.capabilities.includes("patch:write") ?? false
  const rail = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; scroll: number; moved: boolean; pointer: number } | null>(null)
  const suppressClick = useRef(false)
  const variants = [...data.variants]
    .filter(
      (v) =>
        (!value.seasonId || v.seasonId === value.seasonId) &&
        (!showCounts ||
          loading ||
          !counts ||
          v.dataReviewState !== "COMPLETE" ||
          (counts.get(v.id)?.changes ?? 0) > 0 ||
          (counts.get(v.id)?.baseline ?? 0) > 0),
    )
    .sort((a, b) => a.rulesetId.localeCompare(b.rulesetId) || a.rulesetOrdinal - b.rulesetOrdinal)
  useEffect(() => {
    const active = rail.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (active && rail.current) {
      const offset = active.offsetLeft - rail.current.offsetLeft
      if (
        offset < rail.current.scrollLeft ||
        offset + active.offsetWidth > rail.current.scrollLeft + rail.current.clientWidth
      )
        rail.current.scrollLeft = Math.max(0, offset - rail.current.clientWidth / 2 + active.offsetWidth / 2)
    }
  }, [value.variantId])
  return (
    <section aria-label="Dòng thời gian thay đổi" className="min-w-0 rounded-xl border bg-card px-3 py-3">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <CalendarDays className="size-4 text-muted-foreground" />
        <span className="hidden text-sm font-medium sm:inline">Dòng thời gian</span>
        <div className="flex min-w-0 items-center gap-1">
          <select
            aria-label="Mùa"
            className="h-8 max-w-48 rounded-md border bg-background px-2 text-sm"
            value={value.seasonId}
            onChange={(e) => onChange({ seasonId: e.target.value, variantId: "" })}
          >
            <option value="">Tất cả mùa</option>
            {[...data.seasons]
              .sort((a, b) => b.ordinal - a.ordinal)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                  {data.markets.some((m) => m.currentSeasonId === s.id) ? " · Đang áp dụng" : ""}
                </option>
              ))}
          </select>
          {canWrite && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Tạo mùa"
              onClick={() => setSetup("season")}
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
        {(value.seasonId || value.variantId) && (
          <div className="order-last flex w-full flex-wrap items-center gap-2 lg:order-none lg:w-auto">
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
        <span className="hidden items-center gap-1 text-xs text-muted-foreground 2xl:inline-flex">
          <GripHorizontal className="size-3.5" />
          Kéo ngang · chọn patch
        </span>
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Xem các patch trước"
            onClick={() => rail.current?.scrollBy({ left: -300, behavior: "smooth" })}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Xem các patch sau"
            onClick={() => rail.current?.scrollBy({ left: 300, behavior: "smooth" })}
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </header>
      <div
        ref={rail}
        className="relative flex touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-2 select-none [scrollbar-width:thin]"
        onPointerDown={(event) => {
          suppressClick.current = false
          if (event.pointerType !== "mouse" || event.button !== 0) return
          drag.current = {
            x: event.clientX,
            scroll: event.currentTarget.scrollLeft,
            moved: false,
            pointer: event.pointerId,
          }
        }}
        onPointerMove={(event) => {
          const state = drag.current
          if (!state || state.pointer !== event.pointerId || !event.buttons) return
          if (Math.abs(event.clientX - state.x) > 6) {
            state.moved = true
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
        {variants.map((variant) => {
          const count = counts?.get(variant.id)
          const season = data.seasons.find((s) => s.id === variant.seasonId)
          const releases = data.releases.filter((r) => r.variantId === variant.id && r.status !== "CANCELLED")
          const dates = releases
            .map((r) => r.effectiveOn ?? r.effectiveAt)
            .filter((d): d is string => !!d)
            .sort()
          return (
            <button
              key={variant.id}
              type="button"
              aria-pressed={value.variantId === variant.id}
              aria-label={`Lọc patch ${variant.patchCode}`}
              onClick={() => onChange({ seasonId: variant.seasonId ?? "", variantId: variant.id })}
              className={cn(
                "relative min-h-28 w-48 shrink-0 cursor-grab space-y-1 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                value.variantId === variant.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/30",
              )}
            >
              <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    value.variantId === variant.id ? "bg-primary" : "bg-muted-foreground/50",
                  )}
                />
                {season?.displayName ?? "Chưa gắn mùa"}
                {variant.status === "DRAFT" ? " · Nháp" : ""}
              </span>
              <span className="block truncate text-sm font-semibold" title={variant.patchCode}>
                {variant.patchCode}
              </span>
              {data.releases.some(
                (r) => r.variantId === variant.id && data.markets.some((m) => m.currentReleaseId === r.id),
              ) && <span className="block text-[11px] font-medium text-primary">Đang áp dụng</span>}
              <span className="block text-xs text-muted-foreground">
                {dates[0] ? dateLabel(dates[0], "vi-VN") : "Chưa có lịch thị trường"}
                {new Set(dates).size > 1 ? " · theo thị trường" : ""}
              </span>
              <span className="block text-xs">
                {!showCounts ? (
                  "Chọn để xem thay đổi"
                ) : loading ? (
                  "Đang tải…"
                ) : !count ? (
                  "Chưa tải thống kê"
                ) : (
                  <>
                    {count.changes > 0 ? (
                      <span className="font-medium text-primary">{count.changes} mục thay đổi</span>
                    ) : (
                      <span className="text-muted-foreground">Chưa ghi nhận thay đổi</span>
                    )}
                    {count.baseline > 0 && (
                      <span className="block text-[11px] text-muted-foreground">{count.baseline} mục dữ liệu nền</span>
                    )}
                  </>
                )}
              </span>
            </button>
          )
        })}
        {canWrite && (
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-28 w-24 shrink-0 flex-col gap-2 rounded-lg border border-dashed"
            aria-label="Tạo patch"
            onClick={() => setSetup("patch")}
          >
            <Plus className="size-5" />
            <span>Thêm patch</span>
          </Button>
        )}
        {!variants.length && <p className="py-4 text-sm text-muted-foreground">Chưa có patch trong phạm vi này.</p>}
      </div>
      {setup && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setSetup(null)
          }}
        >
          <SheetContent
            side={wide ? "right" : "bottom"}
            className={wide ? "w-[600px] sm:max-w-[600px]" : "max-h-[90dvh] rounded-t-2xl"}
          >
            <SheetHeader>
              <SheetTitle>{setup === "season" ? "Tạo mùa" : "Tạo patch"}</SheetTitle>
              <SheetDescription>
                Mốc gameplay dùng chung; lịch áp dụng theo thị trường được thiết lập riêng.
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-6">
              {setup === "season" ? (
                <SeasonSetup onDone={() => setSetup(null)} />
              ) : (
                <SharedPatchSetup
                  initialSeasonId={value.seasonId}
                  initialRulesetId={data.rulesets.length === 1 ? data.rulesets[0].id : ""}
                  onDone={() => setSetup(null)}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </section>
  )
}
