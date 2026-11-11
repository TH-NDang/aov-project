import { activeCatalogScope, catalogScopePatch, resolveCatalogScope } from "./catalog-scope"
import { useCatalogScopePreference } from "./catalog-scope-memory"
import { PatchDataReview } from "./patch-data-review"
import { PatchStatDefaults } from "./patch-stat-defaults"
import { SharedPatchSetup, PatchReleaseForm } from "./shared-version-setup"
import { useState } from "react"
import { useSearchParams } from "react-router"
import { CatalogTimeline } from "./catalog-timeline"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarPlus, ChevronRight, Globe2, Layers, RefreshCw, Plus, Shapes, CalendarCog } from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { useIsWide } from "@/hooks/use-media-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { MarketSchedule, PatchMarketSchedule, ConfirmRelease, type MarketMode } from "./market-schedule"
import { Button } from "@aov/ui/components/button"
import { Tabs, TabsTrigger, TabsContent } from "@aov/ui/components/tabs"
import { ScrollableTabsList } from "@/components/scrollable-tabs-list"
import { ActionStrip } from "@/components/action-strip"
import { Badge } from "@aov/ui/components/badge"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi } from "./publishing-api"
import { assignSharedRuleset, DEFAULT_RULESET_CODE } from "./default-ruleset"
import { invalidateReferenceCatalog } from "../terminology/reference-api"
import { SeasonSetup } from "./season-setup"
import { CreateRegion } from "./context-setup"
import { VersionMarketCoverage } from "./version-market-coverage"
import { PatchChangesTable } from "./patch-changes-table"
import { PatchTitle } from "./patch-title"
import { MarketBadge } from "./market-badge"
import {
  usePublicationOverview,
  useContentLocale,
  phaseLabels,
  type PublicationOverview,
  type Variant,
  type Season,
} from "./publication-overview"
const api = createPublishingApi(backendRequest)

