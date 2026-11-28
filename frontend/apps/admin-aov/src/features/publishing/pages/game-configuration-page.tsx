import { activeCatalogScope, catalogScopePatch, resolveCatalogScope } from "@/lib/catalog-scope"
import { useCatalogScopePreference } from "../components/catalog/catalog-scope-memory"
import { PatchDataReview } from "../components/setup/patch-data-review"
import { SharedPatchSetup, PatchReleaseForm } from "../components/setup/shared-version-setup"
import { useState } from "react"
import { useSearchParams } from "react-router"
import { CatalogTimeline } from "../components/catalog/catalog-timeline"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CalendarClock,
  Clapperboard,
  CalendarCog,
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Globe2,
  Layers,
  Plus,
  Shapes,
  type LucideIcon,
} from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { useIsWide } from "@/hooks/use-media-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import {
  MarketSchedule,
  PatchMarketSchedule,
  ConfirmRelease,
  ConfirmReleases,
  type MarketMode,
} from "../components/setup/market-schedule"
import { Button } from "@aov/ui/components/button"
import { ActionStrip } from "@/components/action-strip"
import { Badge } from "@aov/ui/components/badge"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import { assignSharedRuleset, DEFAULT_RULESET_CODE } from "@/lib/default-ruleset"
import { invalidateReferenceCatalog } from "../../terminology/reference-api"
import { SeasonSetup } from "../components/setup/season-setup"
import { CreateRegion } from "../components/setup/context-setup"
import { VersionMarketCoverage } from "../components/setup/version-market-coverage"
import { ReleasePlanEditor } from "../components/setup/release-plan"
import { PatchVideos } from "../components/setup/patch-videos"
import { PatchChangesTable } from "../components/patch-changes/patch-changes-table"
import { PatchTitle } from "../components/setup/patch-title"
import { MarketBadge } from "../components/setup/market-badge"
import {
  usePublicationOverview,
  useContentLocale,
  phaseLabels,
  type PublicationOverview,
  type Variant,
  type Season,
} from "../api/publication-overview"
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
  // The markets open over the patch being worked on; the address keeps them open so a link can lead straight there.
  const marketsOpen = params.get("tab") === "markets"
  const showMarkets = (open: boolean) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (open) next.set("tab", "markets")
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
        queryClient.invalidateQueries({ queryKey: publishingKeys.rulesets }),
        overview.refetch(),
        invalidateReferenceCatalog(queryClient),
      ])
      toast.success("Đã tạo bộ quy tắc mặc định.")
    } catch (cause) {
      toast.error(errorMessage(cause))
    }
  }
  const canWritePatch = capabilities.includes("patch:write")
  const canCreateRuleset = capabilities.includes("region:admin") && !!data && !data.rulesets.length
  return (
    <Page>
      <PageHeader
        title="Phiên bản và thị trường"
        actions={
          <>
            {data && (
              <Button variant="outline" size="sm" aria-haspopup="dialog" onClick={() => showMarkets(true)}>
                <Globe2 aria-hidden /> Thị trường
              </Button>
            )}
            {(canWritePatch || canCreateRuleset) && (
              <PageActionsMenu label="Tạo và thiết lập phiên bản">
                {canWritePatch && (
                  <>
                    <DropdownMenuItem onSelect={() => setSetup("patch")}>
                      <Plus />
                      Tạo patch
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setSetup("season")}>
                      <CalendarPlus />
                      Tạo mùa
                    </DropdownMenuItem>
                  </>
                )}
                {canWritePatch && canCreateRuleset && <DropdownMenuSeparator />}
                {canCreateRuleset && (
                  <DropdownMenuItem onSelect={() => void createDefaultRuleset()}>
                    <Shapes />
                    Tạo bộ quy tắc mặc định
                  </DropdownMenuItem>
                )}
              </PageActionsMenu>
            )}
          </>
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
                      queryClient.invalidateQueries({ queryKey: publishingKeys.regions }),
                      queryClient.invalidateQueries({ queryKey: publishingKeys.allAuthoringContexts }),
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
            <div className="min-w-0 space-y-4">
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
            </div>
          )}
          <Sheet open={marketsOpen} onOpenChange={showMarkets}>
            <SheetContent
              side={wide ? "right" : "bottom"}
              className={wide ? "w-[min(760px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
              onOpenAutoFocus={focusSheet}
            >
              <SheetHeader className="border-b">
                <SheetTitle className="flex items-center gap-2">
                  <Globe2 aria-hidden className="size-4" /> Thị trường
                </SheetTitle>
                <SheetDescription>
                  Mùa và patch đang áp dụng ở từng nơi. Trạng thái dưới mỗi nút theo mùa hoặc patch đang chọn.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                <MarketOverview
                  data={data}
                  seasonId={timelineScope.seasonId}
                  variantId={timelineScope.variantId}
                  onOpenMarket={(id, mode) => setMarketEditor({ id, mode })}
                  onCreate={capabilities.includes("region:admin") ? () => setSetup("region") : undefined}
                />
              </div>
            </SheetContent>
          </Sheet>
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
    const pendingAll = data.releases.filter(
      (r) =>
        r.regionId === m.id &&
        r.phase === "AWAITING_CONFIRMATION" &&
        data.variants.some((v) => v.id === r.variantId && v.rulesetId === m.currentRulesetId),
    )
    const pending = pendingAll[0]
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
            {pendingAll.length > 1 ? (
              <>
                Chờ xác nhận {pendingAll.length} bản cập nhật
                <ConfirmReleases releases={pendingAll} data={data} />
              </>
            ) : (
              <>
                Chờ xác nhận {data.variants.find((v) => v.id === pending.variantId)?.patchCode}
                <ConfirmRelease id={pending.id} />
              </>
            )}
          </div>
        )}
      </li>
    )
  }
  return (
    <section className="@container/markets min-w-0 space-y-4 pt-4" aria-label="Thị trường">
      {onCreate && (
        <Button size="sm" variant="outline" onClick={onCreate}>
          <Plus aria-hidden /> Thêm thị trường
        </Button>
      )}
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

/** A sheet opens with focus on itself, so the first date in it does not open its tooltip over the list. */
const focusSheet = (event: Event) => {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement | null)?.focus()
}

