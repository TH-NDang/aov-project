import { activeCatalogScope, catalogScopePatch, resolveCatalogScope } from "./catalog-scope"
import { useCatalogScopePreference } from "./catalog-scope-memory"
import { PatchDataReview } from "./patch-data-review"
import { PatchStatDefaults } from "./patch-stat-defaults"
import { SharedPatchSetup, SeasonScheduleForm, PatchReleaseForm } from "./shared-version-setup"
import { useState } from "react"
import { useSearchParams } from "react-router"
import { CatalogTimeline } from "./catalog-timeline"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Globe2,
  Layers,
  RefreshCw,
  Plus,
  Shapes,
  CalendarCog,
} from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { useIsWide } from "@/hooks/use-media-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { MarketSchedule, PatchMarketSchedule, ConfirmRelease } from "./market-schedule"
import { Button } from "@aov/ui/components/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@aov/ui/components/tabs"
import { Badge } from "@aov/ui/components/badge"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi } from "./publishing-api"
import { assignSharedRuleset, DEFAULT_RULESET_CODE } from "./default-ruleset"
import { invalidateReferenceCatalog } from "../terminology/reference-api"
import { SeasonSetup } from "./season-setup"
import { PatchSetup } from "./patch-setup"
import { PatchChangesTable } from "./patch-changes-table"
import { MarketBadge } from "./market-badge"
import {
  usePublicationOverview,
  useContentLocale,
  dateLabel,
  phaseLabels,
  type PublicationOverview,
  type Variant,
  type Season,
} from "./publication-overview"
const api = createPublishingApi(backendRequest)

