import { PatchDataReview } from "./patch-data-review"
import { SharedPatchSetup, SeasonScheduleForm, PatchReleaseForm } from "./shared-version-setup"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import { CatalogTimeline } from "./catalog-timeline"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarPlus, ChevronDown, RefreshCw, Plus, Shapes } from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { useIsWide } from "@/hooks/use-media-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { MarketSchedule, PatchMarketSchedule, ConfirmRelease } from "./market-schedule"
import { Button } from "@aov/ui/components/button"
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
} from "./publication-overview"
const api = createPublishingApi(backendRequest)

export function GameConfigurationPage() {
  const overview = usePublicationOverview()
  const locale = useContentLocale()
  const [setup, setSetup] = useState<"season" | "patch" | "assignment" | null>(null)
  const [marketId, setMarketId] = useState<string | null>(null)
  const wide = useIsWide()
  const capabilities = useSession().actor?.capabilities ?? []
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const rulesets = useQuery({ queryKey: ["publishing-rulesets"], queryFn: api.rulesets, enabled: !!setup })
  const regions = useQuery({ queryKey: ["publishing-regions"], queryFn: api.regions, enabled: !!setup })
  const [params, setParams] = useSearchParams()
  const timelineScope = { seasonId: params.get("season") ?? "", variantId: params.get("patch") ?? "" }
  const changeScope = (next: typeof timelineScope) => {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        for (const [key, value] of [
          ["season", next.seasonId],
          ["patch", next.variantId],
        ]) {
          if (value) copy.set(key, value)
          else copy.delete(key)
        }
        return copy
      },
      { replace: true, preventScrollReset: true },
    )
    if (next.seasonId) setExpanded((old) => ({ ...old, [next.seasonId]: true }))
  }
  const data = overview.data
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
          <MarketOverview data={data} onOpenMarket={setMarketId} />
          <section className="min-w-0 space-y-3">
            <h2 className="type-section-title">Mùa và bản cập nhật</h2>
            <CatalogTimeline data={data} value={timelineScope} onChange={changeScope} showCounts={false} />
            {!data.seasons.length && (
              <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
                Chưa có mùa. Bấm “Tạo mùa” ở đầu trang.
              </p>
            )}
            {[...data.seasons]
              .sort((a, b) => b.ordinal - a.ordinal)
              .filter((s) => !timelineScope.seasonId || s.id === timelineScope.seasonId)
              .map((s) => {
                const variants = data.variants
                  .filter((v) => v.seasonId === s.id && (!timelineScope.variantId || v.id === timelineScope.variantId))
                  .sort((a, b) => a.rulesetOrdinal - b.rulesetOrdinal)
                const schedules = (data.seasonSchedules ?? []).filter((schedule) => schedule.seasonId === s.id)
                return (
                  <details
                    key={s.id}
                    className="group rounded-xl border bg-card"
                    open={
                      expanded[s.id] ??
                      (timelineScope.seasonId === s.id ||
                        data.variants.some((v) => v.id === timelineScope.variantId && v.seasonId === s.id) ||
                        schedules.some((schedule) => schedule.phase === "CURRENT"))
                    }
                    onToggle={(event) => {
                      const open = event.currentTarget.open
                      setExpanded((previous) => (previous[s.id] === open ? previous : { ...previous, [s.id]: open }))
                    }}
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                      <ChevronDown className="size-4" />
                      <span className="font-semibold">{s.displayName}</span>
                      {data.markets.some((m) => m.currentSeasonId === s.id) && <Badge>Đang áp dụng</Badge>}
                      <span className="text-xs text-muted-foreground">
                        #{s.ordinal} · {schedules.length} thị trường đã lên lịch
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">{variants.length} patch</span>
                    </summary>
                    <div className="space-y-3 border-t p-3">
                      <div className="space-y-2 p-3">
                        {schedules.map((schedule) => {
                          const market = data.markets.find((m) => m.id === schedule.regionId)
                          return (
                            <div key={schedule.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              {market && <MarketBadge code={market.code} name={market.displayName} showName />}
                              <span className="text-muted-foreground">
                                {dateLabel(schedule.startsOn ?? schedule.startsAt, locale)} –{" "}
                                {dateLabel(schedule.endsOn ?? schedule.endsAt, locale)} · {phaseLabels[schedule.phase]}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <details className="rounded-lg bg-muted/20 p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          Thiết lập lịch mùa theo thị trường
                        </summary>
                        <div className="pt-3">
                          <SeasonScheduleForm seasonId={s.id} data={data} />
                        </div>
                      </details>
                      {variants.length ? (
                        variants.map((v) => (
                          <PatchDisclosure
                            key={v.id}
                            variant={v}
                            data={data}
                            locale={locale}
                            phase={v.status}
                            selected={timelineScope.variantId === v.id}
                          />
                        ))
                      ) : (
                        <p className="p-4 text-sm text-muted-foreground">Chưa có patch trong mùa này.</p>
                      )}
                    </div>
                  </details>
                )
              })}
            {data.variants.some((v) => !v.seasonId) && (
              <details className="rounded-xl border bg-card">
                <summary className="cursor-pointer p-4 font-medium">Patch cũ chưa gắn mùa</summary>
                <div className="space-y-3 p-3">
                  {data.variants
                    .filter((v) => !v.seasonId)
                    .map((v) => (
                      <PatchDisclosure
                        key={v.id}
                        variant={v}
                        data={data}
                        locale={locale}
                        phase={v.status}
                        selected={timelineScope.variantId === v.id}
                      />
                    ))}
                </div>
              </details>
            )}
          </section>
          <MarketSchedule marketId={marketId} data={data} locale={locale} onClose={() => setMarketId(null)} />
        </>
      )}
    </Page>
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
        className="grid items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[minmax(10rem,1fr)_1fr_1.4fr]"
      >
        <MarketBadge code={m.code} name={m.displayName} showName onOpen={() => onOpenMarket(m.id)} />
        <span>
          <span className="block text-xs text-muted-foreground">Mùa hiện tại</span>
          {season?.displayName ?? <span className="text-muted-foreground">Chưa có</span>}
        </span>
        <span>
          <span className="block text-xs text-muted-foreground">Patch hiện tại</span>
          {variant ? (
            <span className="inline-flex items-center gap-2">
              {variant.patchCode}
              <Badge>Đang áp dụng</Badge>
            </span>
          ) : (
            <span className="text-muted-foreground">Chưa xác nhận</span>
          )}
          {pending && (
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {data.variants.find((v) => v.id === pending.variantId)?.patchCode} · Chờ xác nhận
              <ConfirmRelease id={pending.id} />
            </span>
          )}
        </span>
      </li>
    )
  }
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="Thị trường">
      <div className="border-b px-4 py-3">
        <h2 className="type-section-title">Thị trường đang phát hành</h2>
      </div>
      {groups.map(({ rule, markets }) => (
        <div key={rule.id || "none"}>
          {grouped && (
            <p className="border-b bg-muted/30 px-4 py-1.5 text-xs font-medium text-muted-foreground">{rule.code}</p>
          )}
          {markets.length ? (
            <ul className="divide-y">{markets.map(row)}</ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">Chưa có thị trường áp dụng.</p>
          )}
        </div>
      ))}
      {!groups.length && <p className="px-4 py-3 text-sm text-muted-foreground">Chưa có thị trường đang phát hành.</p>}
      {unsupported.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          Chưa hỗ trợ:
          {unsupported.map((m) => (
            <MarketBadge key={m.id} code={m.code} name={m.displayName} onOpen={() => onOpenMarket(m.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

function PatchDisclosure({
  variant,
  data,
  locale,
  phase,
  time,
  source,
  selected = false,
}: {
  variant: Variant
  data: PublicationOverview
  locale: string
  phase: string
  time?: string
  source?: string | null
  selected?: boolean
}) {
  const [open, setOpen] = useState(selected)
  useEffect(() => {
    if (selected) setOpen(true)
  }, [selected])
  // Recorded changes are what editors open a patch for; schedules and data review sit one click away.
  const [section, setSection] = useState<"changes" | "schedule" | "review">("changes")
  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-3 bg-muted/20 p-4 text-left"
      >
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="font-medium">{variant.patchCode}</span>
        {data.releases.some(
          (r) => r.variantId === variant.id && data.markets.some((m) => m.currentReleaseId === r.id),
        ) && <Badge>Đang áp dụng</Badge>}
        {variant.dataReviewState === "COMPLETE" && <Badge variant="secondary">Đã hoàn tất nhập liệu</Badge>}
        <Badge variant={phase === "CURRENT" ? "default" : "outline"}>{phaseLabels[phase] ?? phase}</Badge>
        {data.rulesets.length > 1 && (
          <span className="text-xs text-muted-foreground">
            {data.rulesets.find((r) => r.id === variant.rulesetId)?.code}
          </span>
        )}
        {time && <span className="ml-auto text-xs text-muted-foreground">{dateLabel(time, locale)}</span>}
      </button>
      {open && (
        <div className="border-t">
          <div className="flex flex-wrap items-center gap-1 px-3 pt-3" aria-label="Phần của patch">
            {(
              [
                ["changes", "Thay đổi"],
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
                className="h-8"
                onClick={() => setSection(key)}
              >
                {label}
              </Button>
            ))}
            {source && /^https?:\/\//.test(source) && (
              <a className="ml-auto text-sm text-primary underline" href={source} target="_blank" rel="noreferrer">
                Nguồn cập nhật
              </a>
            )}
          </div>
          {section === "changes" && <PatchChangesTable variantId={variant.id} overview={data} locale={locale} />}
          {section === "schedule" && (
            <div className="space-y-2 pb-3">
              <PatchMarketSchedule variantId={variant.id} data={data} locale={locale} />
              <details className="mx-3 rounded-lg bg-muted/20 p-3">
                <summary className="cursor-pointer text-sm font-medium">Thiết lập lịch patch theo thị trường</summary>
                <div className="pt-3">
                  <PatchReleaseForm variant={variant} data={data} />
                </div>
              </details>
            </div>
          )}
          {section === "review" && <PatchDataReview variant={variant} />}
        </div>
      )}
    </div>
  )
}
