import { useQuery } from "@tanstack/react-query"
import {
  Check,
  Copy,
  ArrowDown,
  ArrowUp,
  Database,
  FilePenLine,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
  Wrench,
} from "lucide-react"
import { backendRequest } from "@/app/auth/session"
import { cn } from "@aov/ui/lib/utils"
import { changeTone, useChangeColors } from "../publishing/change-color-preferences"
import type { CatalogFilter } from "../publishing/catalog-context"
import type { PublicationOverview } from "../publishing/publication-overview"
import type { TimelineCount } from "../publishing/catalog-timeline"
import type { WarehouseKind } from "./warehouse-types"

export const catalogChangeKinds = {
  DATA_BASELINE: { label: "Dữ liệu nền", icon: Database },
  ADDED: { label: "Thêm mới", icon: Plus },
  UPDATED: { label: "Chỉnh sửa", icon: FilePenLine },
  REMOVED: { label: "Loại bỏ", icon: Trash2 },
  BUFF: { label: "Tăng sức mạnh", icon: ArrowUp },
  NERF: { label: "Giảm sức mạnh", icon: ArrowDown },
  BALANCE: { label: "Cân bằng", icon: Scale },
  REWORK: { label: "Làm lại", icon: RefreshCw },
  FIX: { label: "Sửa lỗi", icon: Wrench },
} as const
export type CatalogChangeKind = keyof typeof catalogChangeKinds
export type CatalogBadgeKind = CatalogChangeKind | "UNCHANGED" | "INHERITED"
export interface CatalogChange {
  id: string
  domain: string
  ownerId: string
  code: string
  name: string
  iconAssetId: string | null
  rulesetId: string
  patchVariantId: string
  fromRevisionId: string | null
  toRevisionId: string
  kinds: CatalogChangeKind[]
  summary: string | null
  actualLocale: string | null
  sourceUrl: string | null
  confirmed: boolean
  recordedAt: string
}
export const changeDomain: Record<WarehouseKind, string> = {
  items: "ITEM",
  arcana: "ARCANA",
  spells: "SPELL",
  enchantments: "ENCHANTMENT",
}
export function useCatalogChanges(kind: WarehouseKind, rulesetId: string, locale: string) {
  return useQuery({
    queryKey: ["warehouse", "changes", kind, rulesetId, locale],
    queryFn: ({ signal }) =>
      backendRequest<CatalogChange[]>(
        `/admin/catalog-changes?${new URLSearchParams({ domain: changeDomain[kind], rulesetId, locale })}`,
        { signal },
      ),
    enabled: !!rulesetId,
    staleTime: 60000,
  })
}
export function scopedChanges(changes: CatalogChange[], data: PublicationOverview | undefined, scope: CatalogFilter) {
  const variants = new Set(
    data?.variants
      .filter(
        (v) => (!scope.seasonId || v.seasonId === scope.seasonId) && (!scope.variantId || v.id === scope.variantId),
      )
      .map((v) => v.id) ?? [],
  )
  return changes.filter((c) => variants.has(c.patchVariantId))
}
export function changeCounts(changes: CatalogChange[]) {
  const result = new Map<string, TimelineCount>()
  const seen = new Set<string>()
  for (const change of changes) {
    const key = `${change.patchVariantId}/${change.ownerId}`
    if (seen.has(key)) continue
    seen.add(key)
    const count = result.get(change.patchVariantId) ?? { changes: 0, baseline: 0 }
    if (change.kinds.includes("DATA_BASELINE")) count.baseline++
    else count.changes++
    result.set(change.patchVariantId, count)
  }
  return result
}
export function CatalogChangeBadges({
  kinds,
  compact = false,
}: {
  kinds: readonly CatalogBadgeKind[]
  compact?: boolean
}) {
  const { colors } = useChangeColors()
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {[...new Set(kinds)].map((kind) => {
        const config =
          kind === "UNCHANGED"
            ? { label: "Không thay đổi", icon: Check }
            : kind === "INHERITED"
              ? { label: "Kế thừa", icon: Copy }
              : catalogChangeKinds[kind]
        if (!config) return null
        const Icon = config.icon
        const tone =
          kind === "BUFF" || kind === "NERF"
            ? changeTone(kind, colors)
            : kind === "INHERITED" || kind === "UNCHANGED"
              ? "border-transparent bg-muted/30 text-muted-foreground"
              : kind === "ADDED"
                ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : "border-border bg-muted/40 text-foreground"
        return (
          <span
            key={kind}
            title={
              kind === "INHERITED"
                ? "Kế thừa dữ liệu trước đó; patch chưa được xác nhận rà soát hoàn tất."
                : config.label
            }
            data-catalog-change={kind}
            className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4", tone)}
          >
            <Icon className="size-3" aria-hidden />
            <span className={compact ? "sr-only" : ""}>{config.label}</span>
          </span>
        )
      })}
    </span>
  )
}
