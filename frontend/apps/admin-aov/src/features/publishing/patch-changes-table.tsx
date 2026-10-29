import { HeroCatalog } from "./hero-catalog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@aov/ui/components/tabs"
import { WarehousePatchChanges } from "../warehouse/warehouse-patch-changes"
import { HeroOverallAssessment } from "./hero-overall-assessment"
import { useMemo, useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { ArrowUpRight, FilePlus2, Pin } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import { MarketBadge } from "./market-badge"
import { AovNavIcon } from "@/app/aov-nav-icon"
import { HeroAsset } from "./hero-content"
import { changeDomain, type CatalogChange } from "../warehouse/catalog-changes"
import { dateLabel, phaseLabels, type PublicationOverview } from "./publication-overview"
import { ChangeLines, KindBadge, SourceBadge, type RecordedChangeSet } from "./patch-change-lines"
import { RecordPatchNotesSheet, useHeroEntries } from "./patch-notes-sheet"

type ChangeSet = RecordedChangeSet
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
type HeroEntry = ReturnType<typeof useHeroEntries>[number]
function PatchHeroIdentity({ change, hero, onOpen }: { change: ChangeSet; hero?: HeroEntry; onOpen: () => void }) {
  const name = hero?.name ?? change.heroCode
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Xem thay đổi ${name}`}
      className="group flex w-full min-w-44 items-center gap-2.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
    >
      <HeroAsset id={hero?.iconAssetId} alt={name} className="size-9 shrink-0 rounded-lg" frameAspectRatio={1} />
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
  const heroes = useHeroEntries(locale)
  const heroById = useMemo(() => new Map(heroes.map((hero) => [hero.id, hero])), [heroes])
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
            <PatchHeroIdentity
              change={row.original}
              hero={heroById.get(row.original.heroId)}
              onOpen={() => setSelected(row.original)}
            />
          ),
        }),
        helper.display({
          id: "kind",
          header: "Tính chất",
          cell: ({ row }) => (
            <div className="flex max-w-56 flex-wrap gap-1">
              {row.original.overallKind && <KindBadge kind={row.original.overallKind} className="font-medium" />}
              {[...new Set(row.original.changes.map((c) => c.changeKind))]
                .filter((kind) => kind !== row.original.overallKind)
                .map((kind) => (
                  <KindBadge key={kind} kind={kind} />
                ))}
            </div>
          ),
        }),
        helper.display({
          id: "summary",
          header: "Nội dung",
          cell: ({ row }) => (
            <div className="space-y-1">
              <p className="line-clamp-2 max-w-lg whitespace-pre-wrap">
                {row.original.summary || `${row.original.changes.length} mục thay đổi`}
              </p>
              <SourceBadge change={row.original} />
              {row.original.actualLocale && row.original.actualLocale !== locale && (
                <span className="block text-xs text-muted-foreground">
                  Ngôn ngữ dự phòng: {row.original.actualLocale}
                </span>
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
    [overview, variantId, locale, heroById],
  )
  const table = useTable({ features, columns, data: query.data ?? empty, getRowId: (row) => row.id })
  const detailHero = detail ? heroById.get(detail.heroId) : undefined
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
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                {table.getHeaderGroups()[0]?.headers.map((h) => (
                  <th
                    key={h.id}
                    className={`px-3 py-2 text-left font-medium ${h.column.id === "heroCode" ? "sticky left-0 z-10 min-w-40 bg-muted" : ""}`}
                  >
                    <table.FlexRender header={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t align-top hover:bg-muted/20">
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-3 py-2 ${cell.column.id === "heroCode" ? "sticky left-0 z-10 border-r bg-card" : ""}`}
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
            <SheetTitle className="flex items-center gap-2">
              <HeroAsset id={detailHero?.iconAssetId} alt="" className="size-8 rounded-md" frameAspectRatio={1} />
              {detailHero?.name ?? detail?.heroCode}
            </SheetTitle>
            <SheetDescription>{detail?.summary || "Chi tiết thay đổi gameplay đã ghi nhận"}</SheetDescription>
            {detail && <SourceBadge change={detail} />}
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-6">
            {detail && <HeroOverallAssessment key={`${detail.id}-${detail.assessmentVersion}`} change={detail} />}
            {detail && <ChangeLines changes={detail.changes} locale={locale} />}
            {detail && (
              <Button asChild variant="outline">
                <Link
                  to={
                    detail.toHeroRevisionId
                      ? `/hero/${detail.heroId}?revision=${detail.toHeroRevisionId}`
                      : `/hero/${detail.heroId}?view=patch&atPatch=${variantId}`
                  }
                >
                  {detail.toHeroRevisionId ? "Mở bản tướng" : "Xem dữ liệu tướng tại patch"}
                  <ArrowUpRight className="size-4" />
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
  const [recording, setRecording] = useState(false)
  const canRecord = useSession().actor?.capabilities.includes("patch:write") ?? false
  const variant = overview.variants.find((v) => v.id === variantId)
  const rulesetId = variant?.rulesetId ?? ""
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
  const sourceUrl = overview.releases.find((release) => release.variantId === variantId && release.sourceUrl)?.sourceUrl
  const recordedHeroIds = useMemo(() => new Set(heroes.data?.map((row) => row.heroId) ?? []), [heroes.data])

  let body
  if (heroes.isPending || (!!rulesetId && warehouses.some((query) => query.isPending)))
    body = (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        Đang kiểm tra các nhóm thay đổi…
      </p>
    )
  else if (!available.length && !errors.length)
    body = <p className="p-4 text-sm text-muted-foreground">Chưa ghi nhận thay đổi trong patch này.</p>
  else {
    const warning = errors.length > 0 && (
      <div role="alert" className="flex flex-wrap items-center gap-2 p-4 text-sm text-destructive">
        Chưa tải được thay đổi của một số nhóm.
        <Button size="sm" variant="outline" onClick={() => errors.forEach((query) => void query.refetch())}>
          Thử lại
        </Button>
      </div>
    )
    body = !domain ? (
      warning
    ) : (
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

  return (
    <section className="min-w-0 border-t" aria-label="Thay đổi trong patch">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <h4 className="text-sm font-semibold">Thay đổi trong patch</h4>
        {canRecord && variant && (
          <Button size="sm" variant="outline" onClick={() => setRecording(true)}>
            <FilePlus2 className="size-4" />
            Ghi từ ghi chú cập nhật
          </Button>
        )}
      </div>
      {body}
      {canRecord && variant && (
        <RecordPatchNotesSheet
          open={recording}
          onOpenChange={setRecording}
          variantId={variantId}
          patchLabel={variant.patchCode}
          rulesetId={rulesetId}
          locale={locale}
          defaultSourceUrl={sourceUrl ?? ""}
          recordedHeroIds={recordedHeroIds}
        />
      )}
    </section>
  )
}
