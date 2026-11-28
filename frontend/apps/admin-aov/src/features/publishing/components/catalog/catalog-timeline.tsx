import { CatalogViewMode } from "./catalog-view-mode"
import { useSearchParams } from "react-router"
import { useEffect, useRef, useState } from "react"
import { Settings2, RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@aov/ui/lib/utils"
import { SeasonTrack } from "./season-track"
import { pinnedSelection, seasonGroups, type TimelineProps } from "./timeline-model"

/**
 * Which moment of the catalog the page shows: one row of seasons in which only the season being read opens into its
 * patches. On a phone the row runs edge to edge so a thumb can swipe it; wider screens frame it under the page title.
 */
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
        <div className="flex min-w-0 items-center gap-1 rounded-lg border bg-muted/30 p-1 max-md:-mx-4 max-md:rounded-none max-md:border-x-0 max-md:px-2">
          <div className="min-w-0 flex-1">
            <SeasonTrack {...props} groups={groups} />
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