/** The parts of a patch kept out of the way of its change list: each opens on its own sheet. */
type PatchTool = "schedule" | "videos" | "review"
const PATCH_TOOLS: { key: PatchTool; label: string; short: string; icon: LucideIcon; description: string }[] = [
  {
    key: "schedule",
    label: "Lịch phát hành",
    short: "Lịch",
    icon: CalendarClock,
    description: "Một thời điểm chung, theo giờ từng thị trường.",
  },
  {
    key: "videos",
    label: "Video",
    short: "Video",
    icon: Clapperboard,
    description: "Video trước và sau phát hành tại Việt Nam.",
  },
  {
    key: "review",
    label: "Kiểm tra dữ liệu",
    short: "Kiểm tra",
    icon: ClipboardCheck,
    description: "Xác nhận đã nhập đủ thay đổi của patch.",
  },
]

function PatchDetail({ variant, data, locale }: { variant: Variant; data: PublicationOverview; locale: string }) {
  const [tool, setTool] = useState<PatchTool | null>(null)
  const wide = useIsWide()
  const season = data.seasons.find((s) => s.id === variant.seasonId)
  const rule = data.rulesets.length > 1 && data.rulesets.find((r) => r.id === variant.rulesetId)
  const reviewed = variant.dataReviewState === "COMPLETE"
  const open = PATCH_TOOLS.find((entry) => entry.key === tool)
  const canPublish = !!useSession().actor?.capabilities.includes("patch:publish")
  const planKey = data.releases
    .filter((release) => release.variantId === variant.id)
    .map((release) => [release.id, release.status, release.effectiveAt, release.effectiveOn].join(":"))
    .join("|")
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
          {reviewed && <Badge variant="secondary">Đã hoàn tất nhập liệu</Badge>}
          {variant.status === "DRAFT" && <PatchReleaseForm variant={variant} data={data} />}
        </div>
      </header>
      {/* A phone gets even tiles it can reach with a thumb; a wide screen a quiet row of buttons. */}
      <div
        role="group"
        aria-label="Thiết lập patch"
        className={wide ? "flex flex-wrap items-center gap-2" : "grid grid-cols-2 gap-2"}
      >
        {PATCH_TOOLS.map(({ key, label, short, icon: Icon }) => {
          const done = key === "review" && reviewed
          return (
            <Button
              key={key}
              type="button"
              variant="outline"
              size={wide ? "sm" : "default"}
              aria-haspopup="dialog"
              aria-label={label}
              title={label}
              className={wide ? undefined : "h-auto min-h-14 flex-col gap-1 px-1 py-2"}
              onClick={() => setTool(key)}
            >
              {done ? (
                <CircleCheck aria-hidden className="size-4 text-(--aov-success)" />
              ) : (
                <Icon aria-hidden className="size-4" />
              )}
              <span className={wide ? undefined : "type-meta text-foreground"}>{wide ? label : short}</span>
            </Button>
          )
        })}
      </div>
      <PatchChangesTable variantId={variant.id} overview={data} locale={locale} />
      <Sheet open={!!tool} onOpenChange={(next) => !next && setTool(null)}>
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={wide ? "w-[min(720px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
          onOpenAutoFocus={focusSheet}
        >
          {open && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="flex items-center gap-2">
                  <open.icon aria-hidden className="size-4" /> {open.label}
                </SheetTitle>
                <SheetDescription>
                  {variant.patchCode} · {open.description}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-3 pb-6">
                {open.key === "review" && <PatchDataReview variant={variant} />}
                {open.key === "videos" && <PatchVideos variant={variant} data={data} />}
                {open.key === "schedule" &&
                  (canPublish && variant.status === "PUBLISHED" ? (
                    // Saved releases re-key the plan, so it reads back what the server kept.
                    <ReleasePlanEditor key={planKey} variant={variant} data={data} />
                  ) : (
                    <PatchMarketSchedule variantId={variant.id} data={data} locale={locale} />
                  ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}