export function GameConfigurationPage() {
  const overview = usePublicationOverview()
  const locale = useContentLocale()
  const [setup, setSetup] = useState<"season" | "patch" | "assignment" | null>(null)
  const [marketId, setMarketId] = useState<string | null>(null)
  const wide = useIsWide()
  const capabilities = useSession().actor?.capabilities ?? []
  const rulesets = useQuery({ queryKey: ["publishing-rulesets"], queryFn: api.rulesets, enabled: !!setup })
  const regions = useQuery({ queryKey: ["publishing-regions"], queryFn: api.regions, enabled: !!setup })
  const [params, setParams] = useSearchParams()
  const data = overview.data
  const requested = useCatalogScopePreference(data, {
    seasonId: params.get("season") ?? "",
    variantId: params.get("patch") ?? "",
  })
  const timelineScope = data ? resolveCatalogScope(data, requested) : requested
  const selectedPatch = data?.variants.find((v) => v.id === timelineScope.variantId)
  const view = params.get("tab") === "markets" ? "markets" : "versions"
  const changeView = (value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === "markets") next.set("tab", "markets")
        else next.delete("tab")
        return next
      },
      { preventScrollReset: true },
    )
  const changeScope = (next: typeof timelineScope) => {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        copy.delete("show")
        copy.delete("tab")
        for (const [key, value] of Object.entries(catalogScopePatch(next))) {
          if (value) copy.set(key, value)
          else copy.delete(key)
        }
        return copy
      },
      { replace: true, preventScrollReset: true },
    )
  }
  const queryClient = useQueryClient()
  // A new database has no ruleset; the wiki only ever needs the one default ruleset.
  async function createDefaultRuleset() {
    try {
      const created = await api.send<{ id: string }>("/admin/rulesets", "POST", {
        code: DEFAULT_RULESET_CODE,
        description: "Bộ gameplay Liên Quân dùng chung giữa các thị trường.",
      })
      // Every market shares this ruleset, so assign them all right away.
      await assignSharedRuleset(
        backendRequest,
        created.id,
        (data?.markets ?? []).map((market) => market.id),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["publishing-rulesets"] }),
        overview.refetch(),
        invalidateReferenceCatalog(queryClient),
      ])
      toast.success("Đã tạo bộ quy tắc mặc định.")
    } catch (cause) {
      toast.error(errorMessage(cause))
    }
  }
  return (
    <Page>
      <PageHeader
        title="Phiên bản và thị trường"
        actions={
          <PageActionsMenu label="Tạo và thiết lập phiên bản">
            {capabilities.includes("patch:write") && (
              <>
                <DropdownMenuItem onSelect={() => setSetup("patch")}>
                  <Plus />
                  Tạo patch
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSetup("season")}>
                  <CalendarPlus />
                  Tạo mùa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {capabilities.includes("region:admin") && data && !data.rulesets.length && (
              <>
                <DropdownMenuItem onSelect={() => void createDefaultRuleset()}>
                  <Shapes />
                  Tạo bộ quy tắc mặc định
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={() => void overview.refetch()}>
              <RefreshCw />
              Làm mới
            </DropdownMenuItem>
          </PageActionsMenu>
        }
      />
      <Sheet
        open={!!setup}
        onOpenChange={(open) => {
          if (!open) setSetup(null)
        }}
      >
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={wide ? "w-[min(760px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
        >
          <SheetHeader>
            <SheetTitle>
              {setup === "season" ? "Tạo mùa" : setup === "assignment" ? "Gán thị trường vào bộ quy tắc" : "Tạo patch"}
            </SheetTitle>
            <SheetDescription>
              {setup === "season"
                ? "Tạo mùa dùng chung; thiết lập lịch thị trường sau."
                : "Dùng chung nội dung gameplay; khai báo lịch phát hành riêng cho mỗi thị trường."}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {setup === "season" ? (
              <SeasonSetup onDone={() => setSetup(null)} />
            ) : setup === "patch" ? (
              <SharedPatchSetup onDone={() => setSetup(null)} />
            ) : (
              setup && (
                <PatchSetup key={setup} mode={setup} rulesets={rulesets.data ?? []} regions={regions.data ?? []} />
              )
            )}
            {(rulesets.error || regions.error) && <p role="alert">{errorMessage(rulesets.error || regions.error)}</p>}
          </div>
        </SheetContent>
      </Sheet>
      {overview.isPending && <p role="status">Đang tải lịch phát hành…</p>}
      {overview.error && (
        <p role="alert" className="text-destructive">
          {errorMessage(overview.error)}
        </p>
      )}
      {data && (
        <>
          <Tabs value={view} onValueChange={changeView} className="min-w-0 gap-4">
            <div className="border-b">
              <TabsList variant="line" aria-label="Quản lý phiên bản và thị trường">
                <TabsTrigger value="versions">
                  <Layers aria-hidden /> Phiên bản
                </TabsTrigger>
                <TabsTrigger value="markets">
                  <Globe2 aria-hidden /> Thị trường
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="versions" className="min-w-0 space-y-4">
              <CatalogTimeline
                data={data}
                value={timelineScope}
                onChange={changeScope}
                showCounts={false}
                currentFilter={activeCatalogScope(data)}
              />
              {selectedPatch ? (
                <PatchDetail key={selectedPatch.id} variant={selectedPatch} data={data} locale={locale} />
              ) : (
                <>
                  {!data.seasons.length && (
                    <p className="type-meta">Chưa có mùa. Bạn có thể tạo mùa trong menu đầu trang.</p>
                  )}
                  {[...data.seasons]
                    .filter((s) => !timelineScope.seasonId || s.id === timelineScope.seasonId)
                    .sort((a, b) => b.ordinal - a.ordinal)
                    .map((s) => (
                      <SeasonVersions
                        key={s.id}
                        season={s}
                        data={data}
                        locale={locale}
                        onSelect={(v) => changeScope({ seasonId: v.seasonId ?? "", variantId: v.id })}
                      />
                    ))}
                  {!timelineScope.seasonId && data.variants.some((v) => !v.seasonId) && (
                    <SeasonVersions
                      data={data}
                      locale={locale}
                      onSelect={(v) => changeScope({ seasonId: v.seasonId ?? "", variantId: v.id })}
                    />
                  )}
                </>
              )}
            </TabsContent>
            <TabsContent value="markets" className="min-w-0">
              <MarketOverview data={data} onOpenMarket={setMarketId} />
            </TabsContent>
          </Tabs>
          <MarketSchedule marketId={marketId} data={data} locale={locale} onClose={() => setMarketId(null)} />
        </>
      )}
    </Page>
  )
}
function PatchStatus({ variant, data }: { variant: Variant; data: PublicationOverview }) {
  const markets = data.markets.filter((m) =>
    data.releases.some((r) => r.id === m.currentReleaseId && r.variantId === variant.id),
  )
  return markets.length ? (
    <span
      title={markets.map((m) => m.displayName).join(", ")}
      className="type-label inline-flex shrink-0 items-center gap-1.5 text-emerald-700 dark:text-emerald-400"
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden /> Đang áp dụng
    </span>
  ) : (
    <span className="type-meta">{phaseLabels[variant.status] ?? variant.status}</span>
  )
}

function SeasonVersions({
  season,
  data,
  locale,
  onSelect,
}: {
  season?: Season
  data: PublicationOverview
  locale: string
  onSelect: (patch: Variant) => void
}) {
  const patches = data.variants
    .filter((v) => (v.seasonId ?? "") === (season?.id ?? ""))
    .sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal)
  const schedules = (data.seasonSchedules ?? []).filter((schedule) => schedule.seasonId === season?.id)
  return (
    <section className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="type-section-title">{season?.displayName ?? "Patch chưa gắn mùa"}</h2>
          <span className="type-meta">{patches.length} patch</span>
        </div>
        {season && <SeasonScheduleForm seasonId={season.id} data={data} />}
      </header>
      {schedules.length > 0 && (
        <ul aria-label="Lịch mùa" className="space-y-1.5">
          {schedules.map((schedule) => {
            const market = data.markets.find((m) => m.id === schedule.regionId)
            const start = dateLabel(schedule.startsOn ?? schedule.startsAt, locale)
            const end = schedule.endsOn ?? schedule.endsAt
            return (
              <li key={schedule.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 type-meta">
                <CalendarDays aria-hidden className="size-4" />
                <span>
                  {market?.displayName ?? "Thị trường"} · {end ? `${start} – ${dateLabel(end, locale)}` : `Từ ${start}`}
                </span>
                {schedule.phase !== "RECORDED" && <span>{phaseLabels[schedule.phase] ?? schedule.phase}</span>}
              </li>
            )
          })}
        </ul>
      )}
      <ul aria-label="Các patch trong mùa" className="divide-y border-y">
        {patches.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              aria-label={`Mở patch ${v.patchCode}`}
              onClick={() => onSelect(v)}
              className="flex min-h-12 w-full items-center gap-3 rounded-sm px-2 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="type-body block break-words">{v.patchCode}</span>
                {data.rulesets.length > 1 && (
                  <span className="type-meta">{data.rulesets.find((r) => r.id === v.rulesetId)?.code}</span>
                )}
              </span>
              {v.dataReviewState === "COMPLETE" && <span className="type-meta">Đã kiểm tra</span>}
              <PatchStatus variant={v} data={data} />
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      {!patches.length && <p className="type-meta">Chưa có patch trong mùa này.</p>}
    </section>
  )
}

/** Markets that publish the wiki, grouped by ruleset only when more than one ruleset exists. */
function MarketOverview({ data, onOpenMarket }: { data: PublicationOverview; onOpenMarket: (id: string) => void }) {
  const grouped = data.rulesets.length > 1
  const groups = [...data.rulesets, { id: "", code: "Chưa gán bộ quy tắc", description: null }]
    .map((rule) => ({
      rule,
      markets: data.markets.filter((m) => m.available && (m.currentRulesetId ?? "") === rule.id),
    }))
    .filter((group) => group.markets.length || (grouped && group.rule.id))
  const unsupported = data.markets.filter((m) => !m.available)
  const row = (m: PublicationOverview["markets"][number]) => {
    const season = data.seasons.find((s) => s.id === m.currentSeasonId)
    const release = data.releases.find((r) => r.id === m.currentReleaseId)
    const pending = data.releases.find((r) => r.regionId === m.id && r.phase === "AWAITING_CONFIRMATION")
    const variant = data.variants.find((v) => v.id === release?.variantId)
    return (
      <li
        key={m.id}
        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 @xl/markets:grid-cols-[minmax(8rem,1fr)_minmax(12rem,1.5fr)_auto]"
      >
        <MarketBadge code={m.code} name={m.displayName} showName />
        <dl className="col-span-2 row-start-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 @xl/markets:col-span-1 @xl/markets:col-start-2 @xl/markets:row-start-1">
          <div className="flex items-baseline gap-1.5">
            <dt className="type-meta">Mùa</dt>
            <dd className="type-body">{season?.displayName ?? "Chưa có"}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="type-meta">Patch</dt>
            <dd className="type-body break-all">{variant?.patchCode ?? "Chưa xác nhận"}</dd>
          </div>
        </dl>
        <Button
          variant="outline"
          size="sm"
          className="col-start-2 row-start-1 justify-self-end @xl/markets:col-start-3"
          aria-label={`Quản lý mùa và patch của ${m.displayName}`}
          onClick={() => onOpenMarket(m.id)}
        >
          <CalendarCog aria-hidden className="size-4" /> Quản lý lịch
        </Button>
        {pending && (
          <div className="col-span-full flex flex-wrap items-center gap-2 type-meta">
            Chờ xác nhận {data.variants.find((v) => v.id === pending.variantId)?.patchCode}
            <ConfirmRelease id={pending.id} />
          </div>
        )}
      </li>
    )
  }
  return (
    <section className="@container/markets min-w-0 space-y-4" aria-label="Thị trường">
      <h2 className="type-section-title">Phiên bản đang áp dụng</h2>
      {groups.map(({ rule, markets }) => (
        <div key={rule.id || "none"}>
          {grouped && <h3 className="type-label text-muted-foreground">{rule.code}</h3>}
          {markets.length ? (
            <ul className="divide-y border-y">{markets.map(row)}</ul>
          ) : (
            <p className="py-3 type-meta">Chưa có thị trường áp dụng.</p>
          )}
        </div>
      ))}
      {!groups.length && <p className="type-meta">Chưa có thị trường đang phát hành.</p>}
      {unsupported.length > 0 && (
        <details className="group/unsupported">
          <summary className="type-label inline-flex cursor-pointer list-none items-center gap-2 rounded-sm py-2 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <ChevronRight aria-hidden className="size-4 group-open/unsupported:rotate-90" />
            Thị trường chưa hỗ trợ ({unsupported.length})
          </summary>
          <ul className="flex flex-wrap gap-2 py-2">
            {unsupported.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOpenMarket(m.id)}
                  aria-label={`Mở ${m.displayName}`}
                  className="inline-flex min-h-9 items-center rounded-md px-1.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <MarketBadge code={m.code} name={m.displayName} showName />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function PatchDetail({ variant, data, locale }: { variant: Variant; data: PublicationOverview; locale: string }) {
  const [section, setSection] = useState<"changes" | "schedule" | "review" | "stats">("changes")
  const season = data.seasons.find((s) => s.id === variant.seasonId)
  const rule = data.rulesets.length > 1 && data.rulesets.find((r) => r.id === variant.rulesetId)
  return (
    <section className="min-w-0 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="type-meta">
            {[season?.displayName ?? "Chưa gắn mùa", rule && rule.code].filter(Boolean).join(" · ")}
          </p>
          <h2 className="type-section-title break-words">{variant.patchCode}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PatchStatus variant={variant} data={data} />
          {variant.dataReviewState === "COMPLETE" && <Badge variant="secondary">Đã hoàn tất nhập liệu</Badge>}
          {variant.status === "DRAFT" && <PatchReleaseForm variant={variant} data={data} />}
        </div>
      </header>
      <div role="group" aria-label="Phần của patch" className="flex flex-wrap items-center gap-1">
        {(
          [
            ["changes", "Thay đổi"],
            ["stats", "Thuộc tính mặc định"],
            ["schedule", "Lịch phát hành"],
            ["review", "Kiểm tra dữ liệu"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={section === key ? "secondary" : "ghost"}
            aria-pressed={section === key}
            onClick={() => setSection(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {section === "changes" && <PatchChangesTable variantId={variant.id} overview={data} locale={locale} />}
      {section === "stats" && <PatchStatDefaults variant={variant} />}
      {section === "schedule" && (
        <div className="space-y-2 border-t pt-3">
          {variant.status === "PUBLISHED" && <PatchReleaseForm variant={variant} data={data} />}
          <PatchMarketSchedule variantId={variant.id} data={data} locale={locale} />
        </div>
      )}
      {section === "review" && <PatchDataReview variant={variant} />}
    </section>
  )
}