export function GameConfigurationPage() {
  const overview = usePublicationOverview()
  const locale = useContentLocale()
  const [setup, setSetup] = useState<"season" | "patch" | "region" | null>(null)
  const [marketEditor, setMarketEditor] = useState<{ id: string; mode: MarketMode } | null>(null)
  const wide = useIsWide()
  const capabilities = useSession().actor?.capabilities ?? []
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
              {setup === "season" ? "Tạo mùa" : setup === "region" ? "Thêm thị trường" : "Tạo patch"}
            </SheetTitle>
            <SheetDescription>
              {setup === "region"
                ? "Tạo thị trường để bắt đầu ghi lịch mùa và patch."
                : setup === "season"
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
              setup === "region" && (
                <CreateRegion
                  onDone={async (id) => {
                    setSetup(null)
                    await Promise.all([
                      overview.refetch(),
                      queryClient.invalidateQueries({ queryKey: ["publishing-regions"] }),
                      queryClient.invalidateQueries({ queryKey: ["regions"] }),
                      queryClient.invalidateQueries({ queryKey: ["authoring-contexts"] }),
                    ])
                    setMarketEditor({ id, mode: "season" })
                  }}
                />
              )
            )}
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
            <ScrollableTabsList
              activeValue={view}
              variant="line"
              className="w-fit"
              aria-label="Quản lý phiên bản và thị trường"
            >
              <TabsTrigger value="versions">
                <Layers aria-hidden /> Phiên bản
              </TabsTrigger>
              <TabsTrigger value="markets">
                <Globe2 aria-hidden /> Thị trường
              </TabsTrigger>
            </ScrollableTabsList>
            <CatalogTimeline
              data={data}
              value={timelineScope}
              onChange={changeScope}
              showCounts={false}
              currentFilter={activeCatalogScope(data)}
            />
            <TabsContent value="versions" className="min-w-0 space-y-4">
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
              <MarketOverview
                data={data}
                seasonId={timelineScope.seasonId}
                variantId={timelineScope.variantId}
                onOpenMarket={(id, mode) => setMarketEditor({ id, mode })}
                onCreate={capabilities.includes("region:admin") ? () => setSetup("region") : undefined}
              />
            </TabsContent>
          </Tabs>
          <MarketSchedule
            marketId={marketEditor?.id ?? null}
            initialMode={marketEditor?.mode}
            suggestedSeason={data.seasons.find((s) => s.id === timelineScope.seasonId)}
            suggestedPatch={selectedPatch}
            data={data}
            locale={locale}
            onClose={() => setMarketEditor(null)}
          />
        </>
      )}
    </Page>
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
  return (
    <section className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="type-section-title">{season?.displayName ?? "Patch chưa gắn mùa"}</h2>
          <span className="type-meta">{patches.length} patch</span>
        </div>
      </header>
      {season && <VersionMarketCoverage data={data} scope={{ seasonId: season.id }} locale={locale} />}
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
                {v.patchTitle && <span className="type-meta block break-words">{v.patchTitle}</span>}
                <VersionMarketCoverage data={data} scope={{ variantId: v.id }} locale={locale} compact />
                {data.rulesets.length > 1 && (
                  <span className="type-meta">{data.rulesets.find((r) => r.id === v.rulesetId)?.code}</span>
                )}
              </span>
              {v.dataReviewState === "COMPLETE" && <span className="type-meta">Đã kiểm tra</span>}
              <span className="type-meta">{phaseLabels[v.status] ?? v.status}</span>
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
function MarketOverview({
  data,
  onOpenMarket,
  onCreate,
  seasonId,
  variantId,
}: {
  data: PublicationOverview
  onOpenMarket: (id: string, mode: MarketMode) => void
  onCreate?: () => void
  seasonId: string
  variantId: string
}) {
  const capabilities = useSession().actor?.capabilities ?? []
  const grouped = data.rulesets.length > 1
  const groups = [...data.rulesets, { id: "", code: "Chưa gán bộ quy tắc", description: null }]
    .map((rule) => ({
      rule,
      markets: data.markets.filter((m) => (m.currentRulesetId ?? "") === rule.id),
    }))
    .filter((group) => group.markets.length || (grouped && group.rule.id))
  const row = (m: PublicationOverview["markets"][number]) => {
    const season = data.seasons.find((s) => s.id === m.currentSeasonId)
    const release = data.releases.find((r) => r.id === m.currentReleaseId)
    const pending = data.releases.find(
      (r) =>
        r.regionId === m.id &&
        r.phase === "AWAITING_CONFIRMATION" &&
        data.variants.some((v) => v.id === r.variantId && v.rulesetId === m.currentRulesetId),
    )
    const patchRecord = data.releases.find((r) => r.regionId === m.id && r.variantId === variantId)
    const variant = data.variants.find((v) => v.id === release?.variantId)
    return (
      <li
        key={m.id}
        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 @xl/markets:grid-cols-[minmax(8rem,1fr)_minmax(12rem,1.5fr)_auto]"
      >
        <div className="flex flex-col items-start gap-1">
          <MarketBadge code={m.code} name={m.displayName} showName />
          {!m.available && <span className="type-meta">Chưa mở trên Wiki</span>}
        </div>
        <dl className="col-span-2 row-start-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 @xl/markets:col-span-1 @xl/markets:col-start-2 @xl/markets:row-start-1">
          <div className="flex items-baseline gap-1.5">
            <dt className="type-meta">Mùa hiện tại</dt>
            <dd className="type-body">{season?.displayName ?? "—"}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="type-meta">Patch hiện tại</dt>
            <dd className="type-body break-all">{variant?.patchCode ?? "—"}</dd>
          </div>
        </dl>
        <ActionStrip
          aria-label={`Phiên bản cho ${m.displayName}`}
          className="col-span-full @xl/markets:col-span-1 @xl/markets:col-start-3 @xl/markets:row-start-1 @xl/markets:justify-self-end"
        >
          {(["season", "patch"] as const).map((mode) => {
            const isSeason = mode === "season"
            const Icon = isSeason ? CalendarCog : Layers
            const action = capabilities.includes(isSeason ? "patch:write" : "patch:publish")
              ? m.available
                ? "Gán"
                : "Ghi lịch"
              : "Xem"
            const label = `${action} ${isSeason ? "mùa" : "patch"}`
            const selected = isSeason ? seasonId : variantId
            const recorded = isSeason
              ? data.seasonSchedules?.some((s) => s.seasonId === selected && s.regionId === m.id)
              : !!patchRecord
            return (
              <div key={mode} className="grid justify-items-start gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`${label} cho ${m.displayName}`}
                  aria-haspopup="dialog"
                  onClick={() => onOpenMarket(m.id, mode)}
                >
                  <Icon aria-hidden className="size-4" /> {label}
                </Button>
                {selected && (
                  <span className="type-meta pl-1">
                    {!isSeason && patchRecord?.status === "CANCELLED"
                      ? "Lịch đã hủy"
                      : recorded
                        ? "Đã ghi lịch"
                        : "Chưa ghi lịch"}
                  </span>
                )}
              </div>
            )
          })}
        </ActionStrip>
        {pending && m.available && (
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
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-section-title">Mùa và patch theo thị trường</h2>
        {onCreate && (
          <Button size="sm" variant="outline" onClick={onCreate}>
            <Plus aria-hidden /> Thêm thị trường
          </Button>
        )}
      </header>
      <p className="type-meta">
        Trạng thái dưới mỗi nút cho biết thị trường đã có lịch cho mùa hoặc patch đang chọn ở trên.
      </p>
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
      {!data.markets.length && <p className="type-meta">Chưa có thị trường trong danh mục.</p>}
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
            {[season?.displayName ?? "Chưa gắn mùa", rule && rule.code, variant.patchTitle && variant.patchCode]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <PatchTitle variant={variant} />
        </div>
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          <span className="type-meta">{phaseLabels[variant.status] ?? variant.status}</span>
          {variant.dataReviewState === "COMPLETE" && <Badge variant="secondary">Đã hoàn tất nhập liệu</Badge>}
          {variant.status === "DRAFT" && <PatchReleaseForm variant={variant} data={data} />}
        </div>
      </header>
      <VersionMarketCoverage data={data} scope={{ variantId: variant.id }} locale={locale} />
      <ActionStrip aria-label="Phần của patch">
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
      </ActionStrip>
      {section === "changes" && <PatchChangesTable variantId={variant.id} overview={data} locale={locale} />}
      {section === "stats" && <PatchStatDefaults variant={variant} />}
      {section === "schedule" && (
        <div className="space-y-3 border-t pt-3">
          <PatchMarketSchedule variantId={variant.id} data={data} locale={locale} />
          {/* A published patch, older ones included, gets its market dates here instead of only from a market. */}
          {variant.status === "PUBLISHED" &&
            data.markets.some(
              (market) =>
                market.available &&
                !data.releases.some(
                  (release) =>
                    release.variantId === variant.id &&
                    release.regionId === market.id &&
                    release.status !== "CANCELLED",
                ),
            ) && <PatchReleaseForm variant={variant} data={data} />}
        </div>
      )}
      {section === "review" && <PatchDataReview variant={variant} />}
    </section>
  )
}
