import { useState, type ComponentType } from "react"
import { ArrowDown, ArrowUp, ArrowUpRight, Ellipsis, RefreshCw, Scale, Wrench } from "lucide-react"
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
    icon: ArrowUp,
  },
  NERF: {
    label: "Giảm sức mạnh",
    icon: ArrowDown,
  },
  ADJUSTMENT: {
    label: "Điều chỉnh",
    icon: Scale,
  },
  REWORK: {
    label: "Làm lại",
    icon: RefreshCw,
  },
  FIX: { label: "Sửa lỗi", icon: Wrench },
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

export function ChangeKindBadge({ kind, compact = false }: { kind: string; compact?: boolean }) {
  const { colors } = useChangeColors()
  const normalized = normalizeChangeKind(kind)
  const { label, icon: Icon } = kindStyles[normalized]
  return (
    <span
      data-change-kind={normalized}
      title={normalized === "OTHER" && kind !== "OTHER" ? `${label} · ${kind}` : label}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border text-xs font-medium ${compact ? "size-7" : "px-2 py-1"} ${changeTone(normalized, colors)}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className={compact ? "sr-only" : ""}>{label}</span>
    </span>
  )
}

export function ChangeKindBadges({
  kinds,
  compact = false,
  maxVisible = 3,
}: {
  kinds: readonly string[]
  compact?: boolean
  maxVisible?: number
}) {
  const ordered = curatedChangeKinds(kinds)
  const unknown = kinds.filter((kind) => normalizeChangeKind(kind) === "OTHER" && kind !== "OTHER")
  const visible = ordered.slice(0, Math.max(1, maxVisible))
  const remaining = ordered.slice(visible.length)
  if (!ordered.length) return <span className="text-xs text-muted-foreground">Chưa có thay đổi gameplay</span>
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
  kinds,
  summary,
  patchLabel,
  actualLocale,
  locale,
  onOpen,
  className = "",
}: {
  kinds: readonly string[]
  summary?: string | null
  patchLabel?: string
  actualLocale?: string | null
  locale?: string
  onOpen?: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ordered = curatedChangeKinds(kinds)
  if (!ordered.length && !summary)
    return <span className="text-xs text-muted-foreground">Chưa có thay đổi gameplay</span>
  const labels = ordered.map((kind) => kindStyles[kind].label).join(", ") || "Chưa phân loại"
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Xem thay đổi gameplay${patchLabel ? ` tại ${patchLabel}` : ""}: ${labels}`}
          className={`group inline-flex max-w-full items-center gap-2 rounded-lg p-1 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        >
          {ordered.length ? (
            <ChangeKindBadges kinds={kinds} compact />
          ) : (
            <span className="text-xs text-muted-foreground">Chưa phân loại</span>
          )}
          {patchLabel && <span className="max-w-40 truncate text-xs text-muted-foreground">{patchLabel}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-4 p-4">
        <div>
          <h3 className="text-sm font-semibold">Thay đổi gameplay</h3>
          {patchLabel && <p className="mt-1 text-xs text-muted-foreground">{patchLabel}</p>}
        </div>
        {ordered.length ? (
          <ChangeKindBadges kinds={kinds} maxVisible={6} />
        ) : (
          <span className="text-xs text-muted-foreground">Chưa phân loại</span>
        )}
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
