import { HeroCatalog } from "./hero-catalog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@aov/ui/components/tabs"
import { WarehousePatchChanges } from "../warehouse/warehouse-patch-changes"
import { HeroOverallAssessment } from "./hero-overall-assessment"
import { useMemo, useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { ArrowUpRight, Pin } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { backendRequest } from "@/app/auth/session"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import { MarketBadge } from "./market-badge"
import { AovNavIcon } from "@/app/aov-nav-icon"
import { createPublishingApi, heroPreviewKey } from "./publishing-api"
import { HeroAsset, localized } from "./hero-content"
import { changeDomain, type CatalogChange } from "../warehouse/catalog-changes"
import { dateLabel, phaseLabels, type PublicationOverview } from "./publication-overview"
interface Change {
  id: string
  type: string
  changeKind: string
  [key: string]: unknown
}
interface ChangeSet {
  id: string
  overallKind?: string | null
  assessmentVersion?: number
  heroId: string
  heroCode: string
  toHeroRevisionId: string
  summary?: string
  actualLocale?: string
  changes: Change[]
}
const api = createPublishingApi(backendRequest)
const warehouseDomains = ["items", "enchantments", "arcana", "spells"] as const
const changeDomains = [
  { id: "heroes", label: "Tướng" },
  { id: "items", label: "Trang bị" },
  { id: "enchantments", label: "Phù hiệu" },
  { id: "arcana", label: "Ngọc" },
  { id: "spells", label: "Phụ trợ" },
] as const
function heroChangesOptions(variantId: string, locale: string) {
  return {
    queryKey: ["patch-changes", variantId, locale],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      backendRequest<ChangeSet[]>(
        `/admin/patch-variants/${variantId}/hero-changes?locale=${encodeURIComponent(locale)}`,
        { signal },
      ),
    staleTime: 60000,
  }
}
function PatchHeroIdentity({ change, locale, onOpen }: { change: ChangeSet; locale: string; onOpen: () => void }) {
  const preview = useQuery({
    queryKey: heroPreviewKey(change.heroId, change.toHeroRevisionId),
    queryFn: () => api.read(change.heroId, change.toHeroRevisionId),
    enabled: !!change.toHeroRevisionId,
    staleTime: 60000,
  })
  const name = localized(preview.data?.content.PROFILE?.translations, locale)?.name || change.heroCode
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Xem thay đổi ${change.heroCode}`}
      className="group flex w-full min-w-48 items-center gap-2.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
    >
      <HeroAsset
        id={preview.data?.content.MEDIA_BINDINGS?.bindings.HEAD}
        alt={name}
        className="size-10 shrink-0 rounded-lg"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{name}</span>
        <span className="block font-mono text-xs text-muted-foreground">{change.heroCode}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  )
}
const empty: ChangeSet[] = []
const features = tableFeatures({})
const helper = createColumnHelper<typeof features, ChangeSet>()
const kinds: Record<string, string> = {
  BUFF: "Tăng sức mạnh",
  NERF: "Giảm sức mạnh",
  ADJUST: "Điều chỉnh",
  ADJUSTMENT: "Điều chỉnh",
  REWORK: "Làm lại",
  FIX: "Sửa lỗi",
  BUG_FIX: "Sửa lỗi",
  ADD: "Bổ sung",
  REMOVE: "Loại bỏ",
  OTHER: "Khác",
}
const fields: Record<string, string> = {
  statKey: "Chỉ số",
  skillKey: "Kỹ năng",
  fieldKey: "Trường",
  oldValue: "Trước",
  newValue: "Sau",
  description: "Nội dung",
  roleCode: "Vai trò",
  added: "Bổ sung",
  mechanicKey: "Cơ chế",
  mediaRole: "Loại ảnh",
  oldAssetId: "Ảnh trước",
  newAssetId: "Ảnh sau",
  unit: "Đơn vị",
}
function HeroPatchChangesTable({
  variantId,
  overview,
  locale,
}: {
  variantId: string
  overview: PublicationOverview
  locale: string
}) {
  const [selected, setSelected] = useState<ChangeSet | null>(null)
  const wide = useIsWide()
  const query = useQuery(heroChangesOptions(variantId, locale))
  const detail = query.data?.find((row) => row.id === selected?.id) ?? selected
  const markets = overview.releases.filter(
    (r) => r.variantId === variantId && (r.status === "SCHEDULED" || r.phase === "AWAITING_CONFIRMATION"),
  )
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("heroCode", {
          header: () => (
            <span className="flex items-center gap-2">
              <Pin className="size-3.5" />
              Tướng
            </span>
          ),
          cell: ({ row }) => (
            <PatchHeroIdentity change={row.original} locale={locale} onOpen={() => setSelected(row.original)} />
          ),
        }),
        helper.display({ id: "domain", header: "Loại", cell: () => "Tướng" }),
        helper.display({
          id: "overall",
          header: "Tổng thể tướng",
          cell: ({ row }) =>
            row.original.overallKind ? (kinds[row.original.overallKind] ?? row.original.overallKind) : "Chưa đánh giá",
        }),
        helper.display({
          id: "kind",
          header: "Chi tiết kỹ năng/chỉ số",
          cell: ({ row }) =>
            [...new Set(row.original.changes.map((c) => kinds[c.changeKind] ?? c.changeKind))].join(", "),
        }),
        helper.display({
          id: "summary",
          header: "Nội dung",
          cell: ({ row }) => (
            <div>
              <p className="max-w-lg whitespace-pre-wrap">
                {row.original.summary || `${row.original.changes.length} mục thay đổi`}
              </p>
              {row.original.actualLocale && row.original.actualLocale !== locale && (
                <span className="text-xs text-muted-foreground">Ngôn ngữ dự phòng: {row.original.actualLocale}</span>
              )}
            </div>
          ),
        }),
        helper.display({
          id: "markets",
          header: "Thị trường",
          cell: () => (
            <div className="flex flex-wrap gap-1">
              {markets.map((r) => {
                const m = overview.markets.find((m) => m.id === r.regionId)
                if (!m) return null
                return (
                  <MarketBadge
                    key={r.id}
                    code={m.code}
                    name={m.displayName}
                    detail={`${phaseLabels[r.phase]} · ${dateLabel(r.effectiveOn ?? r.effectiveAt, locale)}`}
                  />
                )
              })}
            </div>
          ),
        }),
      ]),
    [overview, variantId, locale],
  )
  const table = useTable({ features, columns, data: query.data ?? empty, getRowId: (row) => row.id })
  return (
    <div className="space-y-3">
      {query.isPending ? (
        <p role="status" className="p-4 text-sm">
          Đang tải thay đổi…
        </p>
      ) : query.error ? (
        <div role="alert" className="p-4 text-sm text-destructive">
          {errorMessage(query.error)}{" "}
          <Button variant="ghost" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !query.data?.length ? (
        <p className="p-4 text-sm text-muted-foreground">
          Chưa ghi nhận thay đổi tướng. Dữ liệu nền được import không tự tạo lịch sử thay đổi.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted">
              <tr>
                {table.getHeaderGroups()[0]?.headers.map((h) => (
                  <th
                    key={h.id}
                    className={`px-4 py-3 text-left ${h.column.id === "heroCode" ? "sticky left-0 z-10 min-w-40 bg-muted" : ""}`}
                  >
                    <table.FlexRender header={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t">
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-4 py-3 ${cell.column.id === "heroCode" ? "sticky left-0 z-10 border-r bg-card" : ""}`}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={wide ? "w-[560px] sm:max-w-[560px]" : "max-h-[85dvh] rounded-t-2xl"}
        >
          <SheetHeader>
            <SheetTitle>{detail?.heroCode}</SheetTitle>
            <SheetDescription>{detail?.summary || "Chi tiết thay đổi gameplay đã ghi nhận"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-6">
            {detail && <HeroOverallAssessment key={`${detail.id}-${detail.assessmentVersion}`} change={detail} />}
            {detail?.changes.map((c) => (
              <div key={c.id} className="space-y-2 rounded-lg border p-4">
                <h3 className="font-medium">{kinds[c.changeKind] ?? c.changeKind}</h3>
                <dl className="space-y-2 text-sm">
                  {Object.entries(fields)
                    .filter(([key]) => c[key] !== undefined && c[key] !== null)
                    .map(([key, label]) => (
                      <div key={key}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="whitespace-pre-wrap break-words">{String(c[key])}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            ))}
            {detail && (
              <Button asChild>
                <Link to={`/hero/${detail.heroId}?revision=${detail.toHeroRevisionId}`}>
                  Mở bản tướng <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function PatchChangesTable({
  variantId,
  overview,
  locale,
}: {
  variantId: string
  overview: PublicationOverview
  locale: string
}) {
  const [params, setParams] = useSearchParams()
  const rulesetId = overview.variants.find((v) => v.id === variantId)?.rulesetId ?? ""
  const heroes = useQuery(heroChangesOptions(variantId, locale))
  const warehouses = useQueries({
    queries: warehouseDomains.map((kind) => ({
      queryKey: ["warehouse", "changes", kind, rulesetId, locale],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        backendRequest<CatalogChange[]>(
          `/admin/catalog-changes?${new URLSearchParams({ domain: changeDomain[kind], rulesetId, locale })}`,
          { signal },
        ),
      enabled: !!rulesetId,
      staleTime: 60000,
    })),
  })
  const counts = new Map<string, number>([["heroes", new Set(heroes.data?.map((row) => row.heroId) ?? []).size]])
  warehouses.forEach((query, index) => {
    counts.set(
      warehouseDomains[index],
      new Set(query.data?.filter((row) => row.patchVariantId === variantId).map((row) => row.ownerId) ?? []).size,
    )
  })
  const available = changeDomains.filter((entry) => (counts.get(entry.id) ?? 0) > 0)
  const domain = available.find((entry) => entry.id === params.get("domain"))?.id ?? available[0]?.id
  const queries = [heroes, ...warehouses]
  const errors = queries.filter((query) => query.isError)
  if (heroes.isPending || (!!rulesetId && warehouses.some((query) => query.isPending)))
    return (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        Đang kiểm tra các nhóm thay đổi…
      </p>
    )
  if (!available.length && !errors.length)
    return <p className="p-4 text-sm text-muted-foreground">Chưa ghi nhận thay đổi trong patch này.</p>
  const warning = errors.length > 0 && (
    <div role="alert" className="flex flex-wrap items-center gap-2 p-4 text-sm text-destructive">
      Chưa tải được thay đổi của một số nhóm.
      <Button size="sm" variant="outline" onClick={() => errors.forEach((query) => void query.refetch())}>
        Thử lại
      </Button>
    </div>
  )
  if (!domain) return warning
  return (
    <Tabs
      value={domain}
      onValueChange={(value) =>
        setParams(
          (current) => {
            const next = new URLSearchParams(current)
            if (value === "heroes") next.delete("domain")
            else next.set("domain", value)
            return next
          },
          { replace: true, preventScrollReset: true },
        )
      }
      className="min-w-0"
    >
      {warning}
      <TabsList className="flex h-auto flex-wrap justify-start" aria-label="Nhóm có thay đổi">
        {available.map((entry) => (
          <TabsTrigger key={entry.id} value={entry.id} className="gap-2">
            <AovNavIcon name={entry.id} className="size-4" />
            {entry.label}
            <span className="text-xs tabular-nums text-muted-foreground">{counts.get(entry.id)}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="heroes">
        {params.get("show") === "all" ? (
          <HeroCatalog ruleset={rulesetId} locale={locale} overview={overview} filter={{ seasonId: "", variantId }} />
        ) : (
          <HeroPatchChangesTable variantId={variantId} overview={overview} locale={locale} />
        )}
      </TabsContent>
      {warehouseDomains
        .filter((kind) => available.some((entry) => entry.id === kind))
        .map((kind) => (
          <TabsContent key={kind} value={kind}>
            <WarehousePatchChanges kind={kind} rulesetId={rulesetId} variantId={variantId} locale={locale} />
          </TabsContent>
        ))}
    </Tabs>
  )
}
