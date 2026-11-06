import { useState, type ComponentType } from "react"
import { ArrowUpRight, ChevronDown, Ellipsis, GitCompareArrows } from "lucide-react"
import { changeKindIcons } from "@aov/ui/components/change-kind-icons"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { changeTone, useChangeColors } from "./change-color-preferences"

export type ChangeKind = "BUFF" | "NERF" | "ADJUSTMENT" | "REWORK" | "FIX" | "OTHER"
type KindStyle = {
  label: string
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}
const kindStyles: Record<ChangeKind, KindStyle> = {
  BUFF: {
    label: "Tăng sức mạnh",
    icon: changeKindIcons.BUFF,
  },
  NERF: {
    label: "Giảm sức mạnh",
    icon: changeKindIcons.NERF,
  },
  ADJUSTMENT: {
    label: "Điều chỉnh",
    icon: changeKindIcons.ADJUSTMENT,
  },
  REWORK: {
    label: "Làm lại",
    icon: changeKindIcons.REWORK,
  },
  FIX: { label: "Sửa lỗi", icon: changeKindIcons.FIX },
  OTHER: { label: "Khác", icon: Ellipsis },
}

export function normalizeChangeKind(kind: string): ChangeKind {
  if (kind === "ADJUST") return "ADJUSTMENT"
  if (kind === "BUG_FIX") return "FIX"
  return Object.hasOwn(kindStyles, kind) ? (kind as ChangeKind) : "OTHER"
}

export function curatedChangeKinds(kinds: readonly string[]): ChangeKind[] {
  const selected = new Set(kinds.map(normalizeChangeKind))
  return (Object.keys(kindStyles) as ChangeKind[]).filter((kind) => selected.has(kind))
}

export function ChangeKindBadge({
  kind,
  compact = false,
  className = "",
}: {
  kind: string
  compact?: boolean
  className?: string
}) {
  const { colors } = useChangeColors()
  const normalized = normalizeChangeKind(kind)
  const { label, icon: Icon } = kindStyles[normalized]
  return (
    <span
      data-change-kind={normalized}
      title={normalized === "OTHER" && kind !== "OTHER" ? `${label} · ${kind}` : label}
      className={`type-label inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border ${compact ? "size-7" : "px-2 py-1"} ${changeTone(normalized, colors)} ${className}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className={compact ? "sr-only" : ""}>{label}</span>
    </span>
  )
}

export function ChangeKindBadges({
  kinds,
  compact = false,
  maxVisible = 3,
  emptyLabel = "Chưa có thay đổi gameplay",
}: {
  kinds: readonly string[]
  compact?: boolean
  maxVisible?: number
  emptyLabel?: string
}) {
  const ordered = curatedChangeKinds(kinds)
  const unknown = kinds.filter((kind) => normalizeChangeKind(kind) === "OTHER" && kind !== "OTHER")
  const visible = ordered.slice(0, Math.max(1, maxVisible))
  const remaining = ordered.slice(visible.length)
  if (!ordered.length) return <span className="text-xs text-muted-foreground">{emptyLabel}</span>
  return (
    <TooltipProvider>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {visible.map((kind) => (
          <Tooltip key={kind}>
            <TooltipTrigger asChild>
              <span>
                <ChangeKindBadge kind={kind === "OTHER" && unknown.length ? unknown[0] : kind} compact={compact} />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {kindStyles[kind].label}
              {kind === "OTHER" && unknown.length ? ` · ${unknown.join(", ")}` : ""}
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                title={remaining.map((kind) => kindStyles[kind].label).join(", ")}
                className="inline-flex size-7 items-center justify-center rounded-md border text-xs text-muted-foreground"
              >
                +{remaining.length}
                <span className="sr-only">: {remaining.map((kind) => kindStyles[kind].label).join(", ")}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{remaining.map((kind) => kindStyles[kind].label).join(", ")}</TooltipContent>
          </Tooltip>
        )}
      </span>
    </TooltipProvider>
  )
}

export function HeroChangeSummary({
  overallKind,
  summary,
  patchLabel,
  showPatchLabel = true,
  actualLocale,
  locale,
  onOpen,
  className = "",
}: {
  overallKind: string | null
  summary?: string | null
  patchLabel?: string
  showPatchLabel?: boolean
  actualLocale?: string | null
  locale?: string
  onOpen?: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const label = overallKind ? kindStyles[normalizeChangeKind(overallKind)].label : "Chưa đánh giá"
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Xem thay đổi gameplay${patchLabel ? ` tại ${patchLabel}` : ""}: ${label}`}
          title="Đánh giá tổng thể tướng trong patch"
          className={`inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md py-1 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=open]:bg-accent/50 ${className}`}
        >
          <span className="flex min-w-0 flex-col items-start gap-1">
            {overallKind ? (
              <ChangeKindBadge kind={overallKind} />
            ) : (
              <span className="type-label inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-muted-foreground">
                <GitCompareArrows className="size-3.5" aria-hidden />
                Chưa đánh giá
              </span>
            )}
            {showPatchLabel && patchLabel && (
              <span className="max-w-full truncate text-xs text-muted-foreground tabular-nums">{patchLabel}</span>
            )}
          </span>
          <ChevronDown aria-hidden className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-4 p-4">
        <div>
          <h3 className="type-section-title">Thay đổi tại patch</h3>
          {patchLabel && <p className="mt-1 text-xs text-muted-foreground">{patchLabel}</p>}
        </div>
        <div className="space-y-1.5">
          <p className="type-meta">Đánh giá tổng thể</p>
          {overallKind ? <ChangeKindBadge kind={overallKind} /> : <p className="type-body">Chưa đánh giá</p>}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">
          {summary || "Đã ghi nhận thay đổi. Mở chi tiết để xem nội dung đối chiếu."}
        </p>
        {actualLocale && locale && actualLocale !== locale && (
          <p className="text-xs text-muted-foreground">Ngôn ngữ dự phòng: {actualLocale}</p>
        )}
        {onOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false)
              onOpen()
            }}
          >
            Mở chi tiết thay đổi
            <ArrowUpRight className="size-3.5" />
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
